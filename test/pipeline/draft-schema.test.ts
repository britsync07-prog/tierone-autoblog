// TDD RED tests for lib/pipeline/draft-schema.ts (Plan 03-04 task 1).
//
// draft-schema is the SINGLE zod source for post frontmatter (T-03-09) and
// the build-fail gate for untrusted pipeline/frontmatter shapes (T-03-08):
// content-collections.ts imports draftSchema at build time, and the Phase-3
// draft stage will import the same module — one contract, never re-declared
// (binding fully-free/directive recorded in 03-CONTEXT.md: draft-schema.ts
// alone owns the schema).
//
// Phase-2 verification precedent: suites never import site code — these
// tests read content/posts/seed-01-* frontmatter as TEXT, so the schema's
// acceptance target is the real committed file, not a copied fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { draftSchema } from '../../lib/pipeline/draft-schema';

const POSTS_DIR = resolve('content/posts');

type SeedComparison = {
  title?: string;
  note?: string;
  columns: { id: string; label: string }[];
  rows: { cells: string[]; best?: boolean }[];
};

/** Minimal YAML-subset parser for the committed seed frontmatter: quoted
 * one-line scalars, `faq` list items, and the optional `comparison:` block
 * (exact YAML shapes written by Plan 03-04). Unknown-but-blank lines are
 * rejected loudly so the test can never silently pass on a mangled file. */
function parseSeedFrontmatter(raw: string): {
  fm: Record<string, unknown>;
  comparison?: SeedComparison;
} {
  const fences = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  if (!fences) throw new Error('frontmatter fences not found');
  const lines = fences[1].split(/\r?\n/);

  const fm: Record<string, unknown> = {};
  const faq: { q: string; a: string }[] = [];
  const comparison: SeedComparison = { columns: [], rows: [] };
  let section: 'flat' | 'faq' | 'comparison' = 'flat';
  let inSub: 'none' | 'columns' | 'rows' = 'none';
  let sawComparison = false;

  for (const line of lines) {
    let m: RegExpExecArray | null = null;
    if (/^faq:\s*$/.test(line)) {
      section = 'faq';
      continue;
    }
    if (/^comparison:\s*$/.test(line)) {
      sawComparison = true;
      section = 'comparison';
      continue;
    }
    if (section === 'flat' && (m = /^([A-Za-z]+):\s*"(.*)"\s*$/.exec(line))) {
      fm[m[1]] = m[2];
      continue;
    }
    if (section === 'faq') {
      if ((m = /^\s*-\s*q:\s*"(.*)"\s*$/.exec(line))) {
        faq.push({ q: m[1], a: '' });
        continue;
      }
      if ((m = /^\s*a:\s*"(.*)"\s*$/.exec(line))) {
        faq[faq.length - 1].a = m[1];
        continue;
      }
    }
    if (section === 'comparison') {
      if (/^  columns:\s*$/.test(line)) {
        inSub = 'columns';
        continue;
      }
      if (/^  rows:\s*$/.test(line)) {
        inSub = 'rows';
        continue;
      }
      if ((m = /^  (title|note):\s*"(.*)"\s*$/.exec(line))) {
        comparison[m[1] as 'title' | 'note'] = m[2];
        continue;
      }
      if (inSub === 'columns') {
        if ((m = /^    - id:\s*"(.*)"\s*$/.exec(line))) {
          comparison.columns.push({ id: m[1], label: '' });
          continue;
        }
        if ((m = /^      label:\s*"(.*)"\s*$/.exec(line))) {
          comparison.columns[comparison.columns.length - 1].label = m[1];
          continue;
        }
      }
      if (inSub === 'rows') {
        if ((m = /^    - cells:\s*\[(.*)\]\s*$/.exec(line))) {
          // Cell values are quoted; match pairs so embedded commas inside
          // cell prose never split the array against us.
          const cells = [...m[1].matchAll(/"([^"]*)"/g)].map((c) => c[1]);
          comparison.rows.push({ cells });
          continue;
        }
        if (/^      best:\s*true\s*$/.test(line)) {
          comparison.rows[comparison.rows.length - 1].best = true;
          continue;
        }
      }
    }
    if (line.trim() !== '') {
      throw new Error(`unparsed frontmatter line: ${JSON.stringify(line)}`);
    }
  }
  if (faq.length > 0) fm.faq = faq;
  return { fm, comparison: sawComparison ? comparison : undefined };
}

