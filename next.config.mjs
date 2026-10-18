import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withContentCollections } from '@content-collections/next';

function loadJsonRedirects() {
  try {
    const file = resolve('content/redirects.json');
    if (!existsSync(file)) return [];
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item && typeof item === 'object' && item.source && item.destination)
      .map((item) => ({
        source: String(item.source),
        destination: String(item.destination),
        permanent: item.permanent ?? true,
      }));
  } catch (err) {
    console.warn('[next.config.mjs] Failed to load content/redirects.json:', err);
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Classic App Router caching model (not Cache Components): the posts
  // collection is legitimately EMPTY in pre-seed builds (UI-SPEC §3 empty
  // state; seeds land in Plan 04), and Cache Components hard-fails the build
  // when generateStaticParams returns [] (empty-generate-static-params).
  // Classic model: empty params = paths render on demand; non-empty params
  // = fully static prerender — exactly the rebuild-per-publish posture in
  // STACK.md. Revisit only if partial-prerendering is ever needed.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Edge/security posture (T-01-01): HSTS + hardening headers on every route.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/:key([a-zA-Z0-9_-]+).txt',
        destination: '/api/indexnow?key=:key',
      },
    ];
  },
  async redirects() {
    return loadJsonRedirects();
  },
};

export default withContentCollections(nextConfig);
