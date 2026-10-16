// Template-conformance gate for seed posts (Plan 01-04, T-04-01).
// Zero dependencies: parses frontmatter minimally (split on `---`
// fences), asserts lengths/counts/structure per file, scans banned
// vocabulary. Exit 0 + "N passed" on success, exit 1 with FAIL lines
// otherwise. Run: `node scripts/check-seeds.mjs` or `npm run check:seeds`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const POSTS_DIR = fileURLToPath(new URL('../content/posts/', import.meta.url));

const BANNED = [
  'delve',
  'fast-paced world',
  'game-changer',
  'unlock the power',
  "in today's digital age",
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseFrontmatter(raw, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) return { error: 'missing frontmatter fences', fm: {}, body: '' };
  const [, fmBlock, body] = match;
  const fm = {};
  for (const line of fmBlock.split('\n')) {
    const m = /^([A-Za-z]+):\s*(.*)$/.exec(line.trim());
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
  // FAQ entries are `- q:` list items inside the frontmatter block.
  fm.__faqCount = (fmBlock.match(/^\s*-\s*q\s*:/gm) || []).length;
  return { fm, body };
}

function checkFile(file) {
  const failures = [];
  const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
  const { error, fm, body } = parseFrontmatter(raw, file);
  if (error) return [`${file}: FAIL (${error})`];

  const title = fm.title ?? '';
  if (title.length < 50 || title.length > 60)
    failures.push(`title length ${title.length} (want 50-60)`);

  const desc = fm.description ?? '';
  if (desc.length < 150 || desc.length > 160)
    failures.push(`description length ${desc.length} (want 150-160)`);

  if (!SLUG_RE.test(fm.slug ?? ''))
    failures.push(`slug "${fm.slug}" fails slug regex`);

  const expectedSlug = file.replace(/^seed-\d+-/, '').replace(/\.mdx$/, '');
  if (fm.slug !== expectedSlug)
    failures.push(`slug "${fm.slug}" != filename slug "${expectedSlug}"`);

  for (const f of ['publishedAt', 'updatedAt', 'author', 'silo', 'tldr']) {
    if (!fm[f]) failures.push(`missing frontmatter field "${f}"`);
  }
  if (fm.publishedAt && Number.isNaN(Date.parse(fm.publishedAt)))
    failures.push(`publishedAt not a parseable datetime`);
  if (fm.updatedAt && Number.isNaN(Date.parse(fm.updatedAt)))
    failures.push(`updatedAt not a parseable datetime`);

  const tldrWords = (fm.tldr ?? '').split(/\s+/).filter(Boolean).length;
  if (tldrWords > 100) failures.push(`tldr ${tldrWords} words (want <=100)`);
  if (tldrWords === 0) failures.push('tldr empty');

  if (fm.__faqCount < 3 || fm.__faqCount > 5)
    failures.push(`faq count ${fm.__faqCount} (want 3-5)`);

  const h2s = (body.match(/^## .+/gm) || []).length;
  if (h2s < 3) failures.push(`H2 count ${h2s} (want >=3)`);
  if (!body.includes('|')) failures.push('no GFM table marker `|`');
  if (!/^```/m.test(body)) failures.push('no fenced code block');
  if (!/^## Sources/m.test(body)) failures.push('no `## Sources` section');
  if (!body.includes('/about')) failures.push('no /about CTA link');

  const lower = raw.toLowerCase();
  for (const phrase of BANNED) {
    if (lower.includes(phrase)) failures.push(`banned phrase "${phrase}"`);
  }

  if (failures.length === 0) return [`${file}: PASS`];
  return failures.map((f) => `${file}: FAIL (${f})`);
}

const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
if (files.length === 0) {
  console.error('FAIL: no .mdx files in content/posts/');
  process.exit(1);
}

let failed = 0;
let passed = 0;
for (const file of files.sort()) {
  for (const line of checkFile(file)) {
    console.log(line);
    if (line.includes(': PASS')) passed += 1;
    else failed += 1;
  }
}
console.log(`${passed} passed${failed > 0 ? `, ${failed} failed` : ''}`);
process.exit(failed > 0 ? 1 : 0);
