// Post image asset machinery (Plan 03-05, PIPE-05 / D-13) — REWORKED
// (2026-10-17) for the ⚠ OWNER FULLY-FREE DIRECTIVE: NO third-party PAID
// image API ever. The plan's pre-override 'openai' Images-API provider is
// superseded by the free 'procedural' generator below: deterministic
// concept-derived SVG artwork rendered by the already-installed sharp
// (libvips) into AVIF/WebP/OG-JPEG — zero external calls, zero credentials,
// zero billing, works identically on the owner's machine and in production.
//
// Providers:
//   'procedural'  free, offline, deterministic brand-consistent art from the
//                 outline's image-slot concepts (the real lane; default)
//   'fixture'     deterministic 1536x1024 gradient PNG built from pure
//                 zlib/Buffer construction (the planned verification lane;
//                 also selected by PIPELINE_IMAGE_FIXTURE=1)
//   'openai'      FORBIDDEN — we never construct a paid client. Selecting it
//                 via PIPELINE_IMAGE_PROVIDER=openai fails honestly:
//                 LlmNoCredentialsError naming OPENAI_API_KEY when unset
//                 (same protocol as lib/pipeline/llm.ts), and naming the
//                 owner directive from 2026-10-17 even when a key exists.
//
// prepareAssets() per concept (slot 'hero' | 'in-article-N'):
//   hero:        sharp cover-crop -> 1280x720 -> hero.avif (q60) +
//                hero.webp (q75); same 16:9 source art also center-cropped
//                to 1200x630 -> og.avif (q60) + og.jpg (q80) (D-13 "doubles
//                as OG variant"; the jpg hedges LinkedIn/iMessage AVIF gaps)
//   in-article:  1080x608 -> in-article-N.avif + .webp (no og pair)
//   Atomicity: every encode for a slot succeeds in memory BEFORE any byte
//   is written, so a sharp failure can never leave partial slot files.
//   Paths are confined to {outDir}/{slug}/ (default outDir 'public/images';
//   slug validated against the registry-id shape — T-03-13, no user-supplied
//   path components; contains no execution surface: raster bytes only).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { deflateSync } from 'node:zlib';
import { LlmNoCredentialsError } from './llm';

export interface ImageConcept {
  slot: 'hero' | 'in-article-1' | 'in-article-2';
  concept: string;
  alt: string;
}

export interface GeneratedAsset {
  slot: string;
  /** Site-relative URL of the slot's AVIF render (the heroImage.src shape). */
  avifPath: string;
  webpPath: string;
  /** Hero-only OG derivations from the SAME 16:9 source art (D-13). */
  ogAvifPath?: string;
  ogJpgPath?: string;
  width: number;
  height: number;
}

export interface ImageProvider {
  name: 'procedural' | 'fixture';
  /** Rasterizable image bytes: PNG (fixture) or SVG (procedural) — both are
   * decoded inline by sharp. Implementations must be offline + free. */
  generate(concept: ImageConcept, slug: string): Promise<Buffer>;
}

/** Provider selection model env var (value: 'procedural' | 'fixture').
 * PIPELINE_IMAGE_FIXTURE=1 is the stronger shortcut the plan defines. */
export const PROVIDER_ENV = 'PIPELINE_IMAGE_PROVIDER';

const FREE_HERO_STYLE_GUARD =
  'Single flat editorial illustration. Absolute style guard: NO text, NO logos, NO faces anywhere in the image. Clean geometric shapes, layered soft color fields, generous negative space, modern tech-blog editorial art.';

/** Plan-required export: the prompt template for a free in-house/local art
 * generator (e.g. someone running their own local diffusion model, or 03-06
 * lucide-style concept paraphrasing). No paid API consumes it in this plan —
 * it documents the generation contract the free art must satisfy. */
