// TDD tests for lib/pipeline/stages/assets.ts (Plan 03-05 task 2).
//
// The assets stage consumes 'outlined' entries WITHOUT entry.images, reads
// the '## Image slots' block from their committed outline artifacts (D-11),
// generates + encodes + writes the slot files through the FREE provider seam
// (lib/pipeline/images.ts — no paid API per the owner fully-free directive),
// then records entry.images { hero, inArticle, completedAt } while the stage
// REMAINS 'outlined' (D-09 enum frozen: only the draft stage advances).
//
// Fixture discipline (03-03 hard rule): registry clones are copied to a
// tmpdir sandbox per test and never run against in place; the image outDir
// lives inside the sandbox too.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runStage as runAssetsStage, MAX_IMAGES_PER_RUN } from '../../lib/pipeline/stages/assets';
import { createImageProvider, type ImageProvider } from '../../lib/pipeline/images';

const CLONE = 'test/fixtures/pipeline/registry-clones';

interface Sandbox {
  root: string;
  registryDir: string;
  briefsDir: string;
  outDir: string;
  cleanup: () => Promise<void>;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'assets-stage-'));
  const registryDir = join(root, 'registry');
  const briefsDir = join(root, 'briefs');
  const outDir = join(root, 'public', 'images');
  cpSync(CLONE, registryDir, { recursive: true });
  return {
    root,
    registryDir,
    briefsDir,
    outDir,
    cleanup: async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          rmSync(root, { recursive: true, force: true });
          return;
        } catch {
          await sleep(150);
        }
      }
    },
  };
}

function ctxFor(sandbox: Sandbox) {
  const lines: string[] = [];
  return {
    ctx: {
      registryDir: sandbox.registryDir,
      registry: null,
      budget: null,
      log: (m: string) => lines.push(m),
    },
    lines,
  };
}

function readShard(sandbox: Sandbox): {
  version: 1;
  updatedAt: string;
  keywords: Array<{
    id: string;
    stage: string;
    images?: {
      hero: { slot: string; alt: string; src: string };
      inArticle?: Array<{ slot: string; alt: string; src: string }>;
      completedAt: string;
    };
  }>;
} {
  return JSON.parse(readFileSync(join(sandbox.registryDir, SILO, 'registry.json'), 'utf8'));
}

/** A counting wrapper around the fixture provider — proves rerun skips do
 * NOT re-generate (idempotency is behavioral, not just file-level). */
function countingProvider(counter: { calls: number }): ImageProvider {
  const inner = createImageProvider(); // fixture lane via env below
  return {
    name: inner.name,
    generate: async (concept, slug) => {
      counter.calls += 1;
      return inner.generate(concept, slug);
    },
  };
}

const SILO = 'ai-writing';

function outlinedEntry(id: string, seed: number) {
  const iso = `2026-10-1${seed}T10:00:0${seed}.000Z`;
  return {
    id,
    keyword: `${id.replace(/-/g, ' ')} keyword`,
    silo: SILO,
    stage: 'outlined',
    createdAt: iso,
    updatedAt: iso,
    brief: { completedAt: iso },
    outline: { completedAt: iso, lint: 'pass' },
  };
}

function outlineMarkdown(opts: {
  hero?: string;
  inArticle1?: string;
  inArticle2?: string;
  withBlock?: boolean;
}): string {
  const parts = [
    '# Outline: seeded test keyword',
    '',
    '## Meta',
    '',
    '- H1 (50-60 chars): Seeded Test Keyword For The Assets Stage Probe',
    '',
    '## Structure',
    '',
    '## Quick verdict — target ~200 words',
    '',
    '## Conclusion + CTA',
    '',
    '- CTA: link to /about (template constant)',
    '',
  ];
  if (opts.withBlock !== false) {
    parts.push('## Image slots', '');
    if (opts.hero !== undefined) {
      parts.push(`- hero: ${opts.hero} (ALWAYS)`);
    }
    parts.push(`- in-article-1: ${opts.inArticle1 ?? 'none'}`);
    parts.push(`- in-article-2: ${opts.inArticle2 ?? 'none'}`);
    parts.push('');
  }
  return parts.join('\n');
}

function seedSandbox(
  sandbox: Sandbox,
  entries: Array<{ id: string; seed: number }>,
  outlines: Record<string, string>,
): void {
  const shard = { version: 1, updatedAt: '2026-10-17T10:00:00.000Z', keywords: entries.map((e) => outlinedEntry(e.id, e.seed)) };
  writeFileSync(join(sandbox.registryDir, SILO, 'registry.json'), JSON.stringify(shard, null, 2), 'utf8');
  mkdirSync(join(sandbox.briefsDir, SILO), { recursive: true });
  for (const [id, md] of Object.entries(outlines)) {
    writeFileSync(join(sandbox.briefsDir, SILO, `${id}-outline.md`), md, 'utf8');
  }
}

