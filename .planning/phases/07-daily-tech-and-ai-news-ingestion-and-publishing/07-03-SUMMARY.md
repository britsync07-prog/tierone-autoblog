# Phase 7 Plan 03: AI & Tech News Silo (/ai-news) & Schema.org NewsArticle Summary

**Executed Date:** 2026-10-19  
**Plan:** `07-03-PLAN.md`  
**Status:** Completed & Validated  
**Requirement Addressed:** NEWS-03  

---

## Executive Summary

Plan 07-03 delivered the frontend architecture, taxonomy registration, search engine structured data, and crawl integrity gates for the **AI & Tech News Silo** (`/ai-news`) and Schema.org `NewsArticle` integration (NEWS-03).

The platform now officially supports 6 canonical content silos. News articles published under `ai-news` automatically emit Google News-compliant `NewsArticle` JSON-LD structured data to qualify for Top Stories carousels, Google News, and Discover feeds, while evergreen tutorials continue to emit `BlogPosting` structured data. The `/ai-news` hub renders an automated reverse-chronological archive with `CollectionPage` JSON-LD schema, and the site header prominently navigates to `/ai-news`. Initial seed news posts and per-silo keyword registry shards were created and verified across all build-time crawl and template integrity gates.

---

## Delivered Components

### 1. Silo Taxonomy Registration (`lib/silos.ts`)
- Expanded `SILO_SLUGS` from 5 to 6 canonical slugs, adding `'ai-news'`.
- Registered `SILOS['ai-news']` with:
  - `slug`: `'ai-news'`
  - `label`: `'AI & Tech News'`
  - `landingTitle`: `'Breaking AI & Tech News: Daily Analysis & Industry Updates'`
  - `metaDescription`: 154-character description targeting developers and engineers.
  - `intro`: 139-word authoritative intro prose (thin-content safe, satisfying the 120–160 word requirement).

### 2. Schema.org NewsArticle & Structured Data (`lib/seo/jsonld.ts`, `app/blog/[slug]/page.tsx`)
- Exported helper `getArticleSchemaType(silo: string)`:
  - Returns `'NewsArticle'` when `silo === 'ai-news'`.
  - Returns `'BlogPosting'` for evergreen silos.
- Exported `buildNewsArticleJsonLd(post: Post, canonical: string)`:
  - Generates `@type: 'NewsArticle'` payload conforming to Schema.org vocabulary.
  - Includes `headline`, `description`, `url`, `author`, `publisher`, `datePublished`, `dateModified`, `image`, and `mainEntityOfPage`.
- Updated `app/blog/[slug]/page.tsx`:
  - Dynamically passes `type={getArticleSchemaType(post.silo)}` to `<ArticleJsonLd />`.

### 3. News Silo Archive & CollectionPage Schema (`app/[silo]/page.tsx`)
- `generateStaticParams()` automatically supports all 6 silos including `ai-news`.
- Silo landing page renders reverse-chronological archive sorted by `publishedAt` descending.
- Injects Schema.org `CollectionPage` JSON-LD declaring `hasPart` relationships for all published news articles.
- Formats dates cleanly (`formatDate(post.publishedAt) · N min read`).

### 4. Primary Site Navigation (`components/site-header.tsx`)
- Updated `NAV` array to place `AI News` prominently as the first menu item:
  - `{ label: 'AI News', href: '/ai-news' }`
  - Immediate discovery for human visitors and search engine crawlers.

### 5. Keyword Shard & Seed Topics (`content/keywords/ai-news/registry.json`, `content/keywords/seed-topics.json`)
- Initialized `content/keywords/ai-news/registry.json` (version 1, valid timestamp, empty keywords array).
- Updated `content/keywords/seed-topics.json` to include 5 seed topics for `ai-news` while maintaining total topics count in the required 25–40 envelope (35 total).

### 6. Initial Seed News Posts (`content/posts/`)
- `content/posts/anthropic-claude-3-7-sonnet-hybrid-reasoning-release.mdx`:
  - Frontmatter strictly compliant with `draftSchema` (title 58 chars, description 152 chars, tldr <= 100 words, 3 FAQs, silo: `'ai-news'`).
  - Mandatory 4 H2 sections (`The Breakdown: What Happened`, `Why It Matters for Developers & Engineers`, `Industry Impact & Ecosystem Context`, `Verified Sources & Primary Documentation`).
  - Includes outbound documentation link and EEAT links (`/about`, `/editorial-process`).
- `content/posts/openai-unveils-gpt-5-preview-developers.mdx`:
  - Frontmatter strictly compliant with `draftSchema` (title 54 chars, description 155 chars, 3 FAQs, silo: `'ai-news'`).
  - All 4 mandatory H2 sections and citation links.

### 7. Crawl & Registry Gate Updates (`scripts/check-crawl.mjs`, `scripts/check-registry.mjs`)
- Updated `scripts/check-crawl.mjs` line 170: updated silo parity assertion from 5 to 6.
- Updated `scripts/check-registry.mjs` line 75: updated silo source assertion from 5 to 6.
- Next.js split sitemaps automatically shard `/ai-news` into sitemap shard 1 (`1.xml.body`) and news posts into shard 0 (`0.xml.body`).

---

## Verification & Test Results

1. **Unit Test Suite (`tests/news-silo.test.ts`)**:
   - 8/8 automated tests passed:
     - `SILO_SLUGS` includes `ai-news` as 6th silo.
     - `getSilo("ai-news")` returns valid taxonomy metadata and 139-word intro.
     - `getArticleSchemaType` discriminates between `NewsArticle` and `BlogPosting`.
     - `buildNewsArticleJsonLd` produces valid Schema.org structure.
     - Seed posts validate with `draftSchema` and contain mandatory H2s.
     - Site header contains `AI News` navigation link.
     - Keyword shard and seed topics pass schema validations.
2. **Registry Integrity Gate (`npm run check:registry`)**:
   - 5,721 registry checks passed (0 failures).
3. **Template Integrity Gate (`npm run check:template`)**:
   - 8/8 landed posts passed (0 failures).
4. **Crawl Consistency Gate (`npm run check:crawl`)**:
   - 102 crawl checks passed (0 failures across all 6 silos).
5. **Full Test Suite (`npm test`)**:
   - 146/146 tests passed (0 failures).
6. **Next.js Production Build (`npm run build`)**:
   - Built successfully with Turbopack, generating static pages for `/[silo]` (including `/ai-news`) and `/blog/[slug]` (including seed news posts).

---

## Commit Log

- `feat(07-03): register ai-news silo, shard, seed post, and header navigation`
- `feat(07-03): implement NewsArticle JSON-LD, crawl gate updates, and silo test suite`
