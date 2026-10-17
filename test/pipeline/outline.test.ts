// TDD tests for lib/pipeline/stages/outline.ts + scripts/check-outline.mjs
// (Plan 03-03 task 3). The outline stage consumes 'briefed' entries, writes
// {id}-outline.md, and spawns the zero-dep lint gate BEFORE advancing —
// D-12: no outlined status without a passing structure lint, so no draft
// spend can ever inherit an unlinted outline. Fixture payloads flow through
// the SAME completeJson zod gate as the brief stage (zero network).
//
// Wave-2 reality honored: paa[] is empty platform-wide, so outline FAQs come
// from the brief's `## FAQ candidate questions` section (derived provenance,
// honestly labelled) — the lint cross-checks against THAT section, never
// claiming captured PAA that does not exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runStage as runBriefStage } from '../../lib/pipeline/stages/brief';
import { runStage as runOutlineStage } from '../../lib/pipeline/stages/outline';

const CLONE = resolve('test/fixtures/pipeline/registry-clones');
const LINT_SCRIPT = resolve('scripts/check-outline.mjs');

/** Exactly 140 chars — the plan's bad-fixture meta length (below the 150-160
 * window). The lint must fail it with a precise length FAIL line. */
const BAD_META_140 =
  'We ran the three fixture calendar apps side by side on current versions and scored verdicts, hands-on scheduling speeds, and the trade-offs.';

