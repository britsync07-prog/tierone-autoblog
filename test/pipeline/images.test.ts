// TDD tests for lib/pipeline/images.ts (Plan 03-05 task 1) — provider seam +
// sharp encode of post image assets.
//
// ⚠ OWNER FULLY-FREE DIRECTIVE (2026-10-17): NO third-party PAID image API
// ever. The plan's pre-override 'openai' ImageProvider is replaced by the
// free 'procedural' generator (deterministic SVG artwork -> sharp encode,
// zero external calls, zero credentials) + the plan's deterministic 'fixture'
// lane. Forcing 'openai' fails honestly (LlmNoCredentialsError naming
// OPENAI_API_KEY + the directive note) — no paid client is ever constructed.
//
// Fixtures discipline (03-03 hard rule): every filesystem run here writes to
// a tmpdir sandbox (opts.outDir); the repo-root public/images probe is part
// of the plan's verify step, never of these tests.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  createImageProvider,
  heroPrompt,
  prepareAssets,
  type ImageConcept,
  type ImageProvider,
} from '../../lib/pipeline/images';
import { LlmNoCredentialsError } from '../../lib/pipeline/llm';

const HERO: ImageConcept = {
  slot: 'hero',
  concept: 'editorial illustration of a tidy writing workspace',
  alt: 'Editorial illustration of a tidy writing workspace',
};
const IN_ARTICLE: ImageConcept = {
  slot: 'in-article-1',
  concept: 'comparison checklist sketch for tool verdicts',
  alt: 'Comparison checklist sketch for tool verdicts',
};

