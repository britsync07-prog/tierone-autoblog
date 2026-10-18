---
phase: "6"
status: "passed"
verified: "2026-10-18"
requirements:
  - GROW-01
  - GROW-02
  - GROW-03
---

# Phase 6: Observe, Refresh + Compound — Verification Report

**Date:** 2026-10-18  
**Phase:** 06-observe-refresh-compound  
**Status:** PASSED  
**Verifier:** gsd-verifier  

---

## Executive Summary

Phase 6 ("Observe, Refresh + Compound") establishes the autonomous compounding and observational intelligence layer of TierOne AutoBlog. It delivers:
1. **GROW-01 (Growth Analytics & Private Dashboard)**: Multi-dimensional search traffic and engagement ingestion from Google Search Console (`country × page × query`) and Plausible Analytics with Tier-1 country code normalization, live sitemap coverage tracking against the $\ge 70\%$ benchmark, resilient offline snapshot fallback, and a secure Server Component dashboard at `/dashboard` gated by `DASHBOARD_SECRET`.
2. **GROW-02 (Content Refresh Engine & 301 Consolidation)**: Autonomous detection of striking-distance queries (positions 5.0–20.0 with $\ge 50$ impressions) and decaying evergreen content ($\ge 90$d old, $\ge 100$ prior impressions, $\ge 25\%$ drop), structured queue persistence in `content/keywords/refresh-queue.json`, non-destructive FAQ injection strictly respecting the 5-item schema boundary, link unlinking, and permanent data-driven 301 redirects in `content/redirects.json` via Next.js dynamic routing with physical MDX quarantine.
3. **GROW-03 (Velocity Scaling Governor & Dynamic Pillar Hubs)**: A 4-point velocity governor gating daily publication behind domain age ($\ge 60$d), indexation ratio ($\ge 70\%$), operational stability (circuit breaker unpaused and 0 failures in 30d), and active corpus floor ($\ge 10$ articles), combined with dynamic Pillar Hub elevation on silo pages with $\ge 8$ articles featuring Schema.org `CollectionPage` structured data and bidirectional link mesh validation.

All 108 automated unit and integration tests pass, 6/6 published post templates conform to schema, 5,722 registry entries pass validation, and the production build compiles all 25 routes cleanly.

---

## Requirements Verification

### GROW-01: Country-Segmented Analytics & Private Dashboard

> **Requirement:** Owner can view country-segmented search traffic and engagement at `/dashboard` (GSC country × page × query + Plausible), spotlighting Tier-1 traffic share and $\ge 70\%$ indexed-to-submitted ratio.

#### Implementation Analysis
- **API Ingestion & Normalization (`lib/pipeline/analytics/gsc.ts`, `lib/pipeline/analytics/plausible.ts`)**:
  - GSC ISO alpha-3 lowercase country codes (`usa`, `gbr`, `can`, `aus`) and Plausible ISO alpha-2 codes (`US`, `GB`, `CA`, `AU`) are normalized into canonical `Tier1Geo = 'US' | 'UK' | 'CA' | 'AU'`.
  - GSC queries multi-dimensional search data using dimensions `['country', 'page', 'query']`.
  - GSC sitemaps client queries `sitemaps.list` to calculate submitted vs indexed counts and sitemap coverage ratio.
  - Plausible stats client queries the breakdown endpoint (`visit:country` property) for visitor count, visits, bounce rate, and visit duration.
- **Offline Snapshot & Synthetic Resilience (`lib/pipeline/analytics/snapshot.ts`, `lib/pipeline/analytics/index.ts`)**:
  - In local development or when API keys are absent, the system fails soft without throwing unhandled exceptions, loading `content/analytics/snapshot.json` or deterministically generating realistic data based on published articles in `content/posts/`.
- **Private Route Protection (`app/dashboard/page.tsx`)**:
  - Server Component with zero client-side JavaScript.
  - Enforces `validateDashboardToken(token)` matching `process.env.DASHBOARD_SECRET`.
  - Mismatched or missing token calls Next.js `notFound()`, returning HTTP 404 to block path enumeration by external crawlers.
  - Exports `metadata: { robots: { index: false, follow: false } }`.
  - Renders 4 KPI cards: Tier-1 Traffic & Search Share, Google Indexation Ratio ($\ge 70\%$ visual gauge), Search Volume & Clicks, and Plausible Reader Engagement.
  - Displays sortable tables for Top Search Queries by Tier-1 Countries and Top Performing Post Pages.

