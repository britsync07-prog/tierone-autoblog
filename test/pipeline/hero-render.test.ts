// TDD tests for Plan 03-05 task 3 — hero/OG render wiring in
// app/blog/[slug]/page.tsx + the img → next/image mapping in
// mdx-components.tsx.
//
// Phase-2 precedent (02-04/03-04): suites NEVER import site code. These are
// SOURCE probes of the two site files (text-scanned with SandboxedSource),
// plus the byte-compat contract: every branch added for heroImage posts is
// CONDITIONAL, so posts without hero art (all 5 seeds today) must render
// exactly as before — the prerender build probe after this suite's GREEN
// run verifies the served window (og=fallback, no fetchpriority for seeds).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function siteSource(path: string): string {
  return readFileSync(path, 'utf8');
}

const PAGE = 'app/blog/[slug]/page.tsx';
const MDX = 'mdx-components.tsx';

test('page: hero render slot exists — next/image with priority + fetchPriority=high under LCP contract', () => {
  const src = siteSource(PAGE);
  assert.match(src, /import Image from 'next\/image';/, 'next/image imported');
  // the ONLY new branch: heroImage-gated, seeds never take it
  assert.match(src, /\{post\.heroImage \? \(/, 'hero slot is a post.heroImage conditional');
  assert.match(src, /<Image\s+src=\{post\.heroImage\.src\}/, 'hero Image binds post.heroImage.src');
  assert.match(src, /alt=\{post\.heroImage\.alt\}/, 'hero alt flows from frontmatter (pipeline-validated)');
  assert.match(src, /width=\{1280\}/, 'hero renders at the 1280x720 asset dims');
  assert.match(src, /height=\{720\}/, 'hero renders at the 1280x720 asset dims');
  assert.match(src, /priority/, 'LCP preload: priority');
  assert.match(src, /fetchPriority="high"/, 'LCP preload: fetchPriority=high');
  assert.match(src, /sizes="\(min-width: 768px\) 42rem, 100vw"/, 'responsive sizes hint');
});

test('page: order contract — hero slot renders before the comparison slot and the MDX body', () => {
  const src = siteSource(PAGE);
  const byline = src.indexOf('<Byline');
  const hero = src.indexOf('post.heroImage ? (');
  const comparison = src.indexOf('{post.comparison && <ComparisonTable');
  const body = src.indexOf('<ArticleBody');
  assert.ok(byline !== -1 && hero !== -1 && comparison !== -1 && body !== -1);
  assert.ok(byline < hero, 'hero sits below the byline');
  assert.ok(hero < comparison, 'hero above the comparison table (Wirecutter early-table kept)');
  assert.ok(comparison < body, 'comparison stays immediately before the body (03-04 order)');
});

test('page: OG branch — hero posts get the 1280x720 AVIF first + 1200x630 og.jpg second; seeds keep the @vercel/og fallback', () => {
  const src = siteSource(PAGE);
  // fallback line preserved unchanged
  assert.match(src, /const ogImage = `\/blog\/\$\{slug\}\/opengraph-image`;/, 'Phase-1 @vercel/og fallback line intact');
  assert.match(src, /: \[\{ url: ogImage, width: 1200, height: 630, alt: post\.title \}\]/, 'seed OG fallback shape unchanged (ternary else-branch)');
  // hero branch: SITE_URL-prefixed absolute AVIF first, then the same-art og.jpg crop
  assert.match(src, /post\.heroImage\.src/, 'OG hero branch reads the frontmatter src');
  assert.match(src, /\$\{SITE_URL\}\$\{post\.heroImage\.src\}/, 'first OG entry is the site-absolute hero AVIF');
  assert.match(src, /post\.heroImage\.src\.replace\(/, 'og.jpg path DERIVED from the frontmatter hero src (string replace, never re-declared)');
  assert.match(src, /'og\.jpg'/, 'og crop targets the og.jpg basename — hero.avif -> og.jpg is not a plain extension swap');
  assert.match(src, /width: 1280,/, 'first OG entry is 1280x720');
  assert.match(src, /width: 1200,/, 'second OG entry is the 1200x630 crop');
});

test('mdx: img markdown nodes map to next/image (lazy, 1080x608 in-article dims, sizes hint)', () => {
  const src = siteSource(MDX);
  assert.match(src, /import Image from 'next\/image';/, 'next/image imported for MDX img mapping');
  assert.match(src, /img: \(\{[^}]*alt/, 'img mapping destructure carries the alt (enforced at the draft gate)');
  assert.match(src, /width=\{1080\}/, 'in-article fallback dims (1080x608, D-13)');
  assert.match(src, /height=\{608\}/);
  assert.match(src, /sizes="\(min-width: 768px\) 42rem, 100vw"/, 'responsive sizes hint');
});
