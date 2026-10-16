import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { allPosts } from 'content-collections';

// Phase-1-minimal sitemap: canonical 200-status posts + homepage.
// Split-sitemap / diff-gated-lastmod logic extends this file in Phase 2.
export default function sitemap(): MetadataRoute.Sitemap {
  const posts: MetadataRoute.Sitemap = [...allPosts]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));

  // Homepage lastmod tracks the newest post (deterministic at build time —
  // no current-time calls, which prerender forbids). Phase 2 extends this
  // with diff-gated lastmod logic.
  const lastModified = posts[0]?.lastModified ?? '2026-10-16T00:00:00.000Z';

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    ...posts,
  ];
}
