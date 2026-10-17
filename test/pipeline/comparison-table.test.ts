// TDD RED tests for components/comparison-table.tsx (Plan 03-04 task 2).
//
// PIPE-04/D-14 render half: frontmatter comparison DATA flows from the zod
// gate (lib/pipeline/draft-schema.ts) into a shared SERVER component — zero
// client JS, plain React-escaped strings in cells (T-03-10: worst case is
// visual noise in one post, never an execution path).
//
// The post-page contract (page.tsx) is asserted as a SOURCE probe per the
// Phase-2 verification precedent (suites never import site code): the render
// slot must be comparison-gated (absent frontmatter → no render) and sit
// immediately before the MDX body (Wirecutter early-table pattern).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ComparisonTable from '../../components/comparison-table';

type Props = {
  columns: { id: string; label: string }[];
  rows: { cells: string[]; best?: boolean }[];
  title?: string;
  note?: string;
};

function render(props: Props): string {
  return renderToStaticMarkup(
    React.createElement(ComparisonTable as React.FC<Props>, props),
  );
}

const BASE: Props = {
  columns: [
    { id: 'tool', label: 'Tool' },
    { id: 'fit', label: 'Best for' },
  ],
  rows: [
    { cells: ['Jasper', 'Marketing teams'], best: true },
    { cells: ['Rytr', 'Budget users'] },
    { cells: ['Grammarly', 'Editing passes'] },
  ],
};

test('T1: 2 columns / 3 rows renders table markup with th scope=col, cells, and the data hook', () => {
  const html = render(BASE);
  assert.ok(html.includes('data-comparison-table'), 'missing data-comparison-table hook');
  assert.ok(/<table/.test(html), 'must render a real <table>');
  assert.ok(html.includes('scope="col"'), 'missing th scope=col');
  assert.ok(html.includes('<td'), 'cells must render as real td elements');
  for (const label of ['Tool', 'Best for']) {
    assert.ok(html.includes(label), `missing column label: ${label}`);
  }
  for (const cell of ['Jasper', 'Rytr', 'Grammarly', 'Marketing teams', 'Budget users', 'Editing passes']) {
    assert.ok(html.includes(cell), `missing cell text: ${cell}`);
  }
});

test('T1b (plan verify probe): markup assertions from the plan verify line all pass', () => {
  const html = render({ ...BASE, title: 'Head to head', note: 'Prices shift often.' });
  const ok =
    /data-comparison-table/.test(html) &&
    /scope="col"/.test(html) &&
    /aria-label="best pick"/.test(html) &&
    /Head to head/.test(html);
  assert.ok(ok, 'plan verify markup probe failed');
});

test('T2: best:true row carries the tint class and an aria-labelled star, others stay clean', () => {
  const html = render(BASE);
  assert.ok(/aria-label="best pick"/.test(html), 'missing aria-labelled star on the best row');
  assert.ok(html.includes('★'), 'missing the visual star glyph');
  const trs = html.match(/<tr[^>]*>/g) ?? [];
  assert.equal(trs.length, 4, 'expected 1 header tr + 3 body tr');
  assert.equal(
    trs.filter((t) => t.includes('bg-indigo-50')).length,
    1,
    'exactly the best row carries the indigo tint',
  );
  const headerTr = html.slice(html.indexOf('<tr'), html.indexOf('</tr>'));
  assert.ok(!headerTr.includes('bg-indigo-50'), 'header row must not carry the best tint');
});

test('T3: title renders as figcaption, note renders as a muted paragraph; absent props stay absent', () => {
  const withBoth = render({ ...BASE, title: 'Head to head', note: 'Prices shift often.' });
  assert.ok(/<figcaption[^>]*>Head to head<\/figcaption>/.test(withBoth), 'figcaption must contain the title');
  assert.ok(/<p[^>]*>Prices shift often\.<\/p>/.test(withBoth), 'note must render inside a <p>');

  const withNeither = render({ columns: BASE.columns, rows: BASE.rows });
  assert.ok(!withNeither.includes('<figcaption'), 'no figcaption without title');
  assert.ok(!/<p/.test(withNeither), 'no note <p> without note');
});

test('T4 (source probe): page render slot is comparison-gated and sits before the MDX body call', () => {
  const src = readFileSync(resolve('app/blog/[slug]/page.tsx'), 'utf8');
  const slot = /post\.comparison\s*&&\s*\(?\s*<ComparisonTable\s*\{\.\.\.post\.comparison\}\s*\/>/.exec(
    src,
  );
  assert.ok(slot, 'missing comparison-gated ComparisonTable render slot in page.tsx');
  const bodyCall = src.indexOf('<ArticleBody code={post.mdx} />');
  assert.ok(bodyCall >= 0, 'ArticleBody call site moved');
  assert.ok(
    slot.index < bodyCall,
    'ComparisonTable slot must render BEFORE the MDX body call (early-table pattern)',
  );
  // Phase-2 related-posts contract must remain in place untouched.
  assert.ok(src.includes('<RelatedPosts'), 'related-posts block must stay wired');
});