export function heroPrompt(concept: ImageConcept): string {
  return [
    `Art concept: ${concept.concept}`,
    FREE_HERO_STYLE_GUARD,
    'Composition: wide 16:9 hero scene, one dominant subject, subtle depth of field, brand palette family. NO fictional companies, NO watermarks, NO embedded words.',
    'Render target: 1536x1024 raster for sharp AVIF/WebP encode.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Deterministic hashing — every generator is a pure function of (slug, slot,
// concept) so regeneration is idempotent and reruns never change bytes.
// ---------------------------------------------------------------------------

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** hsl -> rgb (TS-side, never inside SVG, so librsvg only ever sees rgb()). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const c = ((1 - Math.abs((2 * l) / 100 - 1)) * s) / 100;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  const seg = Math.floor(hue / 60) % 6;
  const table: Array<[number, number, number]> = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[seg];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgb(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// fixture provider: deterministic gradient PNG, pure zlib/Buffer construction
// ---------------------------------------------------------------------------

const SOURCE_WIDTH = 1536;
const SOURCE_HEIGHT = 1024;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i] ?? 0;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'utf8'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Deterministic diagonal gradient PNG (RGB8): horizontal warm ramp modulated
 * by a gentle vertical shade — distinct corner hues help visual verification. */
function fixtureGradientPng(): Buffer {
  const { width: w, height: h } = { width: SOURCE_WIDTH, height: SOURCE_HEIGHT };
  const raw: number[] = [];
  for (let y = 0; y < h; y += 1) {
    raw.push(0); // filter type: none
    const shade = 1 - (y / h) * 0.35;
    for (let x = 0; x < w; x += 1) {
      const t = x / (w - 1);
      raw.push(Math.round(94 + t * 128 * shade));
      raw.push(Math.round(72 + t * 46 * shade));
      raw.push(Math.round(180 + t * 60 * (0.4 + shade * 0.6)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const ihdrBlob = pngChunk('IHDR', ihdr);
  const idatBlob = pngChunk('IDAT', deflateSync(Buffer.from(raw), { level: 6 }));
  const iendBlob = pngChunk('IEND', Buffer.alloc(0));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, ihdrBlob, idatBlob, iendBlob]);
}

// ---------------------------------------------------------------------------
// procedural provider: free deterministic concept-derived SVG art
// ---------------------------------------------------------------------------

const ARTICLE_WORDS_RE = /[a-z][a-z-]{2,}/g;

/** Concept-derived free art: flat editorial composition (no text, no faces,
 * no logos). Background + accent palette derive from the concept's token
 * hashes; geometry orbits are seeded off the full (slug, slot, concept) key,
 * so every emitted asset is brand-consistent family art that never repeats
 * pixel-for-pixel across steps but always reproduces for the same inputs. */
function proceduralSvg(concept: ImageConcept, slug: string): string {
  const { width: w, height: h } = { width: SOURCE_WIDTH, height: SOURCE_HEIGHT };
  const words = (concept.concept.toLowerCase().match(ARTICLE_WORDS_RE) ?? ['editorial'])
    .filter((word) => !['the', 'and', 'for', 'with', 'new', 'best'].includes(word))
    .slice(0, 6);
  const fullSeed = fnv1a(`${slug}:${concept.slot}:${concept.concept}`);
  const rand = mulberry32(fullSeed);
  const baseHue = fullSeed % 360;
  const secondHue = (baseHue + 42 + (fullSeed % 90)) % 360;
  const layers: string[] = [];

  // background field: two diagonal color stops (brand family)
  layers.push(
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${rgb(baseHue, 62, 30 - (fullSeed % 8))}"/>` +
      `<stop offset="1" stop-color="${rgb(secondHue, 58, 44 - (fullSeed % 6))}"/>` +
      `</linearGradient></defs>`,
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>`,
  );

  // soft orbs, one per concept token (spatial color-word signature)
  for (const word of words) {
    const wordSeed = fnv1a(word);
    const hue = (wordSeed % 340 + baseHue) % 360;
    const cx = Math.round(90 + rand() * (w - 180));
    const cy = Math.round(80 + rand() * (h - 160));
    const r = Math.round(140 + rand() * 320);
    layers.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${rgb(hue, 66, 58)}" fill-opacity="0.${String(10 + (wordSeed % 16)).padStart(2, '0')}"/>`,
    );
  }

  // slot composition: hero = horizon band + dominant ring; in-article =
  // vertical split panels (editorial section divider feel). In-article slots
  // read as inset figures, heroes as scene plates.
  if (concept.slot === 'hero') {
    const bandY = Math.round(h * 0.62);
    layers.push(
      `<rect x="0" y="${bandY}" width="${w}" height="${h - bandY}" fill="${rgb(baseHue, 48, 18)}" fill-opacity="0.35"/>`,
      `<circle cx="${Math.round(w * 0.72)}" cy="${Math.round(h * 0.4)}" r="${Math.round(120 + rand() * 80)
      }" fill="none" stroke="${rgb(secondHue, 70, 24)}" stroke-opacity="0.55" stroke-width="${8 + (fullSeed % 10)}"/>`,
      `<circle cx="${Math.round(w * 0.72 + 40)}" cy="${Math.round(h * 0.4 - 30)}" r="${12 + (fullSeed % 14)
      }" fill="${rgb(secondHue, 34, 16)}" fill-opacity="0.6"/>`,
    );
  } else {
    layers.push(
      `<rect x="0" y="0" width="${Math.round(w * 0.44)}" height="${h}" fill="${rgb(baseHue, 52, 20)}" fill-opacity="0.26"/>`,
      `<rect x="${Math.round(w * 0.52)}" y="${Math.round(h * 0.2)}" width="${Math.round(w * 0.36)}" height="${Math.round(h * 0.6)}"
        rx="${28 + (fullSeed % 20)}" fill="${rgb(secondHue, 62, 24)}" fill-opacity="0.32"/>`,
      `<line x1="0" y1="${Math.round(h * 0.82)}" x2="${w}" y2="${Math.round(h * 0.82)}" stroke="${rgb(baseHue, 40, 12)}" stroke-opacity="0.3" stroke-width="6"/>`,
    );
  }

  // fine editorial texture: sparse vertical hairlines anchored to the seed
  const hairlines: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const x = Math.round(40 + (i * (w - 80)) / 8 + (rand() - 0.5) * 30);
    hairlines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${rgb(baseHue, 30, 88)}" stroke-opacity="0.06" stroke-width="2"/>`,
    );
  }
  layers.push(...hairlines.join(''));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    layers.join(''),
    `</svg>`,
  ].join('');
}

