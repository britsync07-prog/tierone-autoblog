// Outline stage (PIPE-02, plan 03-03 task 3) — REWORKED (2026-10-17) for the
// ⚠ OWNER FULLY-FREE DIRECTIVE: the outline call goes through the single
// env-configurable OpenAI-compatible adapter in ../llm (task 'outline-body'
// = the strong-model long-structure slot; LLM_MODEL_CHEAP never serves it),
// with fixture payloads from <registryDir>/llm-fixtures.json as the
// deterministic verification lane.
//
// D-12 INVARIANT (the point of this stage): an entry only becomes 'outlined'
// after its outline artifact passes the zero-dep mechanical lint
// (scripts/check-outline.mjs, spawned per-file BEFORE the registry mutation).
// A lint failure leaves the entry at 'briefed' with the lint output in the
// run notes — the visible trail guarantees no draft spend ever inherits an
// unlinted outline (defense in depth: Plan 03-06's draft stage re-asserts
// outline.lint === 'pass' before its first LLM call).
//
// Flow per 'briefed' entry (oldest-updated first, crash-safe persistence):
//   1. The entry's brief artifact must exist at
//      <briefsDir>/{silo}/{id}-brief.md — otherwise park with a visible note
//      (an outline without its brief has no provenance to verify against).
//   2. One structured call turns the brief into {h1, meta, tldr, sections,
//      faqs, comparison}. FAQ questions must be copied VERBATIM from the
//      brief's `## FAQ candidate questions` section — the lint cross-checks
//      them, so invented questions fail the build. (Wave-2 reality: paa[] is
//      empty platform-wide, so those candidates are model-derived with honest
//      provenance — never labelled as captured PAA.)
//   3. Render + atomically write {id}-outline.md, spawn the lint on that
//      file, and only on lint pass set outline = { completedAt, lint: 'pass' }
//      and advance briefed -> outlined (D-09 +1 transition).
//   4. Real-mode calls are governed free requests: request-cap preflight per
//      call + one truthfully-counted 'free.llm' ledger op per completion;
//      fixture-mode calls make ZERO ledger ops. Real runs cap at
//      OUTLINE_REAL_RUN_PER_SILO_CAP entries per silo per run (D-09 slot
//      rule — observable, resumable runs; fixtures are exempt).
//
// Fail-closed preflight: when any eligible entry needs a REAL call,
// assertLlmReady() runs before ANY registry mutation, so missing
// LLM_BASE_URL/LLM_MODEL fails the stage honestly (npm run pipeline:outline
// without env prints LlmNoCredentialsError naming the env vars).

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { advance, loadShard, reject, saveShard } from '../registry';
import {
  appendSpend,
  assertRequestsAvailable,
  BudgetExhaustedError,
} from '../budget';
import {
  assertLlmReady,
  completeJson,
  LlmBadStructuredOutputError,
  LlmProvidersExhaustedError,
  readFixtureMap,
} from '../llm';
import type { LlmJson, LlmMessage, LlmProviderTag } from '../llm';
import type { RegistryEntry } from '../types';
import type { StageResult } from '../run';
import type { SiloSlug } from '../../silos';
import { SILO_SLUGS } from '../../silos';

/** Real-run slot cap (D-09): at most this many LLM-backed entries are
 * outlined per silo per run; the rest stay 'briefed' for the next run.
 * Fixture-backed entries are exempt (deterministic verification lane). */
export const OUTLINE_REAL_RUN_PER_SILO_CAP = 2;

/** Default committed-brief root (D-11) — outlines live next to their briefs. */
const DEFAULT_BRIEFS_DIR = 'content/briefs';

/** The zod gate for the outline payload (plan task-3 contract). Deliberately
 * LOOSE: it checks the JSON shape only — the mechanical quality gates (H1
 * 50-60, meta 150-160, TL;DR 10-100 words, >=3 H2s, 3-5 FAQs, provenance
 * cross-check) are enforced by scripts/check-outline.mjs AFTER rendering, so
 * a lint failure — not a schema throw — is what keeps an entry at 'briefed'
 * with the precise, fixable FAIL lines in the notes (D-12 layering). */