const ENV_KEYS = ['PIPELINE_IMAGE_FIXTURE'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv.PIPELINE_IMAGE_FIXTURE = process.env.PIPELINE_IMAGE_FIXTURE;
  process.env.PIPELINE_IMAGE_FIXTURE = '1';
});

afterEach(() => {
  if (savedEnv.PIPELINE_IMAGE_FIXTURE === undefined) delete process.env.PIPELINE_IMAGE_FIXTURE;
  else process.env.PIPELINE_IMAGE_FIXTURE = savedEnv.PIPELINE_IMAGE_FIXTURE;
});

const HERO_CONCEPT = 'Split 16:9 mockup of two calendar apps under a verdict badge';
const INLINE_CONCEPT = 'Feature-comparison banner placed under the verdict-table H2';

test('assets: outlined entries -> entry.images persisted, stage REMAINS outlined (D-09 frozen)', async () => {
  const sandbox = makeSandbox();
  try {
    const { ctx } = ctxFor(sandbox);
    seedSandbox(
      sandbox,
      [
        { id: 'alpha-outline-live', seed: 1 },
        { id: 'beta-outline-live', seed: 2 },
      ],
      {
        'alpha-outline-live': outlineMarkdown({ hero: HERO_CONCEPT, inArticle1: INLINE_CONCEPT }),
        'beta-outline-live': outlineMarkdown({
          hero: 'Hands-on workspace rendering with planning cards drifting across the frame',
          inArticle1: INLINE_CONCEPT,
          inArticle2: 'Checklist sketch highlighting the pricing trade-off columns',
        }),
      },
    );

    const counter = { calls: 0 };
    const result = await runAssetsStage(ctx, { briefsDir: sandbox.briefsDir, outDir: sandbox.outDir, provider: countingProvider(counter) });
    assert.equal(result.advanced, 0, 'assets NEVER advance the frozen stage enum');
    assert.equal(result.rejected, 0);
    assert.equal(result.spentUsd, 0, 'fully-free platform: image spend is always $0');
    assert.ok(counter.calls >= 3, 'fixture provider generated the slots');

    const shard = readShard(sandbox);
    const alpha = shard.keywords.find((e) => e.id === 'alpha-outline-live');
    assert.ok(alpha, 'alpha seeded');
    assert.equal(alpha.stage, 'outlined', 'stage stays outlined — draft advances it, not assets');
    assert.ok(alpha.images, 'alpha images persisted');
    assert.equal(alpha.images.hero.src, '/images/alpha-outline-live/hero.avif');
    assert.equal(alpha.images.hero.slot, 'hero');
    assert.equal(alpha.images.hero.alt, HERO_CONCEPT);
    assert.match(alpha.images.completedAt, /T\d{2}:/);
    assert.equal(alpha.images.inArticle?.length, 1);
    assert.equal(alpha.images.inArticle?.[0].src, '/images/alpha-outline-live/in-article-1.avif');

    const beta = shard.keywords.find((e) => e.id === 'beta-outline-live');
    assert.equal(beta?.images?.inArticle?.length, 2, 'both flagged in-article slots wired');
    assert.equal(beta?.images?.inArticle?.[1].src, '/images/beta-outline-live/in-article-2.avif');

    // files actually landed in the sandbox outDir
    assert.equal(
      readdirSync(join(sandbox.outDir, 'alpha-outline-live')).sort().join(','),
      'hero.avif,hero.webp,in-article-1.avif,in-article-1.webp,og.avif,og.jpg',
    );
    assert.ok(existsSync(join(sandbox.outDir, 'beta-outline-live', 'in-article-2.webp')));

    const notes = result.notes.join('\n');
    assert.match(notes, /alpha-outline-live/, 'wiring note names the entry');
  } finally {
    await sandbox.cleanup();
  }
});

test('assets: rerun is idempotent — entries with images skipped, zero re-generation', async () => {
  const sandbox = makeSandbox();
  try {
    const { ctx } = ctxFor(sandbox);
    seedSandbox(sandbox, [{ id: 'alpha-outline-live', seed: 1 }], {
      'alpha-outline-live': outlineMarkdown({ hero: HERO_CONCEPT, inArticle1: INLINE_CONCEPT }),
    });

    await runAssetsStage(ctx, { briefsDir: sandbox.briefsDir, outDir: sandbox.outDir, provider: countingProvider({ calls: 0 }) });

    // second run with a FRESH counting provider — must call generate 0 times
    const counter = { calls: 0 };
    const second = await runAssetsStage(ctx, {
      briefsDir: sandbox.briefsDir,
      outDir: sandbox.outDir,
      provider: countingProvider(counter),
    });
    assert.equal(counter.calls, 0, 'no duplicate generation on rerun');
    assert.match(second.notes.join('\n'), /skipped/i);
  } finally {
    await sandbox.cleanup();
  }
});