function makeProceduralProvider(): ImageProvider {
  return {
    name: 'procedural',
    async generate(concept: ImageConcept, slug: string): Promise<Buffer> {
      // Deterministic in-process render; no network, no keys, no billing.
      return Buffer.from(proceduralSvg(concept, slug), 'utf8');
    },
  };
}

function makeFixtureProvider(): ImageProvider {
  return {
    name: 'fixture',
    async generate(_concept: ImageConcept, _slug: string): Promise<Buffer> {
      return fixtureGradientPng();
    },
  };
}

/** Fail-closed provider seam. 'openai' (or any other value) must never even
 * be selected silently — the honest error names the missing var when unset
 * (LLM-credential protocol) and the owner directive when a key exists. */
function resolveProviderName(): 'procedural' | 'fixture' {
  if (process.env.PIPELINE_IMAGE_FIXTURE === '1') return 'fixture';
  const forced = process.env[PROVIDER_ENV];
  if (forced === undefined) return 'procedural';
  if (forced === 'fixture') return 'fixture';
  if (forced === 'procedural') return 'procedural';
  if (forced === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new LlmNoCredentialsError(
        'Image provider "openai" cannot be used: OPENAI_API_KEY not set — and third-party PAID image APIs are forbidden anyway (owner fully-free directive 2026-10-17). Use the built-in free "procedural" provider (no env needed) or PIPELINE_IMAGE_FIXTURE=1.',
      );
    }
    throw new LlmNoCredentialsError(
      'Image provider "openai" is forbidden: third-party PAID image APIs are never allowed on this platform (owner fully-free directive 2026-10-17), even with a key present. Use the built-in free "procedural" provider (no env needed) or PIPELINE_IMAGE_FIXTURE=1.',
    );
  }
  throw new LlmNoCredentialsError(
    `${PROVIDER_ENV}='${forced}' is not a provider (valid: procedural | fixture). Paid providers (openai/...) are forbidden — owner fully-free directive 2026-10-17.`,
  );
}