interface Sandbox {
  outDir: string;
  cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'images-module-'));
  const outDir = join(root, 'public', 'images');
  return { outDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const ENV_KEYS = ['PIPELINE_IMAGE_FIXTURE', 'PIPELINE_IMAGE_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_IMAGE_MODEL'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    if (Object.hasOwn(savedEnv, key)) delete savedEnv[key];
  }
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

test('fixture provider: hero concept -> 4 files (hero.avif/webp + og.avif/og.jpg) + asset record', async () => {
  const sandbox = makeSandbox();
  try {
    process.env.PIPELINE_IMAGE_FIXTURE = '1';
    const provider = createImageProvider();
    assert.equal(provider.name, 'fixture');

    const assets = await prepareAssets('fixture-probe-one', [HERO], provider, { outDir: sandbox.outDir });
    const dir = join(sandbox.outDir, 'fixture-probe-one');
    assert.equal(readdirSync(dir).sort().join(','), 'hero.avif,hero.webp,og.avif,og.jpg');
    assert.equal(assets.length, 1);
    assert.equal(assets[0].slot, 'hero');
    assert.equal(assets[0].width, 1280);
    assert.equal(assets[0].height, 720);
    assert.equal(assets[0].avifPath, '/images/fixture-probe-one/hero.avif');
    assert.equal(assets[0].webpPath, '/images/fixture-probe-one/hero.webp');
    assert.equal(assets[0].ogJpgPath, '/images/fixture-probe-one/og.jpg');
  } finally {
    sandbox.cleanup();
  }
});

test('sharp metadata probe: hero is 1280x720 (avif+webp); og pair is 1200x630', async () => {
  const sandbox = makeSandbox();
  try {
    process.env.PIPELINE_IMAGE_FIXTURE = '1';
    const provider = createImageProvider();
    await prepareAssets('fixture-probe-dims', [HERO], provider, { outDir: sandbox.outDir });
    const dir = join(sandbox.outDir, 'fixture-probe-dims');
    const hero = await sharp(join(dir, 'hero.avif')).metadata();
    const webp = await sharp(join(dir, 'hero.webp')).metadata();
    const ogAvif = await sharp(join(dir, 'og.avif')).metadata();
    const ogJpg = await sharp(join(dir, 'og.jpg')).metadata();
    assert.equal(`${hero.width}x${hero.height}`, '1280x720');
    assert.equal(`${webp.width}x${webp.height}`, '1280x720');
    assert.equal(`${ogAvif.width}x${ogAvif.height}`, '1200x630');
    assert.equal(`${ogJpg.width}x${ogJpg.height}`, '1200x630');
  } finally {
    sandbox.cleanup();
  }
});

test('in-article concept -> in-article-1.avif+webp at 1080x608, NO og pair, no og in asset record', async () => {
  const sandbox = makeSandbox();
  try {
    process.env.PIPELINE_IMAGE_FIXTURE = '1';
    const provider = createImageProvider();
    const assets = await prepareAssets('fixture-probe-inline', [IN_ARTICLE], provider, { outDir: sandbox.outDir });
    const dir = join(sandbox.outDir, 'fixture-probe-inline');
    assert.equal(readdirSync(dir).sort().join(','), 'in-article-1.avif,in-article-1.webp');
    const inline = await sharp(join(dir, 'in-article-1.avif')).metadata();
    assert.equal(`${inline.width}x${inline.height}`, '1080x608');
    assert.equal(assets.length, 1);
    assert.equal(assets[0].ogJpgPath, undefined);
    assert.equal(assets[0].ogAvifPath, undefined);
    assert.equal(assets[0].avifPath, '/images/fixture-probe-inline/in-article-1.avif');
  } finally {
    sandbox.cleanup();
  }
});

test('free-directive guard: forcing the paid openai provider fails honestly, never crash-loops', () => {
  delete process.env.OPENAI_API_KEY;
  process.env.PIPELINE_IMAGE_PROVIDER = 'openai';
  assert.throws(
    () => createImageProvider(),
    (err: unknown) => {
      assert.ok(err instanceof LlmNoCredentialsError, 'expected LlmNoCredentialsError');
      assert.match(
        err.message,
        /OPENAI_API_KEY/,
        `error must name the missing var, got: ${err.message}`,
      );
      return true;
    },
  );

  // Even WITH a key present the paid path stays forbidden (binding directive
  // 2026-10-17: no third-party PAID image API ever) — fails closed, names the
  // directive, and the honest no-credentials message above is what the plan's
  // test 4 pins (no crash-loop either way).
  process.env.OPENAI_API_KEY = 'sk-present-but-forbidden';
  assert.throws(
    () => createImageProvider(),
    /paid image API|fully-free directive|procedural/,
    'paid path must stay forbidden even with a key',
  );
});

test('fixture run twice is idempotent: same file set, no duplication, same bytes', async () => {
  const sandbox = makeSandbox();
  try {
    process.env.PIPELINE_IMAGE_FIXTURE = '1';
    const provider = createImageProvider();
    const dir = join(sandbox.outDir, 'fixture-probe-twice');
    const first = await prepareAssets('fixture-probe-twice', [HERO, IN_ARTICLE], provider, { outDir: sandbox.outDir });
    assert.equal(readdirSync(dir).sort().length, 6);
    const bytesBefore = readdirSync(dir).sort().map((f) => `${f}:${readFileSync(join(dir, f)).length}`);

    const second = await prepareAssets('fixture-probe-twice', [HERO, IN_ARTICLE], provider, { outDir: sandbox.outDir });
    assert.equal(readdirSync(dir).sort().length, 6, 'no duplicated or stray files on rerun');
    const bytesAfter = readdirSync(dir).sort().map((f) => `${f}:${readFileSync(join(dir, f)).length}`);
    assert.deepEqual(bytesAfter, bytesBefore, 'regeneration is deterministic (same encodes)');
    assert.deepEqual(
      second.map((a) => [a.slot, a.avifPath]),
      first.map((a) => [a.slot, a.avifPath]),
    );
  } finally {
    sandbox.cleanup();
  }
});

test('slug guard: escape attempts and malformed slugs never write outside public/images (T-03-13)', async () => {
  const sandbox = makeSandbox();
  try {
    process.env.PIPELINE_IMAGE_FIXTURE = '1';
    const provider = createImageProvider();
    for (const bad of ['Bad Slug', 'escape/../x', 'a/b/c', 'UPPER', 'a'.repeat(121)]) {
      await assert.rejects(
        () => prepareAssets(bad, [HERO], provider, { outDir: sandbox.outDir }),
        /slug/,
        `malformed slug '${bad}' must be rejected`,
      );
    }
    assert.equal(existsSync(sandbox.outDir), false, 'no directories written for malformed slugs');
  } finally {
    sandbox.cleanup();
  }
});

test('procedural provider: free deterministic art (same inputs -> same bytes), offline, no env needed', async () => {
  const sandbox = makeSandbox();
  try {
    const provider: ImageProvider = createImageProvider();
    assert.equal(provider.name, 'procedural');
    const a = await provider.generate(HERO, 'some-space');
    const b = await provider.generate(HERO, 'some-space');
    assert.ok(Buffer.isBuffer(a) && a.length > 0);
    assert.deepEqual([...b], [...a], 'same concept+slug must render identical source art');
    const other = await provider.generate(IN_ARTICLE, 'some-space');
    assert.ok([...other].length !== [...a].length || Buffer.compare(a, other) !== 0, 'different concepts render different art');

    // The full encode works for procedural art too (real free generation lane)
    const assets = await prepareAssets('procedural-probe', [HERO], provider, { outDir: sandbox.outDir });
    assert.equal(assets[0].width, 1280);
    const art = await sharp(join(sandbox.outDir, 'procedural-probe', 'hero.avif')).metadata();
    assert.equal(`${art.width}x${art.height}`, '1280x720');
  } finally {
    sandbox.cleanup();
  }
});

test('heroPrompt export exists (plan contract) and carries the style guard', () => {
  const prompt = heroPrompt(HERO);
  assert.match(prompt, /editorial/i);
  assert.match(prompt, /no text|no logos|no faces/);
  assert.match(prompt, HERO.concept.slice(0, 10));
});
