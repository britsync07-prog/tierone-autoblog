// TDD RED tests for lib/pipeline/stages/draft.ts (Plan 03-06 task 2):
// the outlined -> drafted stage with gate-before-advance, in fixture mode
// (PIPELINE_DRAFT_FIXTURE=1, zero network, zero LLM spend).
//
// Coverage (plan task-2 behavior):
//  T1 GOOD fixture run -> attempt 1 lands .mdx (draftSchema shape), template
//     gate runs over the posts dir and passes, entry advances to 'drafted'
//     with draft {slug, landedAt, attempts:1}; StageResult advanced=1.
//  T2 rerun -> idempotent skid (advanced=0, zero fixture calls consumed, note).
//  T3 e2 has no images.completedAt -> no call AT ALL, stays 'outlined', note
//     names the missing precondition (same for e3's outline.completedAt).
//  T4 BAD_FAQ payload (invented question) -> attempt charged, lastError names
//     the paa provenance pool, no file written, fixture registry stays valid.
//  T5 BAD_BAND payload (1499 words) -> lastError names the word band;
//     BAD_H2 payload -> lastError names the missing outline heading.
//  T6 BAD_COMPARISON payload (comparison without the slot marker) ->
//     attempt named; conversely GOOD_COMPARISON against a marker-bearing
//     outline clone -> frontmatter carries comparison with the pricing note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const FIXTURE_REG = join(ROOT, 'test', 'fixtures', 'pipeline', 'draft-registry');
const FIXTURE_BRIEFS = join(ROOT, 'test', 'fixtures', 'pipeline', 'draft-fixtures', 'briefs');
const OUTLINE_FIX = join(FIXTURE_BRIEFS, 'ai-writing', 'fixture-draft-outline.md');
const E1 = 'fixture-draft';

/** The provenance pool shared by the fixture registry and fixture payloads. */
const PAA = [
  'Do AI writing tools hurt SEO rankings?',
  'Which AI writing tool is best for beginners?',
  'Can AI writing tools pass plagiarism checks?',
  'How much should I pay for an AI writing assistant?',
];

const ENV_KEYS = ['PIPELINE_DRAFT_FIXTURE', 'PIPELINE_DRAFT_VARIANT'];

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = new Map(ENV_KEYS.map((k) => [k, process.env[k]] as const));
  try {
    for (const k of ENV_KEYS) {
      if (vars[k] === undefined) delete process.env[k];
      else process.env[k] = vars[k] as string;
    }
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      const v = prev.get(k);
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

interface Sandbox {
  base: string;
  registryDir: string;
  briefsDir: string;
  postsDir: string;
}

function makeSandbox(
  opts: { withoutE1?: boolean; withComparisonMarker?: boolean } = {},
): Sandbox {
  const base = mkdtempSync(join(tmpdir(), 'draft-stage-'));
  const s: Sandbox = {
    base,
    registryDir: join(base, 'registry'),
    briefsDir: join(base, 'briefs'),
    postsDir: join(base, 'posts'),
  };
  cpSync(FIXTURE_REG, s.registryDir, { recursive: true });
  cpSync(FIXTURE_BRIEFS, s.briefsDir, { recursive: true });
  mkdirSync(s.postsDir, { recursive: true });
  if (opts.withoutE1) {
    const p = join(s.registryDir, 'ai-writing', 'registry.json');
    const shard = JSON.parse(readFileSync(p, 'utf8'));
    shard.keywords = shard.keywords.filter((k: { id: string }) => k.id !== E1);
    writeFileSync(p, `${JSON.stringify(shard, null, 2)}\n`, 'utf8');
  }
  if (opts.withComparisonMarker) {
    appendFileSync(OUTLINE_FIX.replace(FIXTURE_BRIEFS, s.briefsDir), '\n[comparison-table slot]\n');
  }
  return s;
}

function ctx(s: Sandbox): {
  registryDir: string;
  briefsDir: string;
  postsDir: string;
  log: (m: string) => void;
} {
  return { registryDir: s.registryDir, briefsDir: s.briefsDir, postsDir: s.postsDir, log: () => {} };
}

const noopLog = (): void => {};

async function importDraftModule(): Promise<{
  runStage: (c: unknown) => Promise<{ advanced: number; rejected: number; spentUsd: number; notes: string[] }>;
  draftFixtureCalls: { count: number };
  DRAFT_FIXTURE_PAYLOADS: Record<string, unknown>;
}> {
  const mod = (await import(`../../lib/pipeline/stages/${'draft'}`)) as unknown as {
    runStage: (c: unknown) => Promise<{ advanced: number; rejected: number; spentUsd: number; notes: string[] }>;
    draftFixtureCalls: { count: number };
    DRAFT_FIXTURE_PAYLOADS: Record<string, unknown>;
  };
  return mod;
}

function readShard(
  registryDir: string,
  silo: string,
): { keywords: Array<Record<string, unknown>> } {
  return JSON.parse(readFileSync(join(registryDir, silo, 'registry.json'), 'utf8'));
}

interface DraftTrail {
  slug: string;
  landedAt?: string;
  attempts: number;
  lastError?: string;
}

interface EntryShape {
  id: string;
  stage: string;
  draft?: DraftTrail;
  images?: unknown;
}

function entry(s: Sandbox, id: string): EntryShape {
  const shard = readShard(s.registryDir, 'ai-writing');
  const e = shard.keywords.find((k) => k.id === id);
  assert.ok(e, `entry ${id} missing from the sandbox shard`);
  return e as unknown as EntryShape;
}

/** Test-local mirror of the outline parser (blame to check-outline rule 4):
 * template-shaped H2s under `## Structure` only. */
function outlineH2s(markdown: string): string[] {
  const out: string[] = [];
  let inStructure = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.trimEnd() === '## Structure') {
      inStructure = true;
      continue;
    }
    const m = inStructure ? /^## (.+?) — target ~\d+ words\s*$/.exec(line) : null;
    if (m) {
      out.push(m[1]);
      continue;
    }
    if (inStructure && /^## /.test(line)) break;
  }
  return out;
}

