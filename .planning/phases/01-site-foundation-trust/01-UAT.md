---
status: testing
phase: 01-site-foundation-trust
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md]
started: 2026-10-17T02:30:00.000Z
updated: 2026-10-17T02:30:00.000Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Homepage loads with 5 seed posts
expected: |
  Visit `/`. See H1 brand + tagline, 5 post cards newest-first with title link, excerpt, date·min-read. No empty-state message. Header nav + footer render.
awaiting: user response

## Tests

### 1. Homepage loads with 5 seed posts
expected: Visit `/`. See H1 brand + tagline, 5 post cards newest-first with title link, excerpt, date·min-read. No empty-state message. Header nav + footer render.
result: [pending]

### 2. Read a seed article end-to-end
expected: Open `/blog/best-ai-writing-assistants-2026` (or any seed). See TL;DR box first, sticky desktop TOC + mobile details TOC, 3+ H2s with `#` anchors, comparison table, list, code block with copy button, callout box, bold takeaway per H2, static FAQ (3-5 Q&As), conclusion + About CTA, byline with date and min-read + AI badge linking to /editorial-process, breadcrumb Home/Blog/title, reading progress bar on scroll.
result: [pending]

### 3. Trust pages resolve
expected: Visit `/authors/musfiqur-rahman-saimon` (real role/focus/philosophy lines, LinkedIn + GitHub links, MS monogram, no fake portrait), `/about`, `/editorial-process` (4 exact H2s incl. AI assistance disclosure), `/contact` (mailto saimon@ascentraconsulting.co.uk, no form), `/privacy` + `/terms` (both end with counsel-deferral sentence). All static, correct titles.
result: [pending]

### 4. Share unfurl (OG/Twitter)
expected: Page source of any post contains og:title, og:image pointing at /blog/{slug}/opengraph-image, og:image:width 1200 / height 630, twitter:card summary_large_image. Opening `/blog/{slug}/opengraph-image` and `/opengraph-image` directly returns 200 image/png 1200x630 card (white canvas, indigo bar, title, brand).
result: [pending]

### 5. Performance / CWV budget
expected: Pages feel instant, no layout shift, no webfont flash, code blocks styled immediately. `npm run build` green, `npx tsc --noEmit` green, `node scripts/check-seeds.mjs` prints 5 passed. LHCI median >= 0.9 (home 0.95 / post 0.93 in docs/deploy-verify.md 3a). Only third-party script is Plausible.
result: [pending]

### 6. Crawler + edge posture
expected: `/sitemap.xml` lists homepage + 5 posts with canonical SITE_URL URLs, `/robots.txt` returns 200. Seed URL fetched as Googlebot returns 200 with no noindex / x-robots-tag. Security headers present (HSTS, nosniff, DENY framing). docs/edge-cdn.md + docs/deploy-verify.md document Vercel iad1 + Cloudflare rules; production rows honestly PENDING DNS (owner step, not a code gap).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

[none yet]
