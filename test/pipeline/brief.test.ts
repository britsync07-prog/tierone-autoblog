// TDD tests for lib/pipeline/stages/brief.ts (Plan 03-03 task 2).
// Each test copies the fixture registry clone into a temp sandbox so runs are
// isolated and idempotent (the committed clone stays pristine). LLM payloads
// come from the clone's llm-fixtures.json through completeJson's FIXTURE path
// (same zod schema, zero network, zero ledger ops).
//
// Plan behaviors covered (reworked per ⚠ owner fully-free directive where the
// LLM contract changed): committed brief artifact (D-11), no-fresh-SERP cache
// rule (D-02), idempotent advance filtered→briefed with brief.completedAt
// (D-09), and the judged-not-worth-it visible rejection trail (D-04).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runStage } from '../../lib/pipeline/stages/brief';

const CLONE = resolve('test/fixtures/pipeline/registry-clones');

interface Sandbox {
  registryDir: string;
  briefsDir: string;
  cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'brief-stage-'));
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

test("brief: fixture registry 'filtered' entry -> {id}-brief.md written under briefs/{silo}/, entry advanced to briefed", async () => {
  const sandbox = makeSandbox();
  try {
    const ctx = ctxFor(sandbox);
    const result = await runStage(ctx, { briefsDir: sandbox.briefsDir });
    assert.ok(result.advanced >= 1, `expected >=1 advanced, got ${result.advanced} (notes: ${result.notes.join('; ')})`);
    assert.equal(result.spentUsd, 0, 'the fully-free platform never bills anything');

    const file = join(sandbox.briefsDir, 'ai-productivity', 'fixture-serp-alpha-brief.md');
    assert.ok(existsSync(file));
    const md = readFileSync(file, 'utf8');
    assert.match(md, /^# Gap brief: fixture keyword alpha$/m); // keyword verbatim in H1
    // serpTop3 URLs verbatim from the registry entry (never re-invented)
    for (const url of [
      'https://example.com/calendar-a',
      'https://example.com/calendar-b',
      'https://example.com/calendar-c',
    ]) {
      assert.ok(md.includes(url), `brief must carry registry SERP url ${url} verbatim`);
    }
    // SERP as-of + free-signal proxies (honest metrics line: paid volume/KD unavailable)
    assert.match(md, /SERP captured 2026-10-17T11:00:00\.000Z/);
    assert.match(md, /autocomplete rank 2/);
    assert.match(md, /volume\/KD not available/);
    // gaps + judgement + image brief sections present
    assert.match(md, /## Gaps we can win/);
    assert.match(md, /current-version verdict table/);
    assert.match(md, /## Image brief \(PIPE-05 forward-planning\)/);
    assert.match(md, /- Hero: Split 16:9 mockup/);
    assert.match(md, /## Judgement\n/);
    // paa[] empty platform-wide -> graceful degrade to derived questions with honest provenance
    assert.match(md, /## FAQ candidate questions \(derived .*not captured PAA/);
    assert.match(md, /Which fixture calendar app schedules tasks fastest\?/);

    // shard persisted the promotion with the brief proof
    const shard = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-productivity', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; stage: string; brief?: { completedAt: string }; rejectionReason?: string }>;
    };
    const advancedEntry = shard.keywords.find((e) => e.id === 'fixture-serp-alpha');
    assert.ok(advancedEntry);
    assert.equal(advancedEntry.stage, 'briefed');
    assert.ok(advancedEntry.brief && advancedEntry.brief.completedAt.length > 0);
    assert.equal(advancedEntry.rejectionReason, undefined);

    // fixture mode made ZERO real HTTP requests -> no ledger ops were appended
    assert.equal(existsSync(join(sandbox.registryDir, 'spend-ledger.json')), false);
  } finally {
    sandbox.cleanup();
  }
});

test("brief: entry without cached SERP -> rejected 'cannot brief: no cached SERP' (no fresh pull, D-02)", async () => {
  const sandbox = makeSandbox();
  try {
    const result = await runStage(ctxFor(sandbox), { briefsDir: sandbox.briefsDir });
    assert.ok(result.rejected >= 1);
    const shard = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-image', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; stage: string; rejectionReason?: string }>;
    };
    const entry = shard.keywords.find((e) => e.id === 'fixture-no-serp');
    assert.ok(entry);
    assert.equal(entry.stage, 'rejected');
    assert.ok(entry.rejectionReason?.startsWith('cannot brief: no cached SERP'));
    assert.ok(!existsSync(join(sandbox.briefsDir, 'ai-image', 'fixture-no-serp-brief.md')), 'no brief artifact without data to brief from');
  } finally {
    sandbox.cleanup();
  }
});

test('brief: rerun skips already-briefed entries (idempotent advance with unchanged completedAt)', async () => {
  const sandbox = makeSandbox();
  try {
    const first = await runStage(ctxFor(sandbox), { briefsDir: sandbox.briefsDir });
    const shardAfterFirst = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-productivity', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; stage: string; brief?: { completedAt: string } }>;
    };
    const stamp = shardAfterFirst.keywords.find((e) => e.id === 'fixture-serp-alpha')?.brief?.completedAt;
    assert.ok(stamp);

    const file = join(sandbox.briefsDir, 'ai-productivity', 'fixture-serp-alpha-brief.md');
    const mdFirst = readFileSync(file, 'utf8');

    const second = await runStage(ctxFor(sandbox), { briefsDir: sandbox.briefsDir });
    assert.equal(second.advanced, 0, 'already-briefed entries must not re-brief');
    const shardAfterSecond = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-productivity', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; brief?: { completedAt: string } }>;
    };
    assert.equal(shardAfterSecond.keywords.find((e) => e.id === 'fixture-serp-alpha')?.brief?.completedAt, stamp);
    assert.equal(readFileSync(file, 'utf8'), mdFirst, 'brief artifact untouched on rerun');
  } finally {
    sandbox.cleanup();
  }
});

test('brief: model judges not worth it -> rejected "judged not worth a post: <reason>" with the brief kept as the judgement trail', async () => {
  const sandbox = makeSandbox();
  try {
    const result = await runStage(ctxFor(sandbox), { briefsDir: sandbox.briefsDir });
    assert.ok(result.rejected >= 1);
    const shard = JSON.parse(readFileSync(join(sandbox.registryDir, 'ai-productivity', 'registry.json'), 'utf8')) as {
      keywords: Array<{ id: string; stage: string; rejectionReason?: string }>;
    };
    const entry = shard.keywords.find((e) => e.id === 'fixture-serp-not-worth');
    assert.ok(entry);
    assert.equal(entry.stage, 'rejected');
    assert.ok(entry.rejectionReason?.startsWith('judged not worth a post: '));
    // the judgement text itself stays auditable in the committed brief
    const file = join(sandbox.briefsDir, 'ai-productivity', 'fixture-serp-not-worth-brief.md');
    assert.ok(existsSync(file));
    const md = readFileSync(file, 'utf8');
    assert.match(md, /thin-content shape|Recommend rejection/);
  } finally {
    sandbox.cleanup();
  }
});
