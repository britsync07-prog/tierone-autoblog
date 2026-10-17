#!/usr/bin/env node
// Structure lint for PIPE-02 outline artifacts (Plan 03-03 task 3, D-12).
// Zero-dep ESM in the check-seeds/check-registry family idiom: parses the
// committed outline Markdown AS TEXT, prints precise FAIL lines, prints
// `N passed`, exits 0/1. This is the mechanical pre-draft gate: the draft
// stage (Plan 03-06) re-asserts outline.lint === 'pass' before any LLM draft
// call, and no entry may reach 'outlined' without this gate passing.
//
// Usage: node scripts/check-outline.mjs [dir-or-file]
//   - dir (default: content/briefs): lints every *-outline.md under it,
//     recursively (silo subdirs included)
//   - file: lints that single outline (this is what the outline stage spawns
//     per candidate — precise per-entry gating)
//
// Rules (plan task-3 interfaces):
//   1. H1 value 50-60 chars            (line `- H1 (50-60 chars): ...`)
//   2. Meta description 150-160 chars  (line `- Meta description (150-160 chars): ...`)
//   3. TL;DR present, 10-100 words     (line `- TL;DR (<=100 words): ...`)
//   4. >=3 real content H2s under ## Structure (template shape
//      `## {H2} — target ~N words` — the marker IS the template contract)
//   5. FAQ block has 3-5 `- Q:` entries
//   6. Every FAQ Q appears in the sibling brief's `## FAQ candidate questions`
//      section (cross-file check — invented questions fail the build). Wave-2
//      reality: paa[] is empty platform-wide, so the candidate section carries
//      DERIVED questions with honest provenance — the cross-check is against
//      that section, never against a captured-PAA list that does not exist.
//   7. `## Image slots` block present with a `- hero:` line
//   8. `[comparison-table slot]` marker at most once
//   9. No `_tbd_`/`TBD` placeholders anywhere
//
// Missing target directory (e.g. a fresh clone before the first pipeline run):
// vacuous pass `0 passed` — nothing to guard yet. An EXPLICIT arg that does
// not exist fails honestly (exit 1).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const RULES = 9;

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function metaValue(md, prefix) {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.*)$`, 'm');
  const m = re.exec(md);
  return m === null ? null : m[1].trim();
}

/** FAQ candidate questions from the sibling brief, or null when the brief is
 * missing (cross-check then fails closed — an outline without its brief has
 * no provenance to verify against). */
function briefFaqCandidates(briefPath) {
  if (!existsSync(briefPath)) return null;
  const lines = readFileSync(briefPath, 'utf8').split(/\r?\n/);
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (/^## /.test(line)) {
      inSection = /^## FAQ candidate questions/i.test(line);
      continue;
    }
    if (inSection && /^- /.test(line)) out.push(norm(line.slice(2)));
  }
  return out;
}

/** Lint one outline file. Returns the list of FAIL messages (empty = pass). */
function lintOutline(outlinePath) {
  const rel = relative(process.cwd(), outlinePath);
  const md = readFileSync(outlinePath, 'utf8');
  const fails = [];

  // 1. H1 value 50-60 chars
  const h1 = metaValue(md, '- H1 (50-60 chars): ');
  if (h1 === null) fails.push(`${rel}: rule 1 — no '- H1 (50-60 chars): ' line (template violation)`);
  else if (h1.length < 50 || h1.length > 60) fails.push(`${rel}: rule 1 — H1 length ${h1.length} outside the 50-60 window: "${h1}"`);

  // 2. Meta description 150-160 chars
  const meta = metaValue(md, '- Meta description (150-160 chars): ');
  if (meta === null) fails.push(`${rel}: rule 2 — no '- Meta description (150-160 chars): ' line (template violation)`);
  else if (meta.length < 150 || meta.length > 160) fails.push(`${rel}: rule 2 — meta description length ${meta.length} outside the 150-160 window`);

  // 3. TL;DR 10-100 words
  const tldr = metaValue(md, '- TL;DR (<=100 words): ');
  if (tldr === null) fails.push(`${rel}: rule 3 — no '- TL;DR (<=100 words): ' line (template violation)`);
  else {
    const words = tldr.split(/\s+/).filter(Boolean).length;
    if (words < 10 || words > 100) fails.push(`${rel}: rule 3 — TL;DR word count ${words} outside the 10-100 window`);
  }

  // 4. >=3 real content H2s under ## Structure (template marker shape)
  const lines = md.split(/\r?\n/);
  let inStructure = false;
  let h2Count = 0;
  for (const line of lines) {
    if (line.trimEnd() === '## Structure') {
      inStructure = true;
      continue;
    }
    // Template-shaped H2s ARE the Structure content — count them and keep
    // going. A `## ` line WITHOUT the target marker ends the Structure
    // section (e.g. `## FAQs ...`) — fail-closed: a malformed content H2
    // terminates the count, forcing the exact template shape.
    if (inStructure && /^## .+ — target ~\d+ words\s*$/.test(line)) { h2Count += 1; continue; }
    if (inStructure && /^## /.test(line)) break; // next top-level section begins
  }
  if (!inStructure) fails.push(`${rel}: rule 4 — no '## Structure' section`);
  else if (h2Count < 3) fails.push(`${rel}: rule 4 — only ${h2Count} content H2(s) under ## Structure (need >=3, template shape '## {H2} — target ~N words')`);

  // 5+6. FAQ block count + cross-file provenance check
  let inFaq = false;
  const faqQs = [];
  for (const line of lines) {
    if (/^## /.test(line)) {
      inFaq = /^## FAQs\b/i.test(line);
      continue;
    }
    if (inFaq && /^- Q: /.test(line)) faqQs.push(line.slice(5).trim()); // '- Q: ' is exactly 5 chars
  }
  if (faqQs.length < 3 || faqQs.length > 5) {
    fails.push(`${rel}: rule 5 — FAQ block has ${faqQs.length} '- Q:' entries outside the 3-5 window`);
  }
  const briefPath = join(outlinePath, '..', basename(outlinePath).replace(/-outline\.md$/, '') + '-brief.md');
  const candidates = briefFaqCandidates(briefPath);
  if (candidates === null) {
    fails.push(`${rel}: rule 6 — sibling brief file missing for the FAQ cross-check (every outline needs its brief)`);
  } else {
    for (const q of faqQs) {
      if (!candidates.includes(norm(q))) {
        fails.push(`${rel}: rule 6 — FAQ question not in the brief's candidate list (invented questions fail the build): "${q}"`);
      }
    }
  }

  // 7. Image slots block with a hero line
  let inImages = false;
  let hasHero = false;
  for (const line of lines) {
    if (/^## /.test(line)) {
      inImages = /^## Image slots\b/i.test(line);
      continue;
    }
    if (inImages && /^- hero: /i.test(line)) hasHero = true;
  }
  if (!inImages) fails.push(`${rel}: rule 7 — no '## Image slots' section`);
  else if (!hasHero) fails.push(`${rel}: rule 7 — image slots block has no '- hero:' line (hero is ALWAYS required)`);

  // 8. comparison-table marker at most once
  const markers = (md.match(/\[comparison-table slot\]/g) ?? []).length;
  if (markers > 1) fails.push(`${rel}: rule 8 — '[comparison-table slot]' marker appears ${markers} times (at most once)`);

  // 9. no placeholders
  if (/_tbd_|TBD/.test(md)) fails.push(`${rel}: rule 9 — placeholder text (_tbd_/TBD) found — outlines must be complete`);

  return fails;
}

function collectOutlineFiles(target) {
  if (statSync(target).isFile()) return [target];
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('-outline.md')) out.push(p);
    }
  };
  walk(target);
  return out.sort();
}

const explicitArg = process.argv[2];
const target = resolve(explicitArg ?? join('content', 'briefs'));

if (!existsSync(target)) {
  if (explicitArg) {
    console.error(`FAIL: target does not exist: ${explicitArg}`);
    process.exit(1);
  }
  console.log(`no outline files yet under ${target} — nothing to lint (0 passed)`);
  process.exit(0);
}

let files;
try {
  files = collectOutlineFiles(target);
} catch (err) {
  console.error(`FAIL: cannot read target ${target}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

let failed = false;
let passed = 0;
for (const file of files) {
  const fails = lintOutline(file);
  for (const f of fails) {
    console.log(`FAIL: ${f}`);
    failed = true;
  }
  passed += RULES - fails.length;
}
console.log(`${passed} passed`);
process.exit(failed ? 1 : 0);
