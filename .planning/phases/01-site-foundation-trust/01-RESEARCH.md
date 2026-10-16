# Phase 1: Site Foundation + Trust — Research

**Researched:** 2026-10-16 (inline — subagent depth limit prevented spawning `gsd-phase-researcher`; research conducted directly from `.planning/research/*` + CONTEXT.md)
**Status:** Ready for planning
**Confidence:** HIGH on stack/scaffold/template direction (official Next.js 16 docs + STACK.md registry facts); MEDIUM on Cloudflare-front cache rules + exact dependency pins (verify at scaffold time).

## 1. What the planner must know

Phase 1 builds the **render-layer foundation only** (ARCHITECTURE.md §Suggested Build Order steps 1–2, partial 7): a greenfield Next.js scaffold with a CWV-budgeted article template, trust pages, programmatic OG images, and edge deployment. No pipeline, no QA gates, no cron, no silo landings — but the template **must not block Phase 2** (flat `/blog/{slug}` URLs from day one, breadcrumb-ready hierarchy, single-source SEO strings, noindex-by-default archives).

## 2. Locked stack (from STACK.md + CONTEXT.md — non-negotiable)

| Piece | Decision | Notes |
|---|---|---|
| Framework | Next.js 16.x latest via `create-next-app@latest` (App Router, Turbopack default) | Do NOT start on 14. React 19.2 bundled, Node 22 LTS, pin `engines` in package.json |
| Styling | Tailwind CSS v4 (CSS-first config) + `@tailwindcss/typography` | Verify exact pin `create-next-app` produces at scaffold time |
| Content layer | `@content-collections/core` + `@content-collections/mdx` + `@content-collections/next`, latest at scaffold | Contentlayer is dead (App Router-incompatible). zod schema is the contract: title 50–60 chars, description 150–160, slug format, FAQ 3–5 items |
| Validation | zod ^3/^4 latest | Frontmatter schema enforced at build; malformed post = build fail, never silent |
| Markdown | remark-gfm, rehype-slug, rehype-autolink-headings, rehype-pretty-code (shiki) | GFM tables + stable heading anchors required for TOC; Shiki is server-rendered (zero client JS) |
| SEO libs | next-seo ^7 (JSON-LD components ONLY) + schema-dts | Meta tags come from native Metadata API. v7 is RSC-safe with CSP `nonce`. Phase 1 needs only Organization/WebSite base schema in layout; Article/BreadcrumbList builders arrive in Phase 2 — but layout must be structured so Phase 2 injects per-post JSON-LD without rework |
| OG images | `@vercel/og` + `opengraph-image.tsx` routes | Brand title-card per post: title + mark on light editorial bg. No design work, generated at build/request |
| Analytics | Plausible snippet in root layout (`<script defer data-domain="exclusivesources.online">`) | ~1–2.5 KB, no cookie banner (matters for UK GDPR later). GA4 explicitly deferred |
| Locale | Single-locale en-US launch (+ x-default canonical self-ref in metadata) | No en-GB/CA/AU variants in v1 — near-duplicate cluster risk on zero-authority domain |

## 3. Scaffold procedure (exact order)