#### Automated Test Evidence
- `tests/dashboard-route.test.ts` (12/12 passed):
  - Confirms GSC country normalization for `usa`, `gbr`, `can`, `aus`.
  - Confirms graceful null fallback on missing GSC credentials.
  - Confirms Plausible stats graceful null fallback on missing `PLAUSIBLE_API_KEY`.
  - Confirms synthetic snapshot generation satisfies $\ge 70\%$ index ratio and $\ge 80\%$ Tier-1 share.
  - Confirms unauthorized requests trigger `notFound()`.
  - Confirms valid tokens render authorized dashboard HTML.

**Verdict:** PASS

---

### GROW-02: Search-Driven Refresh Engine & 301 Consolidation

> **Requirement:** Autonomous content refresh engine detects striking-distance keywords (5.0–20.0 position) and decaying content (>90d traffic loss); manages `content/keywords/refresh-queue.json` and data-driven 301 redirects `content/redirects.json`.

#### Implementation Analysis
- **Striking-Distance Detection (`lib/pipeline/refresh/detect.ts`)**:
  - Filters search queries ranking between positions 5.0 and 20.0 with $\ge 50$ impressions over the last 28 days.
  - Computes `OpportunityScore = impressions * (21.0 - position)`.
  - Generates query-specific suggested FAQ additions.
- **Content Decay Radar (`lib/pipeline/refresh/detect.ts`)**:
  - Analyzes articles with age $\ge 90$ days.
  - Enforces baseline prior 30d impressions floor $\ge 100$ to eliminate low-traffic volatility.
  - Detects traffic drop $\ge 25\%$ in impressions or clicks comparing current 30d vs prior 30d.
  - Computes `DecayScore = maxDrop * priorImpressions`.
- **Persistent Queue Management (`lib/pipeline/refresh/queue.ts`)**:
  - Persists queue items to `content/keywords/refresh-queue.json`.
  - `upsertRefreshQueue` merges new items by ID (`refresh-{slug}-{YYYY-MM}` or `decay-{slug}-{YYYY-MM}`), strictly preserving `'applied'` and `'quarantined'` historical status.
- **Non-Destructive Autonomous Refresh (`lib/pipeline/refresh/execute.ts`, `scripts/run-content-refresh.ts`)**:
  - `bump-date-modified`: Updates frontmatter `updatedAt` to current ISO timestamp.
  - `inject-faq`: Injects FAQ item while enforcing the 5-item ceiling in `draftSchema`. If an article already has 5 FAQs, replaces the lowest-value/last item rather than overflowing to a 6th FAQ.
  - `repair-links`: Uses `unlinkMarkdownUrl` to remove dead hyperlinks (`[Anchor](dead-url)` $\to$ `Anchor`) without disturbing markdown prose.
  - Validates updated post against `draftSchema.partial()` and `draftSchema.shape.faq` before writing to disk.
- **Data-Driven 301 Redirect Registry (`lib/pipeline/redirects/registry.ts`, `next.config.mjs`)**:
  - Declarative redirects stored in `content/redirects.json`.
  - Validates path syntax (leading `/`), eliminates self-loops (`source === destination`), duplicate sources, circular pairs (`A -> B` & `B -> A`), and transitive cycles (`A -> B -> C -> A`).
  - Next.js config dynamically loads redirects via `async redirects()` with safe fallback to `[]` on missing or corrupt files.
- **Physical MDX Quarantine & Registry Sync (`lib/pipeline/redirects/retire.ts`, `scripts/retire-post.ts`)**:
  - Retiring a post moves the `.mdx` file from `content/posts/` to `content/quarantine/` via `quarantineDraft()`.
  - Updates keyword registry entry to `'quarantined'` with rule `'301-consolidated'`.
  - Appends permanent 301 redirect rule to `content/redirects.json`.
  - Removing the file from `content/posts/` guarantees removal from Content Collections and XML sitemaps.

#### Automated Test Evidence
- `tests/refresh-decay.test.ts` (6/6 passed):
  - Verifies striking-distance filtering (5.0–20.0 pos, $\ge 50$ impr) and opportunity score ranking.
  - Verifies decay detection thresholds ($\ge 90$d age, $\ge 100$ prior impr, $\ge 25\%$ drop).
  - Verifies queue deduplication and status preservation.
  - Verifies clean markdown unlinking without text loss.
  - Verifies `updatedAt` bump and FAQ limit guard (5-item maximum preserved).
