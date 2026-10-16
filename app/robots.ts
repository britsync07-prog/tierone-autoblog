import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Strict crawl policy (T-02-04): allow everything, never site-wide Disallow.
// No Disallow lines for _next/static or images either — starving rendering
// assets degrades how Google renders (and ranks) pages.
//
// Sitemap discovery: Next.js generates NO index for generateSitemaps()
// shards (and reserves the /sitemap.xml path for the sharded metadata route,
// so an explicit index route there fails the build). The sitemap protocol
// allows multiple Sitemap: lines, so both shards are declared directly —
// Google and Bing consume every listed sitemap without needing an index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: [`${SITE_URL}/sitemap/0.xml`, `${SITE_URL}/sitemap/1.xml`],
  };
}