1. `npx create-next-app@latest <dir> --typescript --tailwind --app --src-dir=false --import-alias="@/*"` — accept Next 16.x, React 19, Tailwind v4 pins; record exact versions in commit message.
2. Install content + validation: `@content-collections/core @content-collections/mdx @content-collections/next zod`.
3. Install rendering/SEO: `@tailwindcss/typography next-seo schema-dts remark-gfm rehype-slug rehype-autolink-headings rehype-pretty-code shiki @vercel/og`.
4. Wire `@content-collections/next` per its docs (postinstall/build wiring — verify latest major at scaffold; fallback chain: fumadocs-mdx → zod-guarded hand-rolled `fs` loader, in that order).
5. `content/posts/*.mdx` flat files; frontmatter = source of truth (slug, title, description, publishedAt/updatedAt, author ref, faq[], tags/silo tag for forward-compat, hero/og refs).
6. `mdx-components.tsx` global MDX components (callouts, tables, TL;DR box, code block w/ copy button wiring).
7. Routes: `app/page.tsx` (latest-posts index), `app/blog/[slug]/page.tsx` (+ `generateStaticParams`), `app/about/page.tsx`, `app/editorial-process/page.tsx`, `app/contact/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/authors/musfiqur-rahman-saimon/page.tsx`, `app/opengraph-image.tsx` (site default) + `app/blog/[slug]/opengraph-image.tsx` (per-post).
8. `app/sitemap.ts` + `app/robots.ts` — Phase-1-minimal (list canonical 200-status posts + static trust pages; full split-sitemap/diff-gated-lastmod logic is Phase 2, but these files must exist now so Phase 2 extends rather than retrofits).
9. `vercel.json` (no cron in Phase 1 — cron arrives Phase 5), `next.config.mjs` (image formats AVIF/WebP), strict `tsconfig`, Lighthouse CI config gating template changes.

## 4. Template spec (from CONTEXT.md D-05…D-11 + FEATURES.md post-template)

- Narrow measure ~65ch (`max-w-[65ch]` article column); sticky TOC sidebar on desktop (`lg:` breakpoint, `position: sticky`), collapsed to inline details/TOC block on mobile.
- TL;DR `<aside>` answer box inside first 100 words (mandatory per pipeline contract); visual weight at implementer's discretion.
- Rich structured body: short paragraphs, bold takeaways, tinted callout boxes (info/warning/success variants), striped comparison tables (sticky header where long), Shiki server-highlighted code blocks with copy buttons, GFM tables, heading anchors on every H2/H3 (`rehype-slug` + autolink).
- Static-plus-touches ONLY: reading-progress bar + code copy buttons + heading anchors. A reading-progress bar needs a tiny client island (`"use client"`, scroll listener) — that is the entire client JS budget for article pages. No FAQ accordions (static FAQ list in Phase 1 per D-08), no share widgets.
- System font stack only — zero webfont requests. `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (plus system mono for code).
- Invisible fixed-dimension ad slots reserved now (e.g., in-article `min-h-[250px]` + below-TOC containers with `aria-hidden`, no network requests, no CLS when later activated). Slots must be verifiably empty: no ad script tags anywhere.
- Homepage: simple latest-posts index (title, excerpt, date, reading time). No silo assumptions (D-09).
- Brand: clean editorial light — white bg, near-black text, ONE restrained accent (indigo/blue). Minimal inline SVG mark + wordmark (D-02). No dark mode, no toggle.

## 5. Trust pages spec (D-12…D-17)

- Author page `/authors/musfiqur-rahman-saimon`: real byline — Musfiqur Rahman Saimon, Full-Stack Product Engineer (Bangladesh), "Shipping complete, production-grade products", philosophy "Paper-trade it, test it, then deploy it", currently building AI-powered tooling & agent integrations (MCP). Outbound links to LinkedIn (`https://www.linkedin.com/in/musfiqur-rahman-saimon-a5994b3aa`) + GitHub (`https://github.com/britsync07-prog`); location stated factually. Photo: real owner-supplied headshot at `public/images/author.jpg`; build-time fallback renders initials monogram ("MS") when the file is absent — implement as `fs.existsSync`-style check or `onError` swap, documented.
- About page + separate editorial-process page (two pages, not folded). Process page carries the AI-assistance disclosure (how AI is used, human accountability, sourcing standards).
- Every post renders a visible AI-assistance badge/note linking to `/editorial-process` (D-16, per-post disclosure).
- Contact: email-link only, `saimon@ascentraconsulting.co.uk` displayed as-is (`mailto:`), no form, no backend, no API route.
- Privacy/Terms: generator-based pages adapted to the site now (state cookie-less/Plausible posture, no accounts, no UGC); counsel review explicitly deferred — add footer note "last reviewed {date}, counsel review pending revenue".

## 6. Seed posts (D-18…D-20)