- `tests/redirects-consolidation.test.ts` (13/13 passed):
  - Verifies fallback on missing or corrupt `redirects.json`.
  - Verifies atomic file write and read round trips.
  - Verifies path formatting and error detection on self-loops, duplicate sources, circular pairs, and transitive cycles.
  - Verifies end-to-end post retirement: physical quarantine, registry stage update, and redirect entry persistence.

**Verdict:** PASS

---

### GROW-03: Publishing Velocity Scaling Governor & Dynamic Pillar Hubs

> **Requirement:** Gated publishing velocity scaling behind strict 4-point 60-day baseline check; automated pillar hub promotion for silos with 8–12 articles with bidirectional link mesh.

#### Implementation Analysis
- **4-Point Velocity Governor (`lib/pipeline/publish/governor.ts`)**:
  - Gating criteria:
    1. **Domain Operating Age $\ge 60$d**: Elapsed days from earliest `publishedAt` timestamp across all silo shards.
    2. **Indexation Ratio $\ge 70\%$**: `totalIndexed / totalSubmitted >= 0.70` from GSC analytics.
    3. **Operational Stability**: `pipeline-state.json` unpaused with 0 failures or circuit breaker trips in the prior 30 days.
    4. **Active Corpus Floor $\ge 10$**: At least 10 published articles active in the registry.
  - Day partitioning (`isBaselineDay`):
    - Baseline days (Sun, Mon, Wed, Fri): publishes normally (4x/week).
    - Expanded days (Tue, Thu, Sat): publishes only if governor evaluates to `unlocked: true`. If locked, logs reasons and exits with code 0 (`skipped`).
- **Scheduled Publisher Integration (`scripts/publish-scheduled.ts`)**:
  - On non-baseline days, evaluates `checkVelocityGovernor()`.
  - Prevents false alarms, retries, or DLQ pollution when locked.
  - Automatically graduates to 7x/week publishing once all 4 criteria pass without manual intervention.
- **Dynamic Pillar Hub Promotion (`app/[silo]/page.tsx`)**:
  - Inspects article count per silo: `isPillarHub = posts.length >= 8;`.
  - When $< 8$ posts: renders clean reverse-chronological archive list and `BreadcrumbJsonLd`.
  - When $\ge 8$ posts: dynamically elevates to full Pillar Hub:
    - Authority Hero Banner with dark gradient and guide count.
    - Cornerstone Architecture Guide spotlight card (`/${silo}-complete-guide`).
    - Thematic sub-clusters: "Comparisons & Benchmarks", "Workflows & Step-by-Step Guides", and "Architecture & Deep Dives".
    - Complete Spoke Directory listing all articles with reading times.
    - Cluster navigation and up-links back to `/#topics` and home.
- **Schema.org `CollectionPage` JSON-LD (`lib/seo/jsonld.ts`)**:
  - Emits `@type: "CollectionPage"` with `hasPart` containing `@type: "BlogPosting"` entries for all published spoke articles.
- **Bidirectional Link Mesh & Cornerstone Queuing (`lib/pipeline/hubs/pillar.ts`, `scripts/check-pillar-clusters.ts`)**:
  - `analyzeSiloClusters()`: Analyzes article density, detects cornerstone guide existence, and flags orphan spoke articles missing links to `/${silo}` or the cornerstone guide.
  - `queueCornerstoneGuide()`: Idempotently creates and queues a candidate entry (`pillar-${silo}-complete-guide`, stage: `filtered`) in `content/keywords/${silo}/registry.json`.
  - CLI runner `npm run silos:check` reports cluster status across all silos.

#### Automated Test Evidence
- `tests/velocity-governor.test.ts` (6/6 passed):
  - Criterion 1: domain age < 60 days locks governor.
  - Criterion 2: indexation ratio < 0.70 locks governor.
  - Criterion 3: paused circuit breaker or recent failures lock governor.
  - Criterion 4: active corpus < 10 articles locks governor.
  - All 4 criteria passing evaluates to `unlocked: true`.
  - Day gating: Tuesday with locked governor exits/skips cleanly; Monday runs normally; Tuesday with unlocked governor publishes.