test('assets: outline without image slots / without hero line -> clear failure notes, others continue', async () => {
  const sandbox = makeSandbox();
  try {
    const { ctx } = ctxFor(sandbox);
    seedSandbox(
      sandbox,
      [
        { id: 'gamma-outline-live', seed: 1 },
        { id: 'epsilon-outline-live', seed: 2 },
        { id: 'alpha-outline-live', seed: 3 },
      ],
      {
        'gamma-outline-live': outlineMarkdown({ withBlock: false }),
        'epsilon-outline-live': outlineMarkdown({ inArticle1: INLINE_CONCEPT }), // block present, NO hero line
        'alpha-outline-live': outlineMarkdown({ hero: HERO_CONCEPT }),
      },
    );

    const result = await runAssetsStage(ctx, {
      briefsDir: sandbox.briefsDir,
      outDir: sandbox.outDir,
      provider: countingProvider({ calls: 0 }),
    });

    assert.equal(result.advanced, 0);
    assert.equal(result.rejected, 0, 'parse failures park entries, never reject (D-04 visible trail, recoverable data fix)');
    const notes = result.notes.join('\n');
    assert.match(notes, /gamma-outline-live[\s\S]*Image slots/, 'missing block explains itself');
    assert.match(notes, /epsilon-outline-live[\s\S]*hero/, 'missing hero line explains itself');

    const shard = readShard(sandbox);
    assert.equal(shard.keywords.find((e) => e.id === 'gamma-outline-live')?.images, undefined, 'gamma not wired');
    assert.equal(shard.keywords.find((e) => e.id === 'epsilon-outline-live')?.images, undefined, 'epsilon not wired');
    assert.ok(
      shard.keywords.find((e) => e.id === 'alpha-outline-live')?.images,
      'the healthy entry still gets wired (stage continues past bad parses)',
    );
    for (const e of shard.keywords) {
      assert.equal(e.stage, 'outlined', 'stages untouched by assets');
    }
  } finally {
    await sandbox.cleanup();
  }
});

test('assets: alt text under 10 chars -> deterministic failure note (cheap-model regeneration is the 03-06 path)', async () => {
  const sandbox = makeSandbox();
  try {
    const { ctx } = ctxFor(sandbox);
    seedSandbox(sandbox, [{ id: 'delta-outline-live', seed: 1 }], {
      'delta-outline-live': outlineMarkdown({ hero: 'tiny' }),
    });

    const result = await runAssetsStage(ctx, {
      briefsDir: sandbox.briefsDir,
      outDir: sandbox.outDir,
      provider: countingProvider({ calls: 0 }),
    });

    const notes = result.notes.join('\n');
    assert.match(notes, /delta-outline-live/);
    assert.match(notes, /alt/i, 'failure note names the alt gate');
    assert.match(notes, /10/, 'failure note names the 10-char threshold');

    const shard = readShard(sandbox);
    assert.equal(shard.keywords.find((e) => e.id === 'delta-outline-live')?.images, undefined, 'no images recorded');
  } finally {
    await sandbox.cleanup();
  }
});

test('assets: MAX_IMAGES_PER_RUN=6 caps the batch (excess entries parked at outlined for next run)', async () => {
  const sandbox = makeSandbox();
  try {
    const { ctx } = ctxFor(sandbox);
    const ids = ['alpha-outline-live', 'beta-outline-live', 'eta-outline-live', 'zeta-outline-live'];
    const outlines: Record<string, string> = {};
    ids.forEach((id) => {
      outlines[id] = outlineMarkdown({ hero: HERO_CONCEPT, inArticle1: INLINE_CONCEPT });
    });
    seedSandbox(
      sandbox,
      ids.map((id, i) => ({ id, seed: i + 1 })),
      outlines,
    );

    const result = await runAssetsStage(ctx, {
      briefsDir: sandbox.briefsDir,
      outDir: sandbox.outDir,
      provider: countingProvider({ calls: 0 }),
    });

    assert.equal(MAX_IMAGES_PER_RUN, 6, 'the contract constant stays 6');
    const notes = result.notes.join('\n');
    assert.match(notes, /MAX_IMAGES_PER_RUN/, 'cap hit produces a visible note');
    assert.match(notes, /zeta-outline-live/, 'the capped-out entry is named');
    const shard = readShard(sandbox);
    assert.ok(
      shard.keywords.some((e) => e.id === 'zeta-outline-live' && e.images === undefined),
      '4th entry parked (cap)',
    );
    const wiredCount = shard.keywords.filter((e) => e.images).length;
    assert.equal(wiredCount, 3, `first 3 entries wired (${MAX_IMAGES_PER_RUN} slots exactly)`);
  } finally {
    await sandbox.cleanup();
  }
});
