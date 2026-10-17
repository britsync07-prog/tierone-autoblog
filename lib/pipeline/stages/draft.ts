// Draft stage (PIPE-03, plan 03-06) — the chain's LAST hop: outlined entries
// become landed, template-checked MDX posts. Sibling of 03-05's assets stage
// (same raw-registry binding idiom, same fail-closed parking notes). The 03-06
// rework contracts hold under the ⚠ OWNER FULLY-FREE DIRECTIVE (2026-10-17):
// the draft-body call runs on the env-configured FREE OpenAI-compatible
// adapter (lib/pipeline/llm.ts) — never a paid API — and errors name the
// MISSING ENV VARS, never values (T-03-05).
//
// D-12 defense in depth (each layer AFTER the model call):
//   payload zod (draftPayloadSchema) -> stage assertions (word band 1500-2500,
//   H2 fidelity vs the outline, FAQ provenance, comparison-table parity) ->
//   draftSchema.parse on the ASSEMBLED frontmatter -> check-template spawn
//   BEFORE advance. Any failure = an attempt recorded on the entry
//   (draft.attempts/lastError, first 200 chars), stage stays 'outlined', and
//   NO half-landed file survives (the gate deletes the file it fails).
//
// D-04 visible trail: entries past MAX_DRAFT_ATTEMPTS_PER_ENTRY are skipped
// with a note (no spend) instead of auto-rejecting; human review happens via
// the git-committed registry, not silent discards.
//
// Pacing rationale: DRAFTS_PER_RUN=2 mirrors 03-03's brief cap — one chain
// pass lands at most 2 posts and defers excess queues to the next run.
//
// REAL-mode budget axes (⚠ fully-free): assertRequestsAvailable(dir, 1)
// before each entry; a real draft-body call appends a `free.llm` ledger op
// with cost 0 and a truthfully counted requests total. D-02's USD ledger is
// DataForSEO-specific; LLM spend reports through StageResult notes (03-03/
// 03-05 convention).
//
// FIXTURE MODE (PIPELINE_DRAFT_FIXTURE=1): draft-body calls resolve to a
// canned DRAFT_FIXTURE_PAYLOADS variant (PIPELINE_DRAFT_VARIANT, default GOOD)
// through completeJson's jsonFixture lane — same zod gate, zero network, zero
// spend, fully deterministic verification. Exports:
//   DRAFT_FIXTURE_PAYLOADS — GOOD / GOOD_COMPARISON / BAD_FAQ / BAD_BAND /
//     BAD_H2 / BAD_COMPARISON payloads (bodies padded to EXACT word counts)
//   draftFixtureCalls — mutable {count} holder incremented once per fixture
//     call (tests reset it; an object export because CJS live-binding of
//     `let` exports is fragile under tsx interop).

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { comparisonSchema, draftSchema } from '../draft-schema';
import { assertLlmReady, completeJson, type LlmMessage } from '../llm';
import { advance, listPromotable, loadShard, saveShard } from '../registry';
import { appendSpend, assertRequestsAvailable } from '../budget';
import type { RegistryEntry } from '../types';
import type { StageResult } from '../run';

/** Batch bound: at most 2 drafted landings per stage pass (03-03 pace). */
export const DRAFTS_PER_RUN = 2;

/** Per-entry retry ceiling (D-04): past it, skipped with a note, no spend. */
export const MAX_DRAFT_ATTEMPTS_PER_ENTRY = 5;

/** D-14 pricing caution — assembled into every comparison block (seed-01 pattern). */
export const PRICING_NOTE = 'Prices shift often — confirm pricing on vendor pages before choosing.';

const DEFAULT_BRIEFS_DIR = 'content/briefs';
const DEFAULT_POSTS_DIR = 'content/posts';

const BAND: [number, number] = [1500, 2500];

const normQ = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\?+$/, '');

// ---------------------------------------------------------------------------
// Outline parse — zero-dep text mirrors of check-outline.mjs so the two agree.
// ---------------------------------------------------------------------------

export interface ParsedOutline {
  /** Real content H2s under `## Structure` (template shape, sans markers). */
  h2s: string[];
  /** The literal `[comparison-table slot]` outcome flag anywhere in the file. */
  hasComparisonSlot: boolean;
}