interface Sandbox {
  registryDir: string;
  briefsDir: string;
  cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'outline-stage-'));
  const registryDir = join(root, 'registry');
  cpSync(CLONE, registryDir, { recursive: true });
  return {
    registryDir,
    briefsDir: join(root, 'briefs'),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function ctxFor(sandbox: Sandbox): {
  registryDir: string;
  registry: null;
  budget: null;
  log: (m: string) => void;
} {
  const lines: string[] = [];
  return {
    registryDir: sandbox.registryDir,
    registry: null,
    budget: null,
    log: (m: string) => lines.push(m),
  };
}

test('outline: briefed entry -> {id}-outline.md written, lint pass, advanced to outlined (idempotent on rerun)', async () => {
  const sandbox = makeSandbox();
  try {
    const ctx = ctxFor(sandbox);
    // Chain: the brief stage runs first so the outline stage has a real brief
    // artifact (with its FAQ candidate section) to outline from.
    await runBriefStage(ctx, { briefsDir: sandbox.briefsDir });

    const result = await runOutlineStage(ctx, { briefsDir: sandbox.briefsDir });
    assert.ok(result.advanced >= 1, `expected >=1 advanced, got ${result.advanced} (notes: ${result.notes.join('; ')})`);
    assert.equal(result.spentUsd, 0, 'fully-free platform: spend is always $0');

    const file = join(sandbox.briefsDir, 'ai-productivity', 'fixture-serp-alpha-outline.md');
    assert.ok(existsSync(file), 'outline artifact must be committed under briefs/{silo}/');
    const md = readFileSync(file, 'utf8');
    assert.match(md, /^# Outline: fixture keyword alpha$/m);
    assert.match(md, /- H1 \(50-60 chars\): Fixture Keyword Alpha: The Current-Version Verdict Table$/m);
    assert.match(md, /- Meta description \(150-160 chars\): /);
    assert.match(md, /- TL;DR \(<=100 words\): /);
    assert.match(md, /- Slug: fixture-serp-alpha$/m);
    assert.match(md, /## Structure/);
    assert.match(md, /^## Feature-by-feature comparison — target ~400 words$/m);
    assert.match(md, /\[comparison-table slot\]/);
    // FAQ questions copied from the brief's candidate list (derived provenance)
    assert.match(md, /## FAQs \(derived from the brief's candidate questions/);
    assert.match(md, /- Q: Which fixture calendar app schedules tasks fastest\?/);
    assert.match(md, /  A-angle: /);
    assert.match(md, /## Conclusion \+ CTA/);
    assert.match(md, /- hero: Split 16:9 mockup of the two calendar apps side by side under a verdict badge/);

    // shard persisted the promotion with the lint-proof (D-12)
    const shard = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-productivity', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; stage: string; outline?: { completedAt: string; lint: string } }>;
    };
    const outlined = shard.keywords.find((e) => e.id === 'fixture-serp-alpha');
    assert.ok(outlined);
    assert.equal(outlined.stage, 'outlined');
    assert.equal(outlined.outline?.lint, 'pass');
    assert.ok(outlined.outline && outlined.outline.completedAt.length > 0);

    // fixture mode: zero network -> zero ledger ops
    assert.equal(existsSync(join(sandbox.registryDir, 'spend-ledger.json')), false);

    // idempotent rerun: already-outlined entries are skipped
    const second = await runOutlineStage(ctx, { briefsDir: sandbox.briefsDir });
    assert.equal(second.advanced, 0, 'already-outlined entries must not re-outline');
  } finally {
    sandbox.cleanup();
  }
});

test('outline: lint FAIL -> entry stays briefed with the lint output in notes (D-12: no draft spend downstream)', async () => {
  const sandbox = makeSandbox();
  try {
    const ctx = ctxFor(sandbox);
    await runBriefStage(ctx, { briefsDir: sandbox.briefsDir });

    // Sabotage: replace the fixture map so alpha's outline payload is valid
    // for the stage zod gate but FAILS the mechanical lint (meta 140 chars,
    // only 2 FAQs — the plan's exact bad shape).
    const sabotaged = {
      'outline:ai-productivity:fixture-serp-alpha': {
        h1: 'Fixture Keyword Alpha: The Current-Version Verdict Table',
        meta: BAD_META_140,
        tldr: 'We tested the three fixture calendar apps on their current versions and built a feature-by-feature verdict table with measured scheduling speed.',
        sections: [
          { h2: 'Quick verdict: which fixture calendar app to pick', h3: [], words: 200 },
          { h2: 'Feature-by-feature comparison', h3: [], words: 400 },
          { h2: 'Pricing and trade-offs', h3: [], words: 300 },
        ],
        faqs: [
          { q: 'Which fixture calendar app schedules tasks fastest?', angle: 'State the measured winner.' },
          { q: 'Is the fixture calendar app free?', angle: 'Free-tier limits versus paid tiers.' },
        ],
        comparison: false,
      },
    };
    writeFileSync(join(sandbox.registryDir, 'llm-fixtures.json'), JSON.stringify(sabotaged), 'utf8');

    const result = await runOutlineStage(ctx, { briefsDir: sandbox.briefsDir });
    assert.equal(result.advanced, 0, 'a lint-failing outline must never advance');

    const shard = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-productivity', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; stage: string; outline?: unknown }>;
    };
    const entry = shard.keywords.find((e) => e.id === 'fixture-serp-alpha');
    assert.ok(entry);
    assert.equal(entry.stage, 'briefed', 'entry stays briefed on lint failure');
    assert.equal(entry.outline, undefined, 'no outline completion proof without a passing lint');

    // the note carries the lint output (visible trail)
    const notes = result.notes.join('\n');
    assert.match(notes, /150-160/, 'lint FAIL line for the 140-char meta must surface in notes');
    assert.match(notes, /FAQ/, 'lint FAIL line for the 2-FAQ block must surface in notes');

    // the failed outline file stays on disk for inspection (visible trail)
    const file = join(sandbox.briefsDir, 'ai-productivity', 'fixture-serp-alpha-outline.md');
    assert.ok(existsSync(file));
  } finally {
    sandbox.cleanup();
  }
});

test('outline: briefed entry without its brief artifact -> parked with a visible note (no invention)', async () => {
  const sandbox = makeSandbox();
  try {
    const ctx = ctxFor(sandbox);
    await runBriefStage(ctx, { briefsDir: sandbox.briefsDir });
    const briefFile = join(sandbox.briefsDir, 'ai-productivity', 'fixture-serp-alpha-brief.md');
    rmSync(briefFile);

    const result = await runOutlineStage(ctx, { briefsDir: sandbox.briefsDir });
    assert.equal(result.advanced, 0);
    const notes = result.notes.join('\n');
    assert.match(notes, /fixture-serp-alpha/);
    assert.match(notes, /brief (artifact )?missing/i);

    const shard = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-productivity', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; stage: string }>;
    };
    assert.equal(shard.keywords.find((e) => e.id === 'fixture-serp-alpha')?.stage, 'briefed');
  } finally {
    sandbox.cleanup();
  }
});

test('check-outline.mjs: GOOD fixture dir -> exit 0 with N passed', () => {
  const res = spawnSync(process.execPath, [LINT_SCRIPT, resolve('test/fixtures/pipeline/outline-fixtures/good')], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, `expected exit 0, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.match(res.stdout, /\d+ passed/);
});

test('check-outline.mjs: BAD fixture dir -> exit 1 with specific FAIL lines (meta length, FAQ count, invented FAQ)', () => {
  const res = spawnSync(process.execPath, [LINT_SCRIPT, resolve('test/fixtures/pipeline/outline-fixtures/bad')], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const out = `${res.stdout}${res.stderr}`;
  // precise FAIL lines, not just a generic failure
  assert.match(out, /FAIL/, 'FAIL lines must be printed');
  assert.match(out, /140/, 'the 140-char meta must be named with its actual length');
  assert.match(out, /150-160/, 'the expected meta window must be named');
  assert.match(out, /FAQ/, 'the 2-FAQ count failure must be named');
  assert.match(out, /sync offline/i, 'the invented FAQ question must be named by the cross-check');
});
