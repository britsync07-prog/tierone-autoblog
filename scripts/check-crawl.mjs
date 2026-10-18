// Crawl-consistency gate for the SEO crawl surface (Plan 02-02, SEO-01/SEO-04).
// Zero dependencies: parses prerendered build output + source directly.
// Run post-build (no server needed): `npm run build && npm run check:crawl`.
// Exit 0 + "N crawl checks passed" on success, exit 1 with FAIL lines
// otherwise. Windows-safe paths via fileURLToPath (check-seeds.mjs precedent).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const POSTS_DIR = join(ROOT, 'content/posts');
const APP_DIR = join(ROOT, 'app');
const SITEMAP_DIR = join(ROOT, '.next/server/app/sitemap');
const ROBOTS_BODY = join(ROOT, '.next/server/app/robots.txt.body');

let passed = 0;
let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`FAIL [${name}]${detail ? ` (${detail})` : ''}`);
  }
}

// ---- ground truth from source (single-source rule: never hardcode) ----

function parseSimpleField(raw, field) {
  const m = new RegExp(`^${field}:\\s*"?([^"\\n]*)"?\\s*$`, 'm').exec(raw);
  return m ? m[1].trim().replace(/["']$/, '') : '';
}

const siteTs = readFileSync(join(ROOT, 'lib/site.ts'), 'utf8');
const SITE_URL = /SITE_URL\s*=\s*'([^']+)'/.exec(siteTs)?.[1] ?? '';
const AUTHOR_SLUG = /AUTHOR_SLUG\s*=\s*'([^']+)'/.exec(siteTs)?.[1] ?? '';

const posts = [];
for (const file of readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith('.mdx'))
  .sort()) {
  const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
  posts.push({
    file,
    slug: parseSimpleField(raw, 'slug'),
    updatedAt: parseSimpleField(raw, 'updatedAt'),
    silo: parseSimpleField(raw, 'silo'),
  });
}
const distinctSilos = [...new Set(posts.map((p) => p.silo))].sort();

const silosTs = readFileSync(join(ROOT, 'lib/silos.ts'), 'utf8');
const SILO_SLUGS = [...silosTs.matchAll(/^\s*'([a-z0-9-]+)',?\s*$/gm)]
  .map((m) => m[1])
  .filter((s) => s.startsWith('ai-'))
  .sort();

function parseSitemapUrls(bodyPath) {
  const xml = readFileSync(bodyPath, 'utf8');
  const urls = [];
  for (const m of xml.matchAll(
    /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g,
  )) {
    urls.push({ loc: m[1].trim(), lastmod: (m[2] ?? '').trim() });
  }
  return urls;
}

// ---- group 1: sharding — index lists exactly shards 0 and 1 ----

const sitemapSrc = readFileSync(join(APP_DIR, 'sitemap.ts'), 'utf8');
check(
  'sitemap-index',
  /generateSitemaps/.test(sitemapSrc) &&
    /\{\s*id:\s*0\s*\}/.test(sitemapSrc) &&
    /\{\s*id:\s*1\s*\}/.test(sitemapSrc),
  'generateSitemaps must return exactly [{ id: 0 }, { id: 1 }]',
);
let shardFiles = [];
try {
  shardFiles = readdirSync(SITEMAP_DIR)
    .filter((f) => f.endsWith('.xml.body'))
    .sort();
} catch {
  shardFiles = [];
}
check(
  'sitemap-index',
  JSON.stringify(shardFiles) === JSON.stringify(['0.xml.body', '1.xml.body']),
  `expected exactly shards 0+1, found: ${shardFiles.join(', ') || '(none — run npm run build first)'}`,
);
// The index itself: Next.js generates NO /sitemap.xml index for
// generateSitemaps() shards (verified live: 404) and reserves that path for
// the sharded metadata route, so an explicit app/sitemap.xml/route.ts fails
// the build with a route/metadata conflict. Discovery is therefore via two
// Sitemap: lines in robots.txt (protocol-standard, no index hop needed).
// This guard fails CI if anyone re-adds the build-breaking index route.
let indexRouteExists = false;
try {
  indexRouteExists = statSync(join(APP_DIR, 'sitemap.xml')).isDirectory();
} catch {
  indexRouteExists = false;
}
check(
  'sitemap-index',
  !indexRouteExists,
  'app/sitemap.xml/ route conflicts with the sharded metadata route and breaks the build — declare shards in robots.ts instead',
);

// ---- group 2: shard 0 — every URL matches a real post slug + updatedAt ----

let shard0 = [];
try {
  shard0 = parseSitemapUrls(join(SITEMAP_DIR, '0.xml.body'));
} catch {
  shard0 = [];
}
const postBySlug = new Map(posts.map((p) => [p.slug, p]));
check(
  'shard0-posts',
  shard0.length === posts.length && shard0.length > 0,
  `shard 0 has ${shard0.length} URLs, posts dir has ${posts.length}`,
);
for (const { loc, lastmod } of shard0) {
  const slug = loc.replace(`${SITE_URL}/blog/`, '');
  const post = postBySlug.get(slug);
  check('shard0-posts', loc.startsWith(`${SITE_URL}/blog/`) && !!post, `unknown post URL ${loc}`);
  if (post) {
    check(
      'shard0-posts',
      lastmod === post.updatedAt,
      `${slug} lastmod ${lastmod || '(missing)'} != updatedAt ${post.updatedAt}`,
    );
  }
}