export function parseOutlineStructure(markdown: string): ParsedOutline {
  const h2s: string[] = [];
  let inStructure = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.trimEnd() === '## Structure') {
      inStructure = true;
      continue;
    }
    const m = inStructure ? /^## (.+?) — target ~\d+ words\s*$/.exec(line) : null;
    if (m) {
      h2s.push(m[1]);
      continue;
    }
    if (inStructure && /^## /.test(line)) break; // next top-level section begins
  }
  return { h2s, hasComparisonSlot: markdown.includes('[comparison-table slot]') };
}

/** `- Q:` entries under the `## FAQs` section (check-outline rule 5 idiom). */
export function parseOutlineFaqs(markdown: string): string[] {
  const out: string[] = [];
  let inFaq = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^## /.test(line)) {
      inFaq = /^## FAQs\b/i.test(line);
      continue;
    }
    if (inFaq && /^- Q: /.test(line)) out.push(line.slice(5).trim()); // '- Q: ' is exactly 5 chars
  }
  return out;
}

// ---------------------------------------------------------------------------
// Model payload — zod-validated structured JSON from the draft-body call.
// ---------------------------------------------------------------------------

const draftPayloadSchema = z.object({
  title: z.string(), // 50-60 chars enforced later through draftSchema.parse
  description: z.string(), // 150-160 chars enforced through draftSchema.parse
  tldr: z.string(), // <=100 words enforced through draftSchema.parse
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).min(3).max(5),
  comparison: comparisonSchema.optional(), // only permitted when the outline flagged the slot
  body: z.string(), // word band + H2 fidelity enforced by STAGE assertions
});

/** Contaminated-data guard (PITFALLS): SERP rows enter the prompt as QUOTED
 * DATA so the model cites them as evidence instead of echoing them around as
 * established fact; untrusted model output never feeds back into prompts. */