export const OutlinePayloadSchema = z.object({
  h1: z.string().min(1),
  meta: z.string().min(1),
  tldr: z.string().min(1),
  sections: z
    .array(
      z.object({
        h2: z.string().min(1),
        h3: z.array(z.string().min(1)).default([]),
        words: z.number().int().positive().default(300),
      }),
    )
    .min(1),
  faqs: z
    .array(
      z.object({
        q: z.string().min(1),
        angle: z.string().min(1),
      }),
    )
    .min(1)
    .max(8),
  comparison: z.boolean().default(false),
});
export type OutlinePayload = z.infer<typeof OutlinePayloadSchema>;

/** Loose stage context — same contract note as stages/brief.ts: the
 * orchestrated runner passes full APIs; the plan verify + tests pass null,
 * and this stage binds the RAW registry/budget functions to ctx.registryDir
 * (single code path). */
export interface OutlineStageContext {
  registryDir: string;
  registry: unknown;
  budget: unknown;
  log: (message: string) => void;
}

/** Confinement guard (T-03-01): the outline path can never escape the
 * briefs root (id is slug-validated by loadShard; silo is whitelisted). */
function outlineFilePath(briefsDir: string, silo: SiloSlug, id: string): string {
  const root = resolve(briefsDir);
  const file = resolve(root, silo, `${id}-outline.md`);
  if (!file.startsWith(root + sep)) {
    throw new Error(`outline path escapes briefs directory: ${file}`);
  }
  return file;
}

/** Atomic write (tmp + rename) — a crash never leaves a half-written outline
 * that a later run might mistake for a lint-passing artifact. */
function writeOutlineFile(briefsDir: string, silo: SiloSlug, entry: RegistryEntry, markdown: string): string {
  const file = outlineFilePath(briefsDir, silo, entry.id);
  mkdirSync(resolve(briefsDir, silo), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, markdown, 'utf8');
  renameSync(tmp, file);
  return file;
}

/** Persist a (possibly mutated) entry back into its silo shard by id. */
function persistEntry(registryDir: string, silo: SiloSlug, entry: RegistryEntry): void {
  const shard = loadShard(registryDir, silo);
  const idx = shard.keywords.findIndex((e) => e.id === entry.id);
  if (idx >= 0) shard.keywords[idx] = entry;
  else shard.keywords.push(entry);
  shard.updatedAt = new Date().toISOString();
  saveShard(registryDir, silo, shard);
}

/** Pull the `- Hero:` / `- In-article:` concepts out of the brief artifact —
 * the outline never invents image concepts the brief did not propose. */
function briefImageLine(briefMd: string, label: 'Hero' | 'In-article'): string | null {
  const m = new RegExp(`^- ${label}: (.+)$`, 'm').exec(briefMd);
  return m === null ? null : m[1].trim();
}

/** The outline prompt (real mode). The brief is internal trusted data; the
 * FAQ rule is stated hard because the mechanical gate enforces it. */
