---
phase: 02-seo-architecture-silo-ia
verified: 2026-10-17T11:58:24Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Render / and each of the 5 /{silo} landings in a real browser; confirm hub cards and landing pages match the Phase-1 editorial style (typography, spacing, card borders), unique intro prose reads as prose (not a wall of text), and no layout breakage."
    expected: "Hubs-on-top homepage with 5 cards; each landing shows breadcrumb, H1 label, unique intro paragraph, newest-first post list, 'Browse all topics' up-link."
    why_human: "Rendered visual quality (spacing, readability, style consistency) cannot be judged from HTTP/HTML responses; navigation structure was verified programmatically but aesthetics cannot."
  - test: "Click through the full visitor loop in a real browser: homepage hub card → silo landing → post → visible silo breadcrumb → Related 'More in {Label}' → silo landing; also click 'Browse all topics' up-link and confirm it scrolls to the homepage hubs section."
    expected: "Every click lands on the intended surface with no dead ends; the /#topics anchor scrolls to the hub cards."
    why_human: "Click-navigation behavior and anchor scroll feel are real-time interaction; curl can only verify link hrefs and fragment targets exist, not the user flow."
---

# Phase 02: SEO Architecture + Silo IA Verification Report

**Phase Goal:** Crawlers can discover, understand, and efficiently crawl every post inside a topical silo structure
**Verified:** 2026-10-17T11:58:24Z
**Status:** human_needed — 5/5 success criteria machine-verified (all exit batteries + live sweep re-run by this verifier at final HEAD `650441c`); 2 visual/interaction items remain for human confirmation
**Re-verification:** No — initial verification

## Goal Achievement

All claims below were re-verified directly against the codebase and live production build (`npm run build` at final HEAD), **not** taken from SUMMARY.md. Every SUMMARY claim cross-checked matched reality.

### Observable Truths

| # | Truth (ROADMAP SC / PLAN must-have) | Status | Evidence |
|---|-------------------------------------|--------|----------|
| 1 | Crawler can discover all posts via split XML sitemaps (posts only, diff-gated lastmod) plus robots.ts | ✓ VERIFIED | `app/sitemap.ts` read: `generateSitemaps()` → shards {0,1}; shard 0 = 5 `/blog/{slug}` URLs, lastmod = frontmatter `updatedAt` (byte-parity verified against `content/posts/*.mdx`); shard 1 = 12 URLs (homepage + 5 `/{silo}` landings + 5 trust + author). `.next/server/app/sitemap/{0,1}.xml.body` read directly; live GET → 200/200 (5 + 12 URLs). `robots.txt.body`: `Allow: /` + both `Sitemap:` lines, zero Disallow; live 200. Suite groups 1–5,7 green (85 checks re-run this session). |
| 2 | Post URL returns 200 at flat `/blog/{slug}` with self-referencing canonical; hierarchy visible via breadcrumbs + silo landings | ✓ VERIFIED | All 5 post URLs live 200; `<link rel="canonical">` = own absolute URL on every post **and** every landing. Visible `Breadcrumb` = Home (`/`) / {Silo label} (`/{silo}`) / Title (`aria-current="page"`), rendered from `lib/silos.ts` via `getSilo`/`siloUrl`. Five flat `/{silo}` landings live 200 with canonical self-refs. |
| 3 | Post page emits valid Article + BreadcrumbList JSON-LD (FAQPage hygiene) from single-source builders | ✓ VERIFIED | Parsed served HTML: 4 `application/ld+json` blocks, **4/4 parse as valid JSON** (Phase-1 `@graph` Organization/WebSite + BlogPosting + BreadcrumbList + FAQPage). Article `headline` === visible H1, `mainEntityOfPage` = canonical, author/publisher populated. BreadcrumbList positions 1..3 trail Home → AI Writing → title mirrors visible crumb exactly. FAQPage = 4 questions (seed-01 visible FAQ count = 4). Builders single-source in `lib/seo/jsonld.ts` (typed against installed next-seo v7 props; `<`-strip `clean()` per T-02-01; null on empty FAQ); routes contain **zero** `JSON.stringify` or hand-serialized JSON-LD (grep clean). |
| 4 | Archives/tags/pagination noindexed, CI crawl-consistency suite green | ✓ VERIFIED | Route inventory: no tag/archive/category/pagination segments exist at all (only `[slug]`, `[silo]` dynamic segments — both suite-allowlisted). `check-crawl.mjs` group 6 walks `app/` and fails CI if introduced; asserts root layout `index:true`. CI `crawl` job present in `.github/workflows/lhci.yml` (checkout → node 22 → npm ci → build → check:crawl; existing jobs untouched). Suite re-run: **85 crawl checks passed**, exit 0. |
| 5 | Visitor can navigate 4–8 silo landings with hub-and-spoke links; en-US canonical (+ x-default); hreflang plumbing single-locale | ✓ VERIFIED | Exactly 5 landings (inside 4–8 range), `generateStaticParams` from `SILO_SLUGS` only; unknown slug → `notFound()` (live `/vpn-deals` → 404). Homepage hubs section `id="topics"` precedes latest-posts list; live slice-check: topics section contains **5 landing links, 0 direct `/blog/` links** (D-15 two-hop holds). Every post carries "More in {Label}" → landing + empty-state "See all {Label} guides" (RelatedPosts never-null, read in code). Head plumbing: `localeAlternates(canonicalFor(...))` used on posts + landings; live HTML shows canonical + `hrefLang="en-US"` + `hrefLang="x-default"` self-referencing and no other locale. Single-locale enforced by construction (one typed function, hardcoded en-US/x-default). |