- 5 posts, AI-tools focus (highest Tier-1 volume + publisher background fit). Suggested topics (implementer may substitute within AI-tools, keeping template conformance): (1) best AI writing assistants 2026 comparison, (2) ChatGPT vs Claude for coding, (3) best free AI image generators, (4) AI productivity tools roundup, (5) how to write better AI prompts (beginner guide).
- Each seed is FULLY template-conformant: H1 50–60 chars, meta 150–160 chars, TL;DR ≤100 words, H2/H3 body, ≥1 comparison table + lists, 3–5 genuine FAQs, conclusion + CTA. They become the Phase 3 pipeline reference fixtures — not throwaways.
- Slugs flat: `/blog/{slug}` (Phase-2-compatible from day one).

## 7. Edge + deployment (GEO-02 / D-04)

- Domain `exclusivesources.online`. Vercel project (US region/`iad1` preferred) + Cloudflare CDN front (DNS). HTTPS everywhere (HSTS via Vercel + Cloudflare "Always Use HTTPS").
- Cloudflare cache rules: **bypass cache for HTML** (posts must revalidate fast on publish), **long-cache hashed `/_next/static/*` assets**, never cache `sitemap.xml`/`robots.txt` longer than minutes. Googlebot: no blocking rules, no "Crawler Hints" as substitute for real submission (Phase 5 concern, but rules must not block crawlers now).
- Correct behavior is verified post-deploy (fetch as Googlebot UA, check `cache-status`/`age` headers, `https://exclusivesources.online/sitemap.xml` 200, `robots.txt` 200).

## 8. Performance budget (SITE-01)

- Lighthouse 90+ mobile on homepage + post template; LCP < 2.5s, INP < 200ms, CLS < 0.1. Enforcement: Lighthouse CI config in repo gating template changes (not every post). Budget tactics: zero webfonts, zero client JS except progress island, `next/image` AVIF/WebP with explicit dimensions, hero/OG preload, Shiki server-rendered (no runtime highlighter).
- Plausible script `defer`red; no other third-party scripts in v1.

## 9. Pitfalls relevant to Phase 1 (from PITFALLS.md)

- Fabricated E-E-A-T: real identity only (D-12/D-17) — never generate placeholder authors/avatars.
- Cloudflare-in-front-of-Vercel misconfiguration (double-caching stale HTML/assets, TTFB inflation) — resolve with explicit cache rules + post-deploy verification.
- Category-in-URL hard silos — flat `/blog/{slug}` now so Phase 2 never needs redirects.
- Schema decoupled from visible content — single frontmatter source renders BOTH visible FAQ/breadcrumbs AND JSON-LD (same strings, same map).
- FAQPage schema is hygiene only (rich results removed May 2026) — keep markup cheap, don't over-invest.

## 10. Open items / verify at scaffold

- Exact Content Collections major + Tailwind v4 pin from `create-next-app` output (record in plan SUMMARY).
- `@content-collections/next` build wiring for Next 16 (docs may lag; fallback chain above).
- Cloudflare cache-rule exact UI/API steps + post-deploy Googlebot-fetch proof.
- next-seo v7 RSC usage (`ArticleJsonLd` etc. only where needed; Phase 1 layout-level Organization/WebSite).

## 11. Validation Architecture (Nyquist input)

Test infrastructure for Phase 1 is **static-assertion + build-gate** based (greenfield scaffold; no unit-testable business logic yet):
- Framework: Node 22 + `next build` / `next lint` + Lighthouse CI + grep-able file/content assertions.
- Wave 0: none (no test framework needed; verification = build exit 0 + LHCI scores + content grep checks). Each PLAN's `<verify><automated>` uses concrete commands (`npm run build`, `npx tsc --noEmit`, `grep -c` with `grep -v '^#'` hygiene, `npx lhci autorun` where applicable).
- Manual-only: visual editorial-light check, OG unfurl check (opengraph.xyz / Twitter validator), Googlebot-UA fetch.

---
*Research for Phase 1 planning. Downstream: planner must honor every D-XX above; RES- items map to plans in 01-PLAN files.*