export function createImageProvider(): ImageProvider {
  const name = resolveProviderName();
  return name === 'fixture' ? makeFixtureProvider() : makeProceduralProvider();
}

// ---------------------------------------------------------------------------
// prepareAssets: provider bytes -> sharp encode -> atomic slot writes
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 120;

function fail(message: string): never {
  throw new Error(message);
}

export const DEFAULT_IMAGES_OUT_DIR = 'public/images';

function assertSlug(slug: string): string {
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > SLUG_MAX || !SLUG_RE.test(slug)) {
    fail(`invalid image slug '${String(slug)}' (expected lowercase [a-z0-9-], max ${SLUG_MAX} chars)`);
  }
  return slug;
}

interface EncodedFile {
  fileName: string;
  bytes: Buffer;
}

interface SlotPlan {
  baseName: string;
  width: number;
  height: number;
}

function planFor(concept: ImageConcept): SlotPlan {
  if (concept.slot === 'hero') return { baseName: 'hero', width: 1280, height: 720 };
  if (concept.slot === 'in-article-1' || concept.slot === 'in-article-2') {
    return { baseName: concept.slot, width: 1080, height: 608 };
  }
  fail(`unknown image slot '${String(concept.slot)}' (valid: hero | in-article-1 | in-article-2)`);
}

/** Encode one concept into its whole slot file set in memory, then write ALL
 * bytes at once — a sharp failure throws before a single file is created. */
async function encodeAndWrite(slug: string, concept: ImageConcept, provider: ImageProvider, outDir: string): Promise<GeneratedAsset> {
  const plan = planFor(concept);
  const art = await provider.generate(concept, slug);

  const base = sharp(art).resize(plan.width, plan.height, { fit: 'cover' });
  const avif = await base.clone().avif({ quality: 60 }).toBuffer();
  const webp = await base.clone().webp({ quality: 75 }).toBuffer();
  const files: EncodedFile[] = [
    { fileName: `${plan.baseName}.avif`, bytes: avif },
    { fileName: `${plan.baseName}.webp`, bytes: webp },
  ];

  const asset: GeneratedAsset = {
    slot: concept.slot,
    avifPath: `/images/${slug}/${plan.baseName}.avif`,
    webpPath: `/images/${slug}/${plan.baseName}.webp`,
    width: plan.width,
    height: plan.height,
  };

  if (concept.slot === 'hero') {
    // Same source art, OG crop (1200x630): AVIF for the letter of PIPE-05 +
    // JPEG q80 fallback for crawlers/LinkedIn/iMessage AVIF gaps (D-13).
    const og = sharp(art).resize(1200, 630, { fit: 'cover' });
    const ogAvif = await og.clone().avif({ quality: 60 }).toBuffer();
    const ogJpg = await og.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    files.push(
      { fileName: 'og.avif', bytes: ogAvif },
      { fileName: 'og.jpg', bytes: ogJpg },
    );
    asset.ogAvifPath = `/images/${slug}/og.avif`;
    asset.ogJpgPath = `/images/${slug}/og.jpg`;
  }

  const dir = join(outDir, slug);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file.fileName), file.bytes);
  }
  return asset;
}

/**
 * Generate + encode + write the given concepts for one post slug.
 * Idempotent: identical inputs regenerate identical files (overwrite allowed).
 * All writes land under {outDir}/{slug}/ only (T-03-13). Throws on any encode
 * failure of any slot (fail-closed: caller sees the whole run fail).
 */
export async function prepareAssets(
  slug: string,
  concepts: ImageConcept[],
  provider: ImageProvider,
  opts: { outDir?: string } = {},
): Promise<GeneratedAsset[]> {
  assertSlug(slug);
  const outDir = opts.outDir ?? DEFAULT_IMAGES_OUT_DIR;
  const asset: GeneratedAsset[] = [];
  for (const concept of concepts) {
    asset.push(await encodeAndWrite(slug, concept, provider, outDir));
  }
  return asset;
}
