# 06-04 Summary: Publishing Velocity Scaling Governor & Dynamic Pillar Hubs

## Executive Overview

Plan `06-04` completes the autonomous compounding vision of TierOne AutoBlog by delivering the 4-point velocity scaling governor and dynamic Pillar Hub promotion engine (**GROW-03**).

The system enforces strict algorithmic crawl safety during the early bootstrap period, automatically graduates publishing frequency to daily cadence when crawl baselines are met, elevates mature silo topical clusters into structured Pillar Hubs with Schema.org `CollectionPage` structured data, and validates bidirectional internal link meshes.

---

## Key Deliverables & Architecture

### 1. 4-Point Velocity Scaling Governor (`lib/pipeline/publish/governor.ts`)
Acts as an autonomous gating mechanism to prevent Google sandboxing and spam demotion on new domains:
- **Criterion 1 (Domain Operating Age $\ge 60$d):** Computes elapsed days from earliest `publishedAt` timestamp across all silo registries.
- **Criterion 2 (GSC Indexation Ratio $\ge 70\%$):** Evaluates `totalIndexed / totalSubmitted >= 0.70` from analytics snapshot or live GSC metrics.
- **Criterion 3 (Operational Stability):** Verifies `pipeline-state.json` is unpaused and has 0 circuit-breaker trips or QA failures in the last 30 days.
- **Criterion 4 (Active Corpus Floor $\ge 10$):** Requires at least 10 live published articles across the site.
- **Evaluation Output:** Returns structured `GovernorEvaluation` with `unlocked: boolean` and detailed reason strings.

### 2. Autonomous Cadence Graduation (`scripts/publish-scheduled.ts`)
- Partitions the publishing week:
  - **Baseline Days (4x/week):** Sunday (0), Monday (1), Wednesday (3), Friday (5).
  - **Expanded Days (7x/week):** Tuesday (2), Thursday (4), Saturday (6).
- On expanded days, evaluates `checkVelocityGovernor()`:
  - When locked: logs status and cleanly exits with code 0 (`process.exit(0)`), preventing false alarms and DLQ pollution.
  - When unlocked: logs graduation notice and proceeds with candidate selection and publication.
- Zero manual intervention or cron reconfiguration needed for cadence expansion.

### 3. Dynamic Pillar Hub Elevation (`app/[silo]/page.tsx`)
- Inspects published article count per silo: `isPillarHub = siloPosts.length >= 8;`
- **Developing Clusters (<8 posts):** Preserves clean reverse-chronological archive list and `BreadcrumbJsonLd`.
- **Mature Clusters ($\ge 8$ posts):** Dynamically upgrades into a rich, zero-client-JS Pillar Hub:
  - **Authority Hero Banner:** Distinctive dark gradient styling, verified guide count, editorial scope narrative.
  - **Cornerstone Guide Spotlight:** Prominent card showcasing `/blog/${silo}-complete-guide` with "Cornerstone Architecture Guide" badge.
  - **Thematic Sub-Clusters:** Grouped into "Comparisons & Benchmarks", "Workflows & Step-by-Step Guides", and "Architecture & Deep Dives".
  - **Complete Spoke Directory:** Full archive of all cluster articles with reading times and publication dates.
  - **Cluster Navigation:** Up-links back to `/#topics` and home index.

### 4. Schema.org `CollectionPage` Structured Data (`lib/seo/jsonld.ts`)
- Added `buildCollectionPageJsonLd()` builder:
  - Emits valid Schema.org `@type: "CollectionPage"` markup.
  - Populates `hasPart` array with `@type: "BlogPosting"` entries for all published articles in the silo, declaring topical authority relationships for crawlers.

### 5. Cluster Link Mesh & Cornerstone Flagship Queuing (`lib/pipeline/hubs/pillar.ts` & `scripts/check-pillar-clusters.ts`)
- `analyzeSiloClusters()`: Scans all silo shards, counts published posts, checks for cornerstone guide existence, and flags orphan spoke articles lacking links to `/${silo}` or the cornerstone guide.
- `queueCornerstoneGuide()`: Idempotently creates and queues a candidate entry (`pillar-${silo}-complete-guide`, target: 3000 words, stage: `filtered`) in `content/keywords/${silo}/registry.json`.
- CLI tool `scripts/check-pillar-clusters.ts` (exposed via npm script `npm run silos:check`) renders a live status table and optionally queues missing cornerstone guides via `--queue-cornerstones`.

---

## Verification & Test Results

### 1. Velocity Governor Test Suite (`tests/velocity-governor.test.ts`)
- **Criterion 1:** Domain age < 60 days locks governor (`pass`).
- **Criterion 2:** Indexation ratio < 0.70 locks governor (`pass`).
- **Criterion 3:** Paused circuit breaker or failures in last 30d lock governor (`pass`).
- **Criterion 4:** Active corpus < 10 articles locks governor (`pass`).
- **All 4 Passing:** Evaluates to `unlocked: true` with empty reasons array (`pass`).
- **Day Gating:** Tuesday with locked governor exits/skips cleanly; Monday runs normally; Tuesday with unlocked governor publishes (`pass`).

### 2. Pillar Hub Test Suite (`tests/pillar-hub.test.ts`)
- **CollectionPage JSON-LD:** Validates Schema.org output and `hasPart` array mapping (`pass`).
- **Cluster Threshold:** Evaluates `<8` as `isPillar: false` and `>=8` as `isPillar: true` (`pass`).
- **Cornerstone Queuing:** Confirms creation of valid registry entry, idempotency, and promotion detection (`pass`).
- **Link Mesh:** Verifies bidirectional link scanning and flags orphan spoke posts (`pass`).

### 3. Full Project Test Suite & Production Build
- **`npm test`:** **108 / 108 tests passing** across 17 test suites (0 failures).
- **`npm run check:template`:** **6 / 6 passed**.
- **`npm run silos:check`:** Verified CLI table output across all 5 silos.
- **`npm run build`:** Production build compiled cleanly with Turbopack, passed all strict TypeScript checks, and generated all 25 static and SSG routes in 7.9s.

---

## Commit History

- `feat(06-04): implement 4-point publishing velocity governor and scheduled publisher integration`
- `feat(06-04): implement dynamic Pillar Hub promotion, CollectionPage schema, and cluster analysis`
- `fix(06-04): align registry types in unit tests for build pass`
- `docs(06-04): add summary for publishing velocity scaling governor and dynamic pillar hubs`