export function outlineMessages(entry: RegistryEntry, briefMd: string): LlmMessage[] {
  const system =
    'You are the outline-writing step of a fully-free automated blogging pipeline. The gap brief you receive is internal trusted data. Reply with a single valid JSON object only — no prose, no markdown fences.';
  const user = [
    `Keyword: "${entry.keyword}"`,
    'Approved gap brief (source of truth for gaps, image concepts, and FAQ candidates):',
    '---',
    briefMd.slice(0, 6000),
    '---',
    'Task: turn this brief into a long-form article outline. Requirements:',
    '- h1: the article H1, 50-60 characters',
    '- meta: the meta description, 150-160 characters',
    '- tldr: a TL;DR of 10-100 words',
    '- sections: 3-6 H2 sections in reading order, each with a word target and optional H3s',
    '- faqs: 3-5 questions copied VERBATIM from the brief\'s FAQ candidate questions (a mechanical gate cross-checks them — invented questions fail the build), each with a one-line answer angle',
    '- comparison: true only when a feature/verdict comparison table is warranted by the brief',
    '',
    'Return JSON with EXACTLY this shape:',
    '{"h1":"...","meta":"...","tldr":"...","sections":[{"h2":"...","h3":["..."],"words":400}],"faqs":[{"q":"<verbatim from the brief>","angle":"..."}],"comparison":true}',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function renderOutline(entry: RegistryEntry, payload: OutlinePayload, provider: LlmProviderTag, hero: string | null, inArticle: string | null): string {
  const lines: string[] = [];
  lines.push(`# Outline: ${entry.keyword}`, '');
  lines.push(`- Silo: ${entry.silo} | Brief: ${entry.id}-brief.md | Lint target: check:outline`);
  lines.push(`- Outline generated: ${new Date().toISOString()} (provider: ${provider})`);
  lines.push('', '## Meta', '');
  lines.push(`- H1 (50-60 chars): ${payload.h1}`);
  lines.push(`- Meta description (150-160 chars): ${payload.meta}`);
  lines.push(`- TL;DR (<=100 words): ${payload.tldr}`);
  lines.push(`- Slug: ${entry.id}`);
  lines.push('', '## Structure', '');
  for (const s of payload.sections) {
    lines.push(`## ${s.h2} — target ~${s.words} words`, '');
    for (const h3 of s.h3) lines.push(`### ${h3}`, '');
  }
  if (payload.comparison) lines.push('[comparison-table slot]', '');
  lines.push("## FAQs (derived from the brief's candidate questions — not captured PAA)", '');
  for (const f of payload.faqs) {
    lines.push(`- Q: ${f.q}`);
    lines.push(`  A-angle: ${f.angle}`);
  }
  lines.push('', '## Conclusion + CTA', '');
  lines.push('- CTA: link to /about (template constant)');
  lines.push('', '## Image slots', '');
  lines.push(`- hero: ${hero ?? '16:9 hero concept to be briefed (none captured in the brief)'} (ALWAYS)`);
  lines.push(`- in-article-1: ${inArticle ?? 'none'}`);
  lines.push('- in-article-2: none');
  lines.push('');
  return lines.join('\n');
}

/**
 * Stage entrypoint (03-01 contract): `runStage(ctx) -> StageResult`.
 * `opts.briefsDir` overrides the committed-brief root (tests pass a sandbox
 * dir); production callers omit it for `content/briefs`.
 */
export async function runStage(ctx: OutlineStageContext, opts: { briefsDir?: string } = {}): Promise<StageResult> {
  const briefsDir = opts.briefsDir ?? DEFAULT_BRIEFS_DIR;
  const registryDir = ctx.registryDir;
  const notes: string[] = [];
  let advanced = 0;
  let rejected = 0;
  let realCalls = 0;
  let realRequests = 0;
  let fixtureEntries = 0;
  let stopped = false;

  const fixtureMap = readFixtureMap(registryDir);
  const fixtureFor = (silo: SiloSlug, id: string): unknown | undefined => {
    const key = `outline:${silo}:${id}`;
    return Object.hasOwn(fixtureMap, key) ? fixtureMap[key] : undefined;
  };

  // FAIL-CLOSED PREFLIGHT (before ANY registry mutation): any eligible entry
  // needing a real LLM call demands the free-endpoint env up front.
  let needsReal = false;
  for (const silo of SILO_SLUGS) {
    if (needsReal) break;
    for (const e of loadShard(registryDir, silo).keywords) {
      if (e.stage !== 'briefed') continue;
      if (fixtureFor(silo, e.id) === undefined) {
        needsReal = true;
        break;
      }
    }
  }
  if (needsReal) assertLlmReady();

  const lintScript = resolve(process.cwd(), 'scripts', 'check-outline.mjs');
  if (!existsSync(lintScript)) {
    throw new Error(`outline lint gate missing: ${lintScript} — the D-12 gate cannot run without it`);
  }

  for (const silo of SILO_SLUGS) {
    let realProcessedThisSilo = 0;
    const entries = loadShard(registryDir, silo)
      .keywords.filter((e) => e.stage === 'briefed')
      .sort((a, b) => {
        const byDate = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
        if (!Number.isNaN(byDate) && byDate !== 0) return byDate;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

    for (const entry of entries) {
      if (stopped) break;

      // The brief artifact is the outline's provenance — park without one.
      const briefFile = join(briefsDir, silo, `${entry.id}-brief.md`);
      if (!existsSync(briefFile)) {
        notes.push(`${entry.id}: parked at 'briefed' — brief artifact missing at ${join(silo, `${entry.id}-brief.md`)} (an outline is never written without its brief)`);
        continue;
      }

      const fixture = fixtureFor(silo, entry.id);
      const isFixture = fixture !== undefined;
      if (!isFixture) {
        if (realProcessedThisSilo >= OUTLINE_REAL_RUN_PER_SILO_CAP) {
          notes.push(`${entry.id}: left at 'briefed' — real-run cap of ${OUTLINE_REAL_RUN_PER_SILO_CAP} LLM-backed entries per silo per run reached (D-09 slot rule; resume next run)`);
          continue;
        }
        try {
          assertRequestsAvailable(registryDir, 1);
        } catch (err) {
          if (err instanceof BudgetExhaustedError) {
            notes.push(`${entry.id}: left at 'briefed' — ${err.message}`);
            stopped = true;
            break;
          }
          throw err;
        }
      }

      let llm: LlmJson<OutlinePayload>;
      try {
        llm = await completeJson({
          // Long-structure task = the strong model slot (never LLM_MODEL_CHEAP).
          task: 'outline-body',
          zodSchema: OutlinePayloadSchema,
          messages: outlineMessages(entry, readFileSync(briefFile, 'utf8')),
          fixtureKey: `outline:${silo}:${entry.id}`,
          ...(isFixture ? { jsonFixture: fixture } : {}),
        });
      } catch (err) {
        if (err instanceof LlmProvidersExhaustedError) {
          notes.push(`${entry.id}: parked at 'briefed' — ${err.message.slice(0, 200)}`);
          stopped = true;
          break;
        }
        if (err instanceof LlmBadStructuredOutputError) {
          notes.push(`${entry.id}: parked at 'briefed' — ${err.message.slice(0, 200)}`);
          realProcessedThisSilo += 1;
          continue;
        }
        throw err; // LlmNoCredentialsError and friends fail the stage honestly
      }

      if (isFixture) {
        fixtureEntries += 1;
      } else {
        realCalls += 1;
        realProcessedThisSilo += 1;
        realRequests += llm.attempts;
        appendSpend(registryDir, {
          service: 'free.llm',
          cost: 0,
          requests: llm.attempts,
          keywords: [entry.keyword],
          note: `outline generation via ${llm.provider} (OpenAI-compatible free endpoint)`,
        });
      }

      const briefMd = readFileSync(briefFile, 'utf8');
      const markdown = renderOutline(
        entry,
        llm.parsed,
        llm.provider,
        briefImageLine(briefMd, 'Hero'),
        briefImageLine(briefMd, 'In-article'),
      );
      const outlineFile = writeOutlineFile(briefsDir, silo, entry, markdown);

      // D-12 LINT GATE — spawn BEFORE any registry mutation of this entry.
      const lint = spawnSync(process.execPath, [lintScript, outlineFile], { encoding: 'utf8' });
      const lintOut = `${lint.stdout ?? ''}${lint.stderr ?? ''}`.trim();
      if (lint.status !== 0) {
        rmSync(outlineFile, { force: true });
        notes.push(`${entry.id}: outline lint FAILED — left at 'briefed', no outlined status, no draft spend (D-12). Lint output: ${lintOut.slice(0, 800)}`);
        ctx.log(`${entry.id}: outline lint FAILED — left at 'briefed' (D-12)`);
        continue;
      }

      entry.outline = { completedAt: new Date().toISOString(), lint: 'pass' };
      advance(entry, 'outlined');
      persistEntry(registryDir, silo, entry);
      advanced += 1;
      ctx.log(`${entry.id}: outline committed + lint pass -> advanced to 'outlined'`);
    }
  }

  if (fixtureEntries > 0 && realCalls === 0) {
    notes.push(`fixture mode: ${fixtureEntries} outline(s) generated from llm-fixtures.json payloads — zero network, zero ledger ops`);
  }
  if (realCalls > 0) {
    notes.push(`LLM requests recorded this run: ${realRequests} across ${realCalls} real completion(s) (free.llm ledger) | spend $0.00 (fully-free platform)`);
  }

  return { advanced, rejected, spentUsd: 0, notes };
}