// ---- group 3: shard 1 — homepage + landings + trust + author, nothing else ----

let shard1 = [];
try {
  shard1 = parseSitemapUrls(join(SITEMAP_DIR, '1.xml.body'));
} catch {
  shard1 = [];
}
const TRUST = ['/about', '/editorial-process', '/contact', '/privacy', '/terms'];
const expected1 = new Set([
  SITE_URL,
  ...distinctSilos.map((s) => `${SITE_URL}/${s}`),
  ...TRUST.map((p) => `${SITE_URL}${p}`),
  `${SITE_URL}/authors/${AUTHOR_SLUG}`,
]);
const actual1 = new Set(shard1.map((u) => u.loc));
for (const url of expected1) {
  check('shard1-pages', actual1.has(url), `shard 1 missing ${url}`);
}
for (const url of actual1) {
  check('shard1-pages', expected1.has(url), `shard 1 has unexpected URL ${url}`);
}
check(
  'shard1-pages',
  shard1.length === expected1.size,
  `shard 1 has ${shard1.length} URLs, expected ${expected1.size}`,
);

// ---- group 4: silo parity — post silos equal SILO_SLUGS, none orphaned ----

check(
  'silo-parity',
  SILO_SLUGS.length === 6,
  `SILO_SLUGS has ${SILO_SLUGS.length} entries (D-07 ships all 6)`,
);
check(
  'silo-parity',
  JSON.stringify(distinctSilos) === JSON.stringify(SILO_SLUGS),
  `post silos [${distinctSilos.join(', ')}] != SILO_SLUGS [${SILO_SLUGS.join(', ')}]`,
);
for (const silo of SILO_SLUGS) {
  const n = posts.filter((p) => p.silo === silo).length;
  check('silo-parity', n >= 1, `silo ${silo} has ${n} posts (D-07: every landing ships with content)`);
}

// ---- group 5: robots — allow:/, no site-wide disallow, sitemap pointer ----

let robots = '';
try {
  robots = readFileSync(ROBOTS_BODY, 'utf8');
} catch {
  robots = '';
}
check('robots', robots.includes('Allow: /'), 'robots.txt missing `Allow: /`');
check(
  'robots',
  !robots.split('\n').some((line) => /^\s*Disallow:\s*\//.test(line)),
  'robots.txt contains a site-wide `Disallow: /` line (T-02-04 deindexation risk)',
);
// Both shards declared directly (no /sitemap.xml index exists — see group 1).
check(
  'robots',
  robots.includes(`${SITE_URL}/sitemap/0.xml`) &&
    robots.includes(`${SITE_URL}/sitemap/1.xml`),
  'robots.txt must declare both shard sitemaps (/sitemap/0.xml + /sitemap/1.xml)',
);

// ---- group 6: noindex surface — no tag/archive/category/pagination routes ----

const FORBIDDEN_SEGMENT = /tag|archive|categor/i;
const ALLOWED_DYNAMIC = new Set(['[slug]', '[silo]']);
const FORBIDDEN_DYNAMIC = /^\[(\.\.\.)?.+\]$/;
const violations = [];
function walkRoutes(dir, rel) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const relPath = rel ? `${rel}/${entry}` : entry;
    const st = statSync(full);
    if (st.isDirectory()) {
      if (FORBIDDEN_SEGMENT.test(entry)) {
        violations.push(`forbidden route segment: ${relPath}/`);
      } else if (FORBIDDEN_DYNAMIC.test(entry) && !ALLOWED_DYNAMIC.has(entry)) {
        violations.push(`forbidden dynamic route (pagination?): ${relPath}/`);
      }
      walkRoutes(full, relPath);
    } else if (FORBIDDEN_SEGMENT.test(entry)) {
      violations.push(`forbidden route file: ${relPath}`);
    }
  }
}
walkRoutes(APP_DIR, '');
check('noindex-surface', violations.length === 0, violations.join('; '));
const layoutTsx = readFileSync(join(APP_DIR, 'layout.tsx'), 'utf8');
check(
  'noindex-surface',
  /index:\s*true/.test(layoutTsx),
  'root layout metadata lost robots index:true',
);

// ---- group 7: no lastmod dated in the future ----

const now = Date.now();
for (const { loc, lastmod } of [...shard0, ...shard1]) {
  const t = Date.parse(lastmod);
  check('lastmod-freshness', !Number.isNaN(t), `${loc} has unparseable lastmod "${lastmod}"`);
  if (!Number.isNaN(t)) {
    check('lastmod-freshness', t <= now, `${loc} lastmod ${lastmod} is in the future`);
  }
}

// ---- report ----

console.log(`${passed} crawl checks passed${failed > 0 ? `, ${failed} failed` : ''}`);
process.exit(failed > 0 ? 1 : 0);