- `tests/pillar-hub.test.ts` (4/4 passed):
  - Validates `CollectionPage` JSON-LD structure and `hasPart` spoke mapping.
  - Validates cluster threshold: `<8` articles is not a pillar hub, `\ge 8` articles is a pillar hub.
  - Validates cornerstone guide queuing and registry idempotency.
  - Validates bidirectional link scanning and orphan post detection.

**Verdict:** PASS

---

## Test & Build Evidence Summary

| Suite / Verification Command | Scope | Result | Details |
|---|---|---|---|
| `npm test` | Complete test suite (17 suites) | **108 / 108 PASS** | 0 fail, 0 skipped, 38.3s runtime |
| `npm run check:template` | Published article frontmatter conformance | **6 / 6 PASS** | All 6 seed articles conform to template |
| `npm run check:registry` | Shard consistency & schema validation | **5,722 / 5,722 PASS** | 0 integrity violations |
| `npm run build` | Next.js 16.4.2 Turbopack production build | **25 / 25 ROUTES BUILT** | Clean compilation, static SSG pages generated in 6.7s |

---

## Threat Model & Security Audit

| Threat ID | Threat Description | Mitigation Mechanism | Verification Evidence |
|---|---|---|---|
| **T-06-01** | Sensitive Search Analytics Exposure & Pipeline Crash | `/dashboard` sets `robots: { index: false, follow: false }`. API fetchers gracefully return `null` on missing credentials and fall back to cached snapshot or synthetic demo data without throwing unhandled exceptions. | Verified in `tests/dashboard-route.test.ts` (null fallback and robots metadata tests pass). |
| **T-06-02** | Unauthorized Dashboard Access & Token Leakage | `validateDashboardToken()` validates query param against `DASHBOARD_SECRET`. Unauthorized requests invoke Next.js `notFound()` returning HTTP 404 to prevent path enumeration. | Verified in `tests/dashboard-route.test.ts` (unauthorized access triggers 404 notFound()). |
| **T-06-03** | False-Positive Content Decay Churn & Queue Pollution | 3-point filter in `detectContentDecay()`: $\ge 90$d age, $\ge 100$ prior impressions, $\ge 25\%$ drop. Deduplicated queue IDs preserve `'applied'` history. | Verified in `tests/refresh-decay.test.ts` (boundary tests reject younger, low-volume, or minor-drop posts). |
| **T-06-04** | Frontmatter Schema Violation via FAQ Overflow | Hard ceiling in `executeRefreshAction()` checks FAQ count. If $\ge 5$, replaces lowest-value FAQ rather than overflowing. Re-validates against `draftSchema`. | Verified in `tests/refresh-decay.test.ts` (article with 5 FAQs retains 5 FAQs and passes validation). |
| **T-06-05** | Infinite Redirect Loops & Configuration Crashes | `validateRedirectEntry()` blocks leading-slash omissions, self-loops, duplicate sources, circular pairs, and transitive cycles. `next.config.mjs` wraps JSON parsing in try/catch with `[]` fallback. | Verified in `tests/redirects-consolidation.test.ts` (all loop types detected and blocked). |
| **T-06-06** | Orphaned MDX Residuals & Search Index Duplication | `retireAndRedirectPost()` moves `.mdx` to `content/quarantine/`, updates keyword registry to `'quarantined'`, and writes 301 rule. Removing file purges it from builds and sitemaps. | Verified in `tests/redirects-consolidation.test.ts` (physical file move and registry update confirmed). |
| **T-06-07** | Rapid Velocity Scaling & Search Engine Sandboxing | 4-point governor gates daily publication. Early-stage publication remains throttled to 4x/week until 60-day baseline, 70% indexation, circuit stability, and 10 active posts are proven. | Verified in `tests/velocity-governor.test.ts` (all 4 gate criteria verified). |
| **T-06-08** | Thin Silo Pillar Claim & Premature Architecture Dilution | Silo landing page requires $\ge 8$ published articles before elevating to Pillar Hub. Developing clusters retain standard reverse-chronological archive. | Verified in `tests/pillar-hub.test.ts` (threshold check and layout switching verified). |

---

## Conclusion & Phase Sign-Off

Phase 6 ("Observe, Refresh + Compound") has fulfilled all specifications, architecture contracts, and requirements defined in `06-CONTEXT.md`, `06-RESEARCH.md`, `06-VALIDATION.md`, and the project roadmap (`GROW-01`, `GROW-02`, `GROW-03`).

All automated test suites, integrity validators, and production build pipelines pass without error.

## VERIFICATION PASSED
