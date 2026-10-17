// Landed-post template gate (Plan 03-06 task 1). Zero dependencies: parses
// frontmatter minimally (split on `---` fences), asserts lengths/counts/
// structure per file, checks the silo against SILO_SLUGS read as TEXT from
// lib/silos.ts (module never imported — same parity trick as check-crawl.mjs),
// scans banned vocabulary. Sibling of scripts/check-seeds.mjs with the same
// "N passed" + exit-code contract, plus an optional directory argument so
// fixture directories and the draft stage's posts dir use the same gate:
// `node scripts/check-template.mjs [dir]` (default content/posts).
//
// Deliberately seed-compatible: every phase-1 seed satisfies rules 1-14 by
// construction. The 1,500-2,500 word band is intentionally NOT enforced here —
// the draft stage owns that quality floor (plan 03 of the content pipeline);
// this gate is corpus-agnostic template conformance only.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// keep in sync with scripts/check-seeds.mjs
const BANNED = [
  'delve',
  'fast-paced world',
  'game-changer',
  'unlock the power',
  "in today's digital age",
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const libSilosPath = fileURLToPath(new URL('../lib/silos.ts', import.meta.url));

// SILO_SLUGS as text: the file's array entries are quoted strings on their
// own lines (`  'ai-writing',`); comment lines never match the anchor.
function readOnlySiloSlugs() {
  const raw = readFileSync(libSilosPath, 'utf8');
  const slugs = [];
  for (const line of raw.split('\n')) {
    if (line.trimStart().startsWith('//')) continue;
    const m = /^  '([a-z0-9-]+)',$/.exec(line);
    if (m) slugs.push(m[1]);
  }
  return slugs.length > 0 ? slugs : ['ai-writing'];
}

function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { error: 'missing frontmatter fences', fm: {}, body: '', fmBlock: '' };
  const [, fmBlock, body] = match;
  const fm = {};
  for (const line of fmBlock.split('\n')) {
    // Top-level keys live at column 0 (nested `q:`/`a:` and the comparison
    // block's `  columns:`/`  title:` must never shadow them).
    const m = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (m) {
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      fm[m[1]] = v;
    }
  }
  return { fm, body, fmBlock };
}

// D-14 convention (same as check-seeds.mjs): posts carrying a `comparison:`
// frontmatter block satisfy the table requirement via the shared
// <ComparisonTable> component. Presence-check only — row shapes are the
// build's zod job (lib/pipeline/draft-schema.ts), never this lint's.
function hasComparisonBlock(fmBlock) {
  const idx = fmBlock.search(/^comparison:\s*$/m);
  if (idx === -1) return false;
  const block = fmBlock.slice(idx);
  return (
    Boolean(/^  columns:\s*$/m.test(block)) &&
    (block.match(/^\s*-\s*cells:/gm) || []).length >= 2
  );
}

function checkFile(dir, file) {
  const failures = [];
  const rel = join(dir, file);
  const raw = readFileSync(rel, 'utf8');
  const { error, fm, body, fmBlock } = parseFrontmatter(raw);
  if (error) return [`${file}: FAIL (${error})`];

  const title = fm.title ?? '';
  if (title.length < 50 || title.length > 60)
    failures.push(`title length ${title.length} (want 50-60)`);

  const desc = fm.description ?? '';
  if (desc.length < 150 || desc.length > 160)
    failures.push(`description length ${desc.length} (want 150-160)`);

  if (!SLUG_RE.test(fm.slug ?? ''))
    failures.push(`slug "${fm.slug}" fails slug regex`);

  for (const f of ['publishedAt', 'updatedAt']) {
    if (!fm[f]) failures.push(`missing frontmatter field "${f}"`);
    else if (Number.isNaN(Date.parse(fm[f])))
      failures.push(`${f} not a parseable datetime`);
  }

  // FAQ rules 6: line-counted q:/a: pairs. A missing/crossed pairing
  // (orphan `a:` or `q:` without its answer) is a broken pair → FAIL.
  const qCount = (fmBlock.match(/^\s*-\s*q\s*:/gm) || []).length;
  const aCount = (fmBlock.match(/^\s*a\s*:/gm) || []).length;
  if (qCount < 3 || qCount > 5) failures.push(`faq count ${qCount} (want 3-5)`);
  if (qCount > 0 && aCount !== qCount)
    failures.push(`faq pairs mismatch (${qCount} q, ${aCount} a)`);

  const tldr = fm.tldr ?? '';
  if (!tldr) failures.push('missing frontmatter field "tldr"');
  const tldrWords = tldr.split(/\s+/).filter(Boolean).length;
  if (tldr && tldrWords > 100) failures.push(`tldr ${tldrWords} words (want <=100)`);

  const slugs = readOnlySiloSlugs();
  if (!slugs.includes(fm.silo ?? ''))
    failures.push(`silo "${fm.silo}" not in SILO_SLUGS (${slugs.join(', ')})`);

  const h2s = (body.match(/^## .+/gm) || []).length;
  if (h2s < 3) failures.push(`H2 count ${h2s} (want >=3)`);

  if (!body.includes('/about')) failures.push('no /about CTA link');

  const lower = raw.toLowerCase();
  for (const phrase of BANNED) {
    if (lower.includes(phrase)) failures.push(`banned phrase "${phrase}"`);
  }

  if ((body.match(/^# /gm) || []).length > 0)
    failures.push('body contains an H1 line (want none — title lives in frontmatter)');

  for (const marker of ['[comparison-table slot]', '{{image:']) {
    if (raw.includes(marker)) failures.push(`unresolved template marker "${marker}"`);
  }

  // Rule 14: a comparison block is ACCEPTED via presence-check (no
  // requirement — the table question is the build's zod job). Recorded
  // only as context on success so PASS lines read like the family idiom.
  if (failures.length === 0)
    return [hasComparisonBlock(fmBlock) ? `${file}: PASS (comparison frontmatter)` : `${file}: PASS`];
  return failures.map((f) => `${file}: FAIL (${f})`);
}

const dir = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : fileURLToPath(new URL('../content/posts/', import.meta.url));

let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.mdx'));
} catch {
  console.error(`FAIL: cannot read directory ${dir}`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`FAIL: no .mdx files in ${dir}`);
  process.exit(1);
}

let failed = 0;
let passed = 0;
for (const file of files.sort()) {
  for (const line of checkFile(dir, file)) {
    console.log(line);
    if (line.includes(': PASS')) passed += 1;
    else failed += 1;
  }
}
console.log(`${passed} passed${failed > 0 ? `, ${failed} failed` : ''}`);
process.exit(failed > 0 ? 1 : 0);
