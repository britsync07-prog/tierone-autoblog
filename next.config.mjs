import { withContentCollections } from '@content-collections/next';

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
};

export default withContentCollections(nextConfig);