**Score:** 5/5 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Each silo landing lists only 1 post (thin by volume, not by design) | Phase 3 | Phase 3 SC3/SC4: pipeline drafts land at 1,500–2,500 words and add posts that auto-appear on landings (newest-first list + `check:crawl` group 4 keeps every-silo-≥1 gate). UI code is data-driven from `allPosts` — zero edits needed per post. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/silos.ts` | SILO_SLUGS/SILOS/getSilo/siloUrl single-source taxonomy | ✓ VERIFIED | 86 lines; 5 silos with label/landingTitle/metaDescription/intro; wired into content schema (z.enum), both routes, sitemap parity target |
| `lib/seo/canonical.ts` | canonicalFor + localeAlternates | ✓ VERIFIED | Imports SITE_URL from `@/lib/site` (no domain literal); en-US + x-default hardcoded single-locale |
| `lib/seo/jsonld.ts` | 3 JSON-LD builders, next-seo-v7-spreadable | ✓ VERIFIED | Article/Breadcrumb/FAQ(?-null) builders; Extract-before-Omit union typing; `<`-strip |
| `content-collections.ts` | silo enum build gate | ✓ VERIFIED | `silo: z.enum(SILO_SLUGS)` with T-02-02 comment; build proceeds with 5 docs |
| `app/sitemap.ts` | Sharded sitemap, diff-gated lastmod | ✓ VERIFIED | async id handler (Next-16 Promise param correct), shard 0 posts / shard 1 pages, REVIEW_DATE constant, no build-time dates |
| `app/robots.ts` | allow:/ + sitemap pointers | ✓ VERIFIED | Zero Disallow; both shards declared directly (documented: Next generates no index) |
| `scripts/check-crawl.mjs` | 7-group CI suite | ✓ VERIFIED | 251 lines, zero deps, Windows-safe; 85 checks passed live |
| `app/[silo]/page.tsx` | 5 static landings | ✓ VERIFIED | SSG via generateStaticParams; notFound in both generateMetadata and page body; canonical/alternates; intro + newest-first list + up-link |
| `app/page.tsx` | Hubs-on-top homepage | ✓ VERIFIED | topics section above untouched latest list; cards link via siloUrl only; counts from allPosts |
| `app/blog/[slug]/page.tsx` | Silo crumb + JSON-LD + canonical/hreflang | ✓ VERIFIED | next-seo ArticleJsonLd/BreadcrumbJsonLd/FAQJsonLd from builders; silo crumb; localeAlternates spread |
| `components/related-posts.tsx` | Silo up-link + empty state | ✓ VERIFIED | "More in {Label}" header link, never-null empty state, SiloSlug-typed, same-silo up-to-3 preserved |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `lib/seo/canonical.ts` | `lib/site.ts` SITE_URL | import | ✓ WIRED | `import { SITE_URL } from '@/lib/site'`; domain literal exists only in site.ts (grep clean) |
| `lib/seo/jsonld.ts` | content-collections Post type | import type | ✓ WIRED | `import type { Post } from 'content-collections'`; builders consume real frontmatter fields (proven by live JSON output) |
| `content-collections.ts` | SILO_SLUGS | z.enum | ✓ WIRED | Enum import from `./lib/silos`; undeclared silo fails build |
| `app/sitemap.ts` | allPosts | data-driven landings | ✓ WIRED | distinctSilos() derives shard-1 landing URLs; parity with lib/silos asserted by suite (passed) |
| `app/[silo]/page.tsx` | lib/silos + allPosts | getSilo + filter/sort | ✓ WIRED | Single-source copy; newest-first cluster list renders real post (live) |
| `app/page.tsx` | /{silo} landings | siloUrl cards | ✓ WIRED | 5 landing links in topics section; 0 direct blog links (live) |
| `app/blog/[slug]/page.tsx` | lib/seo/* + lib/silos | builders + helpers | ✓ WIRED | All structured data/head plumbing fed from same `post` object; mirror assertions passed live |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| post page | post | allPosts (content-collections, zod-validated) | ✓ frontmatter of 5 real seed MDX files | ✓ FLOWING |
| silo landing | posts (filtered) | allPosts filtered by silo | ✓ 1 real post each, newest-first | ✓ FLOWING |
| homepage hubs | count/labels | SILOS + allPosts at render | ✓ "1 guide" totals from real posts | ✓ FLOWING |
| sitemap shards | allPosts | content date fields | ✓ lastmod = frontmatter updatedAt (verified byte-parity) | ✓ FLOWING |
| JSON-LD | post | same object as visible content | ✓ headline===H1, FAQ n===visible n, crumb trail mirror (live-parsed) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Seed conformance gate | `npm run check:seeds` | 5 passed | ✓ PASS |
| Production build | `npm run build` | green; 23 static pages incl. 5 landings SSG + 2 sitemap shards | ✓ PASS |
| Crawl-consistency suite | `npm run check:crawl` | 85 crawl checks passed, exit 0 | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| robots.txt served | `GET /robots.txt` (next start) | 200; Allow:/ + 2 Sitemap lines | ✓ PASS |
| Sitemap shards served | `GET /sitemap/0.xml`, `/1.xml` | 200; 5 posts / 12 pages | ✓ PASS |
| Posts ×5 | `GET /blog/{slug}` | all 200; canonical self-ref; en-US + x-default alternates; 4 valid JSON-LD blocks; silo link; crumb current | ✓ PASS |
| Landings ×5 | `GET /{silo}` | all 200; canonical self-ref; alternates; blog link; up-link | ✓ PASS |
| Homepage hubs | `GET /` + section slice | topics section first, 5 landing links, 0 direct blog links | ✓ PASS |
| Negative silo probe | `GET /vpn-deals` | 404 | ✓ PASS |
| JSON-LD validity ×1 deep-parse | parse all script blocks | 4/4 valid; headline===H1; crumb trail 1..3 mirrored; FAQ 4=4 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description (REQUIREMENTS.md) | Status | Evidence |
| ----------- | ----------- | ----------------------------- | ------ | -------- |
| SEO-01 | 02-02 | Split XML sitemaps (posts only, diff-gated lastmod) + robots.ts | ✓ SATISFIED | Truth 1; requirements table header checked; `check:crawl` groups 1–3,7 |
| SEO-02 | 02-01, 02-04 | Valid Article + BreadcrumbList JSON-LD (FAQPage hygiene) from single-source builders | ✓ SATISFIED | Truth 3; live JSON parse + mirror assertions |
| SEO-03 | 02-01, 02-04 | Flat `/blog/{slug}` + self-ref canonical; hierarchy via crumbs + landings | ✓ SATISFIED | Truth 2; URL depth 1 confirmed |
| SEO-04 | 02-02 | Crawl efficiency enforced, CI suite green | ✓ SATISFIED | Truth 4; archive/tag/pagination absence + 85-check suite + CI job |
| SEO-05 | 02-03 | 4–8 silo landings, hub-and-spoke, flat URLs | ✓ SATISFIED | Truth 5; 5 landings + two-hop hubs live |
| GEO-01 | 02-01, 02-04 | US visitor gets en-US canonical (+ x-default) | ✓ SATISFIED | canonical + hrefLang en-US/x-default on every post + landing (live) |
| GEO-03 | 02-01, 02-04 | hreflang-capable plumbing, launched single-locale | ✓ SATISFIED | `localeAlternates()` single source emits exactly en-US + x-default; no other locale possible without editing that function; CI enforces build consistency via `crawl` job (assembly: Posts = en-US, all singular) |

**Orphan check:** Plans' frontmatter requirement union = {SEO-01..05, GEO-01, GEO-03} — exactly the phase's 7 IDs, all present in REQUIREMENTS.md mapped to Phase 2, all marked Complete in the traceability table. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | TODO/FIXME/PLACEHOLDER/`return null` hollow UI/`JSON.stringify` ld+json in routes/domain literal outside site.ts/silo copy outside silos.ts | — | Zero matches across all 11 phase files (grepped this session) |

**Documented, justified plan deviations (verified equal-or-better, not gaps):** no `/sitemap.xml` index (`robots.ts` declares both shards directly — protocol-standard; suite guards against re-adding the build-breaking index route); Next 16 async shard `id` handler; `FAQJsonLd` (actual next-seo v7 export) used where plans said FAQPageJsonLd; true `<`-strip in `clean()` (plan's literal `\u003c` replace was a no-op); SSR emits camelCase `hrefLang` (HTML5 attribute names are ASCII case-insensitive — crawler-equivalent; manually confirmed deployed HTML).

**Observation (Info, no action required):** no explicit hreflang grep/edit in the CI suite itself — GEO-03's "validated by CI" is enforced through the crawl job (build + 85 checks incl. silo parity/single-locale inventory) plus the single-source typed `localeAlternates()` unit. This is belt-and-braces absent, not a functional gap. Phase 4's schema-validity gate will consume the same builders and can fold an alternates-assertion in then if desired.

### Human Verification Required

### 1. Visual appearance of the new silo surfaces
**Test:** Open `/` and the 5 landings in a browser; compare hub cards/landings against the Phase-1 editorial style.
**Expected:** Hubs-on-top with 5 bordered cards; landings show breadcrumb/H1/unique intro/post list/up-link in consistent typography and spacing.
**Why human:** Rendered aesthetics can't be judged from HTTP responses — structure and data flow were verified programmatically.

### 2. Click-through hub-and-spoke navigation flow
**Test:** Click hub card → landing → post → visible silo crumb → "More in {Label}" landing link → landing; and "Browse all topics" → verify it lands/scrolls on the hubs section.
**Expected:** Full loop with no dead ends; `/#topics` anchor scrolls to the hub cards.
**Why human:** Real navigation and scroll feel require a browser; hrefs/fragment targets verified structurally but not the interaction experience.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria re-verified at final HEAD `650441c` via direct code reads, fresh production build, both CI suites (85 crawl checks + 5 seed checks), `tsc --noEmit` clean, and a live `next start` sweep covering all 5 posts, 5 landings, homepage, sitemap shards, robots.txt, JSON-LD validity/mirroring, hreflang presence, D-15 two-hop rule, and the negative silo probe (404). Status is `human_needed` only because the process reserves rendered-appearance and click-through judgment for a human — automated checks passed with zero findings.

---

_Verified: 2026-10-17T11:58:24Z_
_Verifier: OpenCode (gsd-verifier)_