test('T1: GOOD fixture run → advanced=1, landed mdx passes draftSchema shape + template gate', async () => {
  const s = makeSandbox();
  const result = await withEnv({ PIPELINE_DRAFT_FIXTURE: '1' }, async () => {
    const m = await importDraftModule();
    m.draftFixtureCalls.count = 0;
    const r = await m.runStage(ctx(s));
    return { r, calls: m.draftFixtureCalls.count };
  });
  assert.equal(result.r.advanced, 1, `notes: ${result.r.notes.join(' | ')}`);
  assert.equal(result.r.spentUsd, 0, 'fixture run spends nothing');
  assert.equal(result.calls, 1, 'exactly one fixture payload consumed');

  const d = entry(s, E1);
  assert.equal(d.stage, 'drafted', `stage=${d.stage}, notes: ${result.r.notes.join(' | ')}`);
  assert.ok(d.draft, 'draft state must be recorded');
  assert.equal(d.draft?.attempts, 1);
  assert.ok(d.draft?.landedAt && !Number.isNaN(Date.parse(d.draft.landedAt)), 'landedAt must be an ISO date');
  assert.equal(d.draft?.slug, E1);

  const raw = readFileSync(join(s.postsDir, `${E1}.mdx`), 'utf8');
  assert.match(raw, /^---\r?\n/, 'frontmatter fences present');
  assert.match(raw, /^title: "How the TierOne AutoBlog Draft Pipeline Works Day One"$/m);
  assert.match(raw, /^publishedAt: "\d{4}-\d{2}-\d{2}T/m);
  assert.match(raw, /^heroImage:\r?\n  src: "\/images\/fixture-draft\/hero\.avif"$/m, 'heroImage comes from the entry images');
  assert.ok((raw.match(/^  - q: "/gm) ?? []).length === 3, 'faq block has 3 q lines');
  for (const q of PAA.slice(0, 3)) {
    assert.ok(raw.includes(q), `landed faq question proven from paa: ${q}`);
  }
  assert.ok(!/^comparison:/m.test(raw), 'outline without the marker must NOT assemble comparison frontmatter');
  assert.ok((raw.match(/^## /gm) ?? []).length >= 3, 'body keeps >=3 H2s for the gate');
  assert.match(raw, /\/about/, 'body carries the /about CTA');
  assert.ok(!/^# /m.test(raw), 'body never carries an H1');

  // the template gate itself (the same spawn the stage made) passes over the posts dir
  const g = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'check-template.mjs'), s.postsDir],
    { encoding: 'utf8' },
  );
  assert.equal(g.status, 0, `gate must pass over the landed post:\n${String(g.stdout)}${String(g.stderr)}`);
  assert.ok(result.r.notes.some((n) => /gate/.test(n)), `gate verdict visible in notes: ${result.r.notes.join(' | ')}`);
});

test('T2: rerun after landing → idempotent skip (advanced=0, zero fixture calls, note)', async () => {
  const s = makeSandbox();
  const result = await withEnv({ PIPELINE_DRAFT_FIXTURE: '1' }, async () => {
    const m = await importDraftModule();
    m.draftFixtureCalls.count = 0;
    const r1 = await m.runStage(ctx(s));
    const callsFirst = m.draftFixtureCalls.count;
    const r2 = await m.runStage(ctx(s));
    return { r1, r2, callsFirst, callsSecond: m.draftFixtureCalls.count - callsFirst };
  });
  assert.equal(result.r1.advanced, 1);
  assert.equal(result.r2.advanced, 0, `rerun must not requeue a drafted entry; notes: ${result.r2.notes.join(' | ')}`);
  assert.equal(result.callsSecond, 0, 'rerun consumed zero fixture payloads');
  assert.ok(result.r2.notes.length > 0, 'rerun leaves a visible skip note');
});

test('T3: e2 has no images.completedAt → zero calls for it, stays outlined, note names the precondition', async () => {
  const s = makeSandbox({ withoutE1: true });
  const result = await withEnv({ PIPELINE_DRAFT_FIXTURE: '1' }, async () => {
    const m = await importDraftModule();
    m.draftFixtureCalls.count = 0;
    const r = await m.runStage(ctx(s));
    return { r, calls: m.draftFixtureCalls.count };
  });
  assert.equal(result.r.advanced, 0);
  assert.equal(result.calls, 0, 'no draft-body call may run before preconditions hold');
  const note = result.r.notes.join(' | ');
  assert.match(note, /fixture-noimages/, 'e2 leaves a note');
  // e2's note names the images precondition; e3 (also in queue under the cap) names outline state
  const notes = result.r.notes.filter((n) => n.startsWith('fixture-'));
  const n2 = notes.find((n) => n.startsWith('fixture-noimages'));
  const n3 = notes.find((n) => n.startsWith('fixture-nocompletedat'));
  assert.ok(n2 && /images/.test(n2), `e2 note names images precondition: ${String(n2)}`);
  assert.ok(n3 && /outline/.test(n3), `e3 note names outline precondition: ${String(n3)}`);
  const d2 = entry(s, 'fixture-noimages');
  assert.equal(d2.stage, 'outlined');
  assert.equal(d2.draft, undefined, 'precondition skips never charge attempts');
});

test('T4: BAD_FAQ payload (invented question) → attempt charged, lastError names paa, no file, registry valid', async () => {
  const s = makeSandbox();
  const result = await withEnv(
    { PIPELINE_DRAFT_FIXTURE: '1', PIPELINE_DRAFT_VARIANT: 'BAD_FAQ' },
    async () => {
      const m = await importDraftModule();
      m.draftFixtureCalls.count = 0;
      const r = await m.runStage(ctx(s));
      return { r, calls: m.draftFixtureCalls.count };
    },
  );
  assert.equal(result.r.advanced, 0, `notes: ${result.r.notes.join(' | ')}`);
  const d = entry(s, E1);
  assert.equal(d.stage, 'outlined', 'failed attempt keeps the stage outlined');
  assert.equal(d.draft?.attempts, 1);
  assert.ok(d.draft?.lastError && /paa/.test(d.draft.lastError), `lastError=${d.draft?.lastError}`);
  assert.ok(!existsSync(join(s.postsDir, `${E1}.mdx`)), 'no file written on assertion failure');
  // check:registry parity on the fixture registry: the trail shard still validates
  const reg = await import('../../lib/pipeline/registry');
  assert.doesNotThrow(() => reg.loadShard(s.registryDir, 'ai-writing'));
});

test('T5: BAD_BAND payload (1499 words) and BAD_H2 payload → lastError names the band, then the heading', async () => {
  const s1 = makeSandbox();
  const band = await withEnv(
    { PIPELINE_DRAFT_FIXTURE: '1', PIPELINE_DRAFT_VARIANT: 'BAD_BAND' },
    async () => {
      const m = await importDraftModule();
      m.draftFixtureCalls.count = 0;
      return m.runStage(ctx(s1));
    },
  );
  const d1 = entry(s1, E1);
  assert.equal(d1.stage, 'outlined');
  assert.ok(d1.draft?.lastError && /word band|1499/.test(d1.draft.lastError), `lastError=${d1.draft?.lastError}`);
  assert.ok(!existsSync(join(s1.postsDir, `${E1}.mdx`)), 'band failure leaves no file');

  const s2 = makeSandbox();
  const h2 = await withEnv(
    { PIPELINE_DRAFT_FIXTURE: '1', PIPELINE_DRAFT_VARIANT: 'BAD_H2' },
    async () => {
      const m = await importDraftModule();
      m.draftFixtureCalls.count = 0;
      return m.runStage(ctx(s2));
    },
  );
  const d2 = entry(s2, E1);
  const expectedH2 = outlineH2s(readFileSync(OUTLINE_FIX, 'utf8'))[1];
  assert.ok(expectedH2 && expectedH2.length > 0, 'test parses the outline H2s itself');
  assert.ok(
    d2.draft?.lastError && d2.draft.lastError.includes(expectedH2) && /outline H2 missing/.test(d2.draft.lastError),
    `lastError=${d2.draft?.lastError}`,
  );
});

test('T6: BAD_COMPARISON payload → attempt named; marker-bearing outline + GOOD_COMPARISON → priced comparison frontmatter', async () => {
  const s1 = makeSandbox();
  const misuse = await withEnv(
    { PIPELINE_DRAFT_FIXTURE: '1', PIPELINE_DRAFT_VARIANT: 'BAD_COMPARISON' },
    async () => {
      const m = await importDraftModule();
      m.draftFixtureCalls.count = 0;
      return m.runStage(ctx(s1));
    },
  );
  const d1 = entry(s1, E1);
  assert.equal(d1.stage, 'outlined');
  assert.ok(d1.draft?.lastError && /comparison/.test(d1.draft.lastError), `lastError=${d1.draft?.lastError}`);

  // GOOD_COMPARISON against a tmp clone of the briefs dir with the marker appended
  const s2 = makeSandbox({ withComparisonMarker: true });
  const good = await withEnv(
    { PIPELINE_DRAFT_FIXTURE: '1', PIPELINE_DRAFT_VARIANT: 'GOOD_COMPARISON' },
    async () => {
      const m = await importDraftModule();
      m.draftFixtureCalls.count = 0;
      return m.runStage(ctx(s2));
    },
  );
  assert.equal(good.advanced, 1, `notes: ${good.notes.join(' | ')}`);
  const d2 = entry(s2, E1);
  assert.equal(d2.stage, 'drafted');
  const raw = readFileSync(join(s2.postsDir, `${E1}.mdx`), 'utf8');
  assert.match(raw, /^comparison:$/m, 'marker-bearing outline assembles comparison frontmatter');
  assert.match(
    raw,
    /note: "Prices shift often — confirm pricing on vendor pages before choosing\."/,
    'comparison note is the pricing caution template constant',
  );
});

test('cleanup: disposable sandbox temps remove cleanly (family rule: never commit mutated clones)', () => {
  // guard the real registry against accidental fixture-mode leakage: no drafted state there
  const realReg = join(ROOT, 'content', 'keywords', 'ai-writing', 'registry.json');
  if (existsSync(realReg)) {
    const shard = JSON.parse(readFileSync(realReg, 'utf8'));
    const leaked = shard.keywords.some((k: { id: string; stage: string }) => k.id === E1);
    assert.ok(!leaked, 'fixture entries must never appear in the real registry');
  }
});