function buildMessages(
  entry: RegistryEntry,
  outlineText: string,
  pool: string[],
  inArticleAlts: string[],
): LlmMessage[] {
  const serp = (entry.serpTop3 ?? [])
    .map((r) => `"position ${r.position}: ${r.title} — ${r.url}"`)
    .join('; ')
    .slice(0, 1500);
  const alts = inArticleAlts.length > 0 ? inArticleAlts.join(' | ') : '(none flagged)';
  const system = [
    'You are the draft writer inside an automated blog pipeline. Reply with ONE JSON object and nothing else — no prose, no markdown fences.',
    'Template contract (hard rules):',
    '- title: 50-60 chars. The page H1 IS this title; the markdown body must contain NO "# " line.',
    '- description: exactly 150-160 chars.',
    '- tldr: <=100 words, plain prose.',
    '- body: markdown, 1500-2500 words, written for a US reader (en-US).',
    `  The body must contain the EXACT supplied H2 headings IN ORDER, each rendered \`## {heading}\`;`,
    '  copy each heading VERBATIM — the assertions compare literal strings.',
    '- faqs: 3-5 entries; every q string must be one of the supplied questions VERBATIM —',
    '  inventing a question is a hard template violation; answers 1-3 sentences of plain prose.',
    '- comparison: ONLY when the outline flags the [comparison-table slot]: qualitative',
    '  columns/rows justified by the supplied SERP coverage and its gaps — never invent',
    '  metrics, quotes, or URLs (PITFALLS: hallucinated data).',
    'PITFALLS: no banned filler ("delve", "fast-paced world", "game-changer", "unlock the power",',
    '"in today\'s digital age"); no unresolved template markers in the final body',
    '("{{image:" and "[comparison-table slot]" must never appear there).',
    inArticleAlts.length > 0
      ? 'Supplied in-article image alt strings may inform section framing; images route through frontmatter/hero, not body markers.'
      : 'No image markers belong in the body.',
    'Give the last supplied heading a conclusion section and link the /about page in natural prose.',
  ].join('\n');
  const user = [
    'OUTLINE FILE (committed artifact — structure, FAQs, image slots):',
    '',
    outlineText,
    '',
    `KEYWORD / SILO: ${entry.keyword} (silo ${entry.silo})`,
    `SUPPLIED SERP TOP-3 AS QUOTED DATA: ${serp.length > 0 ? serp : '(none captured — argue from general knowledge only, inventing no specifics)'}`,
    `SUPPLIED QUESTION POOL (PAA — answer only these, verbatim): ${pool.join(' | ')}`,
    `SUPPLIED IN-ARTICLE IMAGE ALTS: ${alts}`,
    '',
    'Return JSON shape: {title, description, tldr, faqs:[{q,a}], comparison?:{title?,note?,columns:[{id,label}],rows:[{cells,best?}]}, body}',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// ---------------------------------------------------------------------------
// Fixture payloads (verify lane). Bodies are built programmatically with clean
// filler tokens so word bands land EXACTLY; nothing here is ever networked.
// ---------------------------------------------------------------------------

export type DraftFixtureVariant =
  | 'GOOD'
  | 'GOOD_COMPARISON'
  | 'BAD_FAQ'
  | 'BAD_BAND'
  | 'BAD_H2'
  | 'BAD_COMPARISON';

interface PayloadShape {
  title: string;
  description: string;
  tldr: string;
  faqs: Array<{ q: string; a: string }>;
  comparison?: {
    title?: string;
    note?: string;
    columns: Array<{ id: string; label: string }>;
    rows: Array<{ cells: Array<string>; best?: boolean }>;
  };
  body: string;
}

const FILLER =
  'the fixture draft walks the same beats the real writer follows so the stage keeps an honest trail of checks before any file lands in the posts directory at all for good';

function paddedBody(
  targetWords: number,
  opts: { missingH2?: string } = {},
): string {
  const H2S = [
    'What lands as frontmatter',
    'How the assertions guard the body',
    'Where the file lands and what gets recorded',
  ];
  const lines: string[] = [];
  lines.push('This fixture body exists so the stage assertions can be checked byte by byte.');
  lines.push('');
  for (const h2 of H2S) {
    if (opts.missingH2 === h2) {
      // The supplied heading must vanish entirely — not just lose its content —
      // so the H2-fidelity assertion catches it before any file is touched.
      lines.push('## Something Else Entirely');
      lines.push('');
      lines.push(FILLER);
      lines.push('');
      continue;
    }
    lines.push(`## ${h2}`);
    lines.push('');
    lines.push(FILLER);
    lines.push('');
    if (h2 === H2S[1]) {
      lines.push('Every curious reader of the fixture trail can start from the [about page](/about) before reading on.');
      lines.push('');
      lines.push(FILLER);
      lines.push('');
    }
  }
  let text = lines.join('\n');
  const count = (t: string): number => t.split(/\s+/).filter(Boolean).length;
  // pad to the exact word target on a single trailing token, then trim overs
  while (count(text) < targetWords) text += ' fixture';
  if (count(text) > targetWords) {
    const words = text.split(/\s+/).filter(Boolean);
    while (count(text) > targetWords) {
      words.pop();
      text = words.join(' ');
    }
  }
  return text;
}

const FIXTURE_TITLE = 'How the TierOne AutoBlog Draft Pipeline Works Day One'; // 53 chars
const FIXTURE_DESC =
  'The draft stage turns an outlined, image-ready registry entry into a template-conformant MDX post via zod frontmatter, stage assertions, and a template gate.'; // 157 chars
const FIXTURE_TLDR =
  'The fixture payload mirrors the real draft: frontmatter from the outline, an assertion-guarded body, and a template gate read-back before the entry advances.';
const INVENTED_QUESTION = 'What secret fixture question was never observed in any capture?';

function baseFaqs(payloadQs: Array<string | undefined>): Array<{ q: string; a: string }> {
  const base = [
    'Do AI writing tools hurt SEO rankings?',
    'Which AI writing tool is best for beginners?',
    'Can AI writing tools pass plagiarism checks?',
    'How much should I pay for an AI writing assistant?',
  ];
  return base.slice(0, 3).map((q, i) => ({
    q: payloadQs[i] ?? q,
    a: 'The fixture answers echo the provenance discipline: every question must come from the observed set, and each answer stays within one to three sentences of plain prose.',
  }));
}

const FINISHED_BODY = paddedBody(1600);

const GOOD_COMPARISON_BLOCK = {
  title: 'Fixture comparison with the flagged slot',
  columns: [
    { id: 'tool', label: 'Tool' },
    { id: 'shape', label: 'Shape' },
    { id: 'fit', label: 'Fit' },
  ],
  rows: [
    { cells: ['Fixture A', 'fixture shape', 'fixture fit'], best: true },
    { cells: ['Fixture B', 'fixture shape', 'fixture fit'] },
  ],
};

function makePayload(variant: DraftFixtureVariant): PayloadShape {
  const good: PayloadShape = {
    title: FIXTURE_TITLE,
    description: FIXTURE_DESC,
    tldr: FIXTURE_TLDR,
    faqs: baseFaqs([undefined, undefined, undefined]),
    body: FINISHED_BODY,
  };
  switch (variant) {
    case 'GOOD':
      return good;
    case 'GOOD_COMPARISON':
      return { ...good, comparison: GOOD_COMPARISON_BLOCK };
    case 'BAD_COMPARISON':
      return {
        ...good,
        comparison: {
          title: 'Fixture comparison without provenance',
          columns: GOOD_COMPARISON_BLOCK.columns,
          rows: GOOD_COMPARISON_BLOCK.rows,
        },
      };
    case 'BAD_FAQ':
      return { ...good, faqs: baseFaqs([INVENTED_QUESTION, undefined, undefined]) };
    case 'BAD_BAND':
      return { ...good, body: paddedBody(1499) };
    case 'BAD_H2':
      return { ...good, body: paddedBody(1600, { missingH2: 'How the assertions guard the body' }) };
  }
}

export const DRAFT_FIXTURE_PAYLOADS: Record<DraftFixtureVariant, PayloadShape> = {
  GOOD: makePayload('GOOD'),
  GOOD_COMPARISON: makePayload('GOOD_COMPARISON'),
  BAD_FAQ: makePayload('BAD_FAQ'),
  BAD_BAND: makePayload('BAD_BAND'),
  BAD_H2: makePayload('BAD_H2'),
  BAD_COMPARISON: makePayload('BAD_COMPARISON'),
};

/** Mutable counter holder (tests reset per run): one count per fixture call. */
export const draftFixtureCalls = { count: 0 };

// ---------------------------------------------------------------------------
// Frontmatter rendering (file shape mirrors the phase-1 seeds).
// ---------------------------------------------------------------------------

const yq = (s: string): string => JSON.stringify(s);

function frontmatterYaml(fm: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt: string;
  faq: Array<{ q: string; a: string }>;
  silo: string;
  tldr: string;
  heroImage?: { src: string; alt: string };
  comparison?: {
    title?: string;
    note?: string;
    columns: Array<{ id: string; label: string }>;
    rows: Array<{ cells: Array<string>; best?: boolean }>;
  };
}): string {
  const lines: string[] = [
    `title: ${yq(fm.title)}`,
    `description: ${yq(fm.description)}`,
    `slug: ${yq(fm.slug)}`,
    `publishedAt: ${yq(fm.publishedAt)}`,
    `updatedAt: ${yq(fm.updatedAt)}`,
    `silo: ${yq(fm.silo)}`,
    `tldr: ${yq(fm.tldr)}`,
  ];
  if (fm.heroImage) {
    lines.push('heroImage:');
    lines.push(`  src: ${yq(fm.heroImage.src)}`);
    lines.push(`  alt: ${yq(fm.heroImage.alt)}`);
  }
  lines.push('faq:');
  for (const f of fm.faq) {
    lines.push(`  - q: ${yq(f.q)}`);
    lines.push(`    a: ${yq(f.a)}`);
  }
  if (fm.comparison) {
    lines.push('comparison:');
    if (fm.comparison.title) lines.push(`  title: ${yq(fm.comparison.title)}`);
    if (fm.comparison.note) lines.push(`  note: ${yq(fm.comparison.note)}`);
    lines.push('  columns:');
    for (const c of fm.comparison.columns) {
      lines.push(`    - id: ${yq(c.id)}`);
      lines.push(`      label: ${yq(c.label)}`);
    }
    lines.push('  rows:');
    for (const r of fm.comparison.rows) {
      lines.push(`    - cells: [${r.cells.map(yq).join(', ')}]`);
      if (r.best) lines.push('      best: true');
    }
  }
  return lines.join('\n');
}

/** Sibling loose context — same contract note as sibling stages: the runner
 * passes full APIs; tests and the plan verify pass briefsDir+postsDir only. */
export interface DraftStageContext {
  registryDir: string;
  registry: unknown;
  budget: unknown;
  log: (message: string) => void;
  /** Default committed-brief root (D-11) — outlines live next to their briefs. */
  briefsDir?: string;
  /** Default landed-posts root — tests sandbox it; the gate runs over it. */
  postsDir?: string;
}

function persistEntry(registryDir: string, silo: RegistryEntry['silo'], entry: RegistryEntry): void {
  const shard = loadShard(registryDir, silo);
  const idx = shard.keywords.findIndex((e) => e.id === entry.id);
  if (idx >= 0) shard.keywords[idx] = entry;
  else shard.keywords.push(entry);
  shard.updatedAt = new Date().toISOString();
  saveShard(registryDir, silo, shard);
}

/**
 * Stage entrypoint (03-01 contract): `runStage(ctx) -> StageResult`.
 * Fixture flows set PIPELINE_DRAFT_FIXTURE=1 (+ optional PIPELINE_DRAFT_VARIANT);
 * production callers only pass the standard StageContext.
 */
export async function runStage(ctx: DraftStageContext): Promise<StageResult> {
  const briefsDir = ctx.briefsDir ?? DEFAULT_BRIEFS_DIR;
  const postsDir = ctx.postsDir ?? DEFAULT_POSTS_DIR;
  const registryDir = ctx.registryDir;
  const fixtureMode = process.env.PIPELINE_DRAFT_FIXTURE === '1';
  const variant = (process.env.PIPELINE_DRAFT_VARIANT ?? 'GOOD') as DraftFixtureVariant;
  const notes: string[] = [];
  let advanced = 0;

  if (!fixtureMode) {
    // Fail-closed preflight BEFORE any registry state is touched (03-03 idiom):
    // throws LlmNoCredentialsError naming the missing env vars, never values.
    assertLlmReady();
  }

  const queue = listPromotable(registryDir, 'outlined', 'drafted', DRAFTS_PER_RUN);
  if (queue.length === 0) {
    notes.push(
      'nothing promotable from outlined to drafted this run (cap DRAFTS_PER_RUN=2; entries parked below are retried by the next run)',
    );
    return { advanced: 0, rejected: 0, spentUsd: 0, notes };
  }

  const gateScript = resolve(process.cwd(), 'scripts', 'check-template.mjs');

  for (const entry of queue) {
    const prevAttempts = entry.draft?.attempts ?? 0;

    // 2) retry ceiling — skip WITHOUT any LLM spend; D-04 keeps the trail.
    if (prevAttempts >= MAX_DRAFT_ATTEMPTS_PER_ENTRY) {
      notes.push(
        `${entry.id}: skipped — template-failure ceiling (${prevAttempts} attempts >= ${MAX_DRAFT_ATTEMPTS_PER_ENTRY}); stays 'outlined' for human review of draft.lastError`,
      );
      continue;
    }

    const persistAttempt = (reason: string): void => {
      entry.draft = {
        slug: entry.id,
        attempts: (entry.draft?.attempts ?? 0) + 1,
        lastError: reason.slice(0, 200),
      };
      entry.updatedAt = new Date().toISOString();
      persistEntry(registryDir, entry.silo, entry);
    };

    // 3) precondition ladder — ALL must hold; failures PARK (no attempt charged).
    if (entry.outline?.lint !== 'pass' || !entry.outline?.completedAt) {
      notes.push(
        `${entry.id}: parked — outline precondition missing (outline.lint === 'pass' AND outline.completedAt must be re-asserted before drafting)`,
      );
      continue;
    }
    if (!entry.images?.completedAt) {
      notes.push(
        `${entry.id}: parked — images precondition missing (entry.images.completedAt absent — the 03-05 assets stage wires hero assets before drafting)`,
      );
      continue;
    }
    if (!entry.images?.hero?.src || !entry.images?.hero?.alt) {
      notes.push(
        `${entry.id}: parked — images hero malformed (a well-formed hero src/alt is the 03-05 contract)`,
      );
      continue;
    }
    const outlineFile = join(briefsDir, entry.silo, `${entry.id}-outline.md`);
    let outlineText: string;
    try {
      outlineText = readFileSync(outlineFile, 'utf8');
    } catch {
      notes.push(
        `${entry.id}: parked — outline artifact missing at ${join(entry.silo, `${entry.id}-outline.md`)} (D-11: drafts only attach to committed outlines)`,
      );
      continue;
    }
    // 4) outline parse — mirror of check-outline.mjs rule 4 so the two agree.
    const parsed = parseOutlineStructure(outlineText);
    if (parsed.h2s.length === 0) {
      notes.push(
        `${entry.id}: parked — outline has zero template H2s under '## Structure' (need >=3 in the '## {H2} — target ~N words' shape)`,
      );
      continue;
    }
    // ⚠ DEVIATION (documented: the plan's literal `paa.length >= 3` precondition
    // is unachievable on live data — the Bing SERP swap in 03-02 leaves paa[]
    // empty platform-wide). Provenance pool = entry.paa[] when non-empty, else
    // the outline's `- Q:` FAQ block (check:outline already enforces >=3 with
    // honest provenance). Assertion messages still name `paa` — the concept.
    const pool =
      Array.isArray(entry.paa) && entry.paa.length > 0 ? entry.paa : parseOutlineFaqs(outlineText);
    if (pool.length < 3) {
      notes.push(
        `${entry.id}: parked — FAQ provenance pool has ${pool.length} questions (want >=3; paa[] empty and the outline FAQ block is absent)`,
      );
      continue;
    }

    // REAL-mode request-cap gate before the call (⚠ fully-free directive).
    if (!fixtureMode) assertRequestsAvailable(registryDir, 1);

    const messages = buildMessages(
      entry,
      outlineText,
      pool,
      entry.images.inArticle?.map((s) => s.alt) ?? [],
    );
    const fixturePayload = fixtureMode ? DRAFT_FIXTURE_PAYLOADS[variant] ?? DRAFT_FIXTURE_PAYLOADS.GOOD : undefined;
    if (fixtureMode) draftFixtureCalls.count += 1;

    let payload: z.infer<typeof draftPayloadSchema>;
    let attempts = 0;
    let llmProvider = fixtureMode ? 'fixture' : 'primary';
    try {
      const llm = await completeJson({
        task: 'draft-body',
        zodSchema: draftPayloadSchema,
        messages,
        fixtureKey: `draft:${entry.silo}:${entry.id}`,
        ...(fixturePayload !== undefined ? { jsonFixture: fixturePayload } : {}),
      });
      payload = llm.parsed;
      attempts = llm.attempts;
      llmProvider = llm.provider;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      persistAttempt(`draft-body call failed: ${reason}`);
      notes.push(`${entry.id}: attempt ${prevAttempts + 1} failed — draft-body call failed: ${reason.slice(0, 200)}`);
      continue;
    }

    if (!fixtureMode) {
      // ⚠ fully-free USD governance: free.llm ops cost $0; requests recorded
      // truthfully (counted HTTP attempts incl. the one repair retry).
      appendSpend(registryDir, {
        service: 'free.llm',
        cost: 0,
        requests: Math.max(1, attempts),
        note: `draft-body for ${entry.id} via ${llmProvider} (env-configured free adapter)`,
      });
    }

    // 6) stage assertions — defined BEFORE any write; any failure = attempt.
    const failures: string[] = [];
    const words = payload.body.split(/\s+/).filter(Boolean).length;
    if (words < BAND[0] || words > BAND[1]) {
      failures.push(`body word band violated: word count ${words} (want ${BAND[0]}-${BAND[1]})`);
    }
    for (const h2 of parsed.h2s) {
      if (!payload.body.includes(`## ${h2}`)) {
        failures.push(`outline H2 missing from body: "${h2}"`);
      }
    }
    for (const faq of payload.faqs) {
      if (!pool.some((p) => normQ(p) === normQ(faq.q))) {
        failures.push(
          `faq question not in the paa provenance pool (invented questions are a hard violation): "${faq.q}"`,
        );
      }
    }
    if (parsed.hasComparisonSlot) {
      if (!payload.comparison) {
        failures.push('outline flags the [comparison-table slot] but the payload carries no comparison block');
      }
    } else if (payload.comparison) {
      failures.push(
        'payload carries a comparison block although the outline does not flag the [comparison-table slot]',
      );
    }
    if (failures.length > 0) {
      const reason = failures.join('; ');
      persistAttempt(reason);
      notes.push(`${entry.id}: attempt ${prevAttempts + 1} failed — ${reason}`);
      continue;
    }

    // 7) assemble + validate + write.
    const now = new Date().toISOString();
    const assembled = {
      title: payload.title,
      description: payload.description,
      slug: entry.id,
      publishedAt: now,
      updatedAt: now,
      faq: payload.faqs.map((f) => ({ q: f.q, a: f.a })),
      silo: entry.silo,
      tldr: payload.tldr,
      heroImage: { src: entry.images.hero.src, alt: entry.images.hero.alt },
      ...(parsed.hasComparisonSlot && payload.comparison
        ? { comparison: { ...payload.comparison, note: PRICING_NOTE } }
        : {}),
    };
    let frontmatter: Record<string, unknown>;
    try {
      frontmatter = draftSchema.parse(assembled) as Record<string, unknown>;
    } catch (err) {
      const detail =
        err instanceof z.ZodError
          ? err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
          : err instanceof Error
            ? err.message
            : String(err);
      persistAttempt(`draftSchema rejected the assembled frontmatter: ${detail}`);
      notes.push(
        `${entry.id}: attempt ${prevAttempts + 1} failed — draftSchema rejected the assembled frontmatter: ${detail.slice(0, 200)}`,
      );
      continue;
    }

    const mdxPath = join(postsDir, `${entry.id}.mdx`);
    const mdx = `---\n${frontmatterYaml(frontmatter as never)}\n---\n\n${payload.body}`;
    const tmpPath = `${mdxPath}.tmp`;
    mkdirSync(postsDir, { recursive: true }); // posts dir may not pre-exist (fresh clone / verify lane)
    writeFileSync(tmpPath, mdx, 'utf8');
    renameSync(tmpPath, mdxPath); // atomic write — a crash never half-lands a post

    // 8) gate BEFORE advance — exit 1 deletes the file; the entry stays outlined.
    const gate = spawnSync(process.execPath, [gateScript, postsDir], { encoding: 'utf8' });
    const gateOut = `${gate.stdout ?? ''}${gate.stderr ?? ''}`.trim();
    if (gate.status !== 0) {
      rmSync(mdxPath, { force: true });
      const reason = `template gate FAIL over the posts dir: ${gateOut.slice(0, 200)}`;
      persistAttempt(reason);
      notes.push(`${entry.id}: attempt ${prevAttempts + 1} failed — ${reason}`);
      continue;
    }

    // 9) advance + persist landed state (spend stays $0; reported via notes).
    advance(entry, 'drafted');
    entry.draft = {
      slug: entry.id,
      landedAt: new Date().toISOString(),
      attempts: (entry.draft?.attempts ?? prevAttempts) + 1,
    };
    entry.updatedAt = new Date().toISOString();
    persistEntry(registryDir, entry.silo, entry);
    advanced += 1;
    ctx.log(`${entry.id}: draft landed at ${mdxPath} (template gate PASS, ${prevAttempts + 1} attempt(s))`);
    notes.push(
      `${entry.id}: draft landed (template gate PASS) via ${llmProvider} — mdx written into the posts dir, registry advanced to drafted`,
    );
  }

  if (fixtureMode) {
    notes.push(`fixture mode: ${draftFixtureCalls.count} payload call(s) consumed this run (variants verified through the same zod gate)`);
  } else {
    notes.push('draft-body spend recorded on the free.llm axis at $0.00 (requests counted truthfully)');
  }
  return { advanced, rejected: 0, spentUsd: 0, notes };
}