function seedPayload(raw: string): Record<string, unknown> {
  const { fm, comparison } = parseSeedFrontmatter(raw);
  return comparison ? { ...fm, comparison } : { ...fm };
}

function seedRaw(file: string): string {
  return readFileSync(resolve(POSTS_DIR, file), 'utf8');
}

const SEED_01_FRONTMATTER = seedPayload(seedRaw('seed-01-best-ai-writing-assistants-2026.mdx'));

test('T1: draftSchema accepts the committed seed-01 frontmatter verbatim', () => {
  const parsed = draftSchema.parse(SEED_01_FRONTMATTER);
  assert.equal(parsed.title, SEED_01_FRONTMATTER.title);
  assert.equal(parsed.silo, 'ai-writing');
  assert.ok(Array.isArray(parsed.faq) && parsed.faq.length >= 3 && parsed.faq.length <= 5);
});

test('T2: comparison with a row wider than its columns fails "one cell per column"', () => {
  const result = draftSchema.safeParse({
    ...SEED_01_FRONTMATTER,
    comparison: {
      columns: [
        { id: 'tool', label: 'Tool' },
        { id: 'price', label: 'Price shape' },
        { id: 'verdict', label: 'Verdict' },
      ],
      rows: [
        { cells: ['A', 'B', 'C'] },
        { cells: ['A', 'B', 'C', 'D'] },
      ],
    },
  });
  if (result.success) assert.fail('a 4-cell row under 3 columns parsed — refine missing');
  assert.ok(
    result.error.issues.some((i) => i.message.includes('one cell per column')),
    `expected the row-width refine error, got: ${JSON.stringify(result.error.issues)}`,
  );
});

test('T2b: a well-shaped comparison parses and keeps its structured rows', () => {
  const parsed = draftSchema.parse({
    ...SEED_01_FRONTMATTER,
    comparison: {
      columns: [
        { id: 'tool', label: 'Tool' },
        { id: 'fit', label: 'Best for' },
      ],
      rows: [
        { cells: ['Jasper', 'Marketing teams'], best: true },
        { cells: ['Rytr', 'Budget users'] },
      ],
      title: 'Head to head',
      note: 'Prices shift often.',
    },
  });
  assert.deepEqual(parsed.comparison?.columns, [
    { id: 'tool', label: 'Tool' },
    { id: 'fit', label: 'Best for' },
  ]);
  assert.equal(parsed.comparison?.rows[0].best, true);
});

test('T3: heroImage src outside /images/{slug}/{name}.avif|webp fails (Plan 03-05 shape)', () => {
  for (const src of ['/images/hero.avif', '/images/ai-writing/hero.png', 'https://cdn.example.com/x.webp']) {
    const result = draftSchema.safeParse({
      ...SEED_01_FRONTMATTER,
      heroImage: { src, alt: 'A concrete editorial hero description' },
    });
    if (result.success) assert.fail(`heroImage src accepted but should fail: ${src}`);
    assert.ok(
      result.error.issues.some((i) => i.path.includes('src')),
      `expected an issue at heroImage.src for: ${src}`,
    );
  }
  const valid = draftSchema.safeParse({
    ...SEED_01_FRONTMATTER,
    heroImage: {
      src: '/images/ai-writing/hero.avif',
      alt: 'A concrete editorial hero description',
    },
  });
  assert.ok(valid.success, 'a well-shaped heroImage should parse');
});

test('T4: every committed seed frontmatter passes draftSchema (5-seed build parity)', () => {
  const files = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .sort();
  assert.equal(files.length, 5, 'fixture expectation: exactly 5 seed posts');
  for (const file of files) {
    const raw = seedRaw(file);
    const result = draftSchema.safeParse(payloadFor(raw));
    if (!result.success) {
      assert.fail(
        `${file}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }
  }
});

function payloadFor(raw: string): Record<string, unknown> {
  return seedPayload(raw);
}
