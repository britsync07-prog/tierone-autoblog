import type { MetadataRoute } from 'next';
import { AUTHOR_SLUG, SITE_URL } from '@/lib/site';
import { allPosts } from 'content-collections';

// REVIEW_DATE: lastmod for evergreen trust/author pages. Bump this constant
// ONLY when /about, /editorial-process, /contact, /privacy, /terms, or the
// author page actually change — never to build time (diff-gated lastmod:
// sitemap dates must reflect content changes, not rebuilds).
const REVIEW_DATE = '2026-10-16';

// Static trust-page allowlist: the only non-post, non-landing pages that may
// appear in the sitemap. No archive/tag/category/pagination surface exists
// (T-02-05); the crawl-consistency suite fails CI if one is introduced.
const TRUST_PAGES = [
  '/about',
  '/editorial-process',
  '/contact',
  '/privacy',
  '/terms',
] as const;

// Crawl-efficient sharding (SEO-01): shard 0 = posts only, shard 1 = pages
// (homepage + silo landings + trust/author). Lets crawlers re-fetch the small
// pages shard cheaply while the posts shard carries honest per-post lastmods.
export function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }];
}

// Silo landings are derived from DISTINCT silo values in allPosts (sorted
// alphabetically) — data-driven, no import of lib/silos.ts. Wave-1 parallel
// with Plan 01 by design; scripts/check-crawl.mjs asserts parity between the
// two sources instead of coupling them at build time.
function distinctSilos(): string[] {
  return [...new Set(allPosts.map((post) => post.silo))].sort();
}

function siloLastModified(silo: string): string {
  let max = '';
  for (const post of allPosts) {
    if (post.silo === silo && post.updatedAt > max) max = post.updatedAt;
  }
  return max;
}

export default async function sitemap({
  id,
}: {
  // Runtime passes a Promise<string> (see next-metadata-route-loader:
  // `handler({ id: targetIdPromise })`); `await` is a no-op on plain
  // values, so this stays correct if Next ever passes `id` directly.
  id: Promise<string> | string | number;
}): Promise<MetadataRoute.Sitemap> {
  // NOTE: `id` arrives as a promise of the route param (e.g. "0"/"1" —
  // params are async since Next 15), so it MUST be awaited before comparing.
  // A sync `id === 0` check never matches and both shards silently render
  // the same branch (caught by the crawl-consistency suite, group 1).
  const shard = Number(await id);
  // Shard 0 — posts only. lastModified = post.updatedAt (diff-gated by
  // construction: content date, never build time).
  if (shard === 0) {
    return [...allPosts]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((post) => ({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }));
  }

  // Shard 1 — pages. Homepage lastmod tracks the newest post (deterministic
  // at build time — no current-time calls, which prerender forbids).
  const newestPostUpdate = allPosts.reduce(
    (max, post) => (post.updatedAt > max ? post.updatedAt : max),
    '2026-10-16T00:00:00.000Z',
  );

  const landings: MetadataRoute.Sitemap = distinctSilos().map((silo) => ({
    url: `${SITE_URL}/${silo}`,
    lastModified: siloLastModified(silo),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const trust: MetadataRoute.Sitemap = [
    ...TRUST_PAGES.map(
      (path): MetadataRoute.Sitemap[number] => ({
        url: `${SITE_URL}${path}`,
        lastModified: REVIEW_DATE,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      }),
    ),
    {
      url: `${SITE_URL}/authors/${AUTHOR_SLUG}`,
      lastModified: REVIEW_DATE,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  return [
    {
      url: SITE_URL,
      lastModified: newestPostUpdate,
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    ...landings,
    ...trust,
  ];
}
