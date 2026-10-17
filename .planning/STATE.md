---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-01-PLAN.md (registry + budget + runner foundation) — ready for 03-02
last_updated: "2026-10-17T09:28:00.000Z"
last_activity: 2026-10-17 -- Phase 3 P03-01 executed (registry foundation, budget governance, pipeline CLI)
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 14
  completed_plans: 9
  percent: 64
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-16)

**Core value:** Tier-1 readers find our articles on Google page 1 and stay to read — organic sessions from US/UK/CA/AU grow every week.
**Current focus:** Phase 3 — content-pipeline

## Current Position

Phase: 3 (content-pipeline) — EXECUTING
Plan: 2 of 6
Status: Executing Phase 3
Last activity: 2026-10-17 -- Completed 03-01-PLAN.md (registry + budget + runner foundation)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 13 (milestone total planned 14)
- Average duration: ~37 min/plan (recent plans)
- Total execution time: ~4.1 hours

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | ~2h | ~30min |
| 02 | 4 | - | - |
| 03 | 1/6 | 25min | 25min |

*Updated after each plan completion. Latest: Phase 03 P01 — 25min — 3 tasks — 14 files.*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Research Corrected Decisions supersede PROJECT.md — Next.js 16.x (not 14), Content Collections (not Contentlayer), single-locale en-US launch, FAQPage as hygiene, sitemaps + GSC API Google track
- [Roadmap]: 6 phases in dependency order render → indexability → structure → quality → autonomy → optimization; no auto-publish before proven QA gates
- [Roadmap]: Pipeline (Phase 3) split from QA gates (Phase 4) for executable planning; coupled by ordering invariant
- [02-01]: JSON-LD builders typed against installed next-seo v7 prop types (not raw schema-dts unions) — spreadability is the hard contract; FAQ component is FAQJsonLd; inLanguage omitted (not a v7 ArticleBase field)
- [02-01]: T-02-01 sanitization is true `<`-stripping — plan's single-escaped '\u003c' is a runtime no-op
- [02-01]: BreadcrumbJsonLdProps needs Extract-before-Omit (union collapses under bare Omit)
- [02-02]: Sharded sitemap handler must be async and await `id` — Next 16 passes a Promise<string> route param; sync compare silently duplicates one shard
- [02-02]: No /sitemap.xml index exists for generateSitemaps() shards and the path is build-reserved — robots.txt declares both shards (/sitemap/0.xml + /sitemap/1.xml) via two Sitemap: lines instead
- [02-02]: Crawl suite never imports lib/silos.ts (Wave-1 parallelism) — group 4 parses SILO_SLUGS as text for parity; landings derive from distinct post silos
- [02-03]: Silo landings at root /{silo} per D-02 — generateStaticParams from SILO_SLUGS only; getSilo miss -> notFound() in both generateMetadata and page body (T-02-02 fail-closed)
- [02-03]: Homepage hubs-on-top link exclusively via siloUrl() to landings, never posts (D-15 two-hop); latest-posts markup byte-identical below; 'Browse all topics' up-link targets /#topics
- [02-04]: Post JSON-LD emitted via next-seo v7 FAQJsonLd (no FAQPageJsonLd export), fed by Plan-01 builders from the same post object that renders the visible crumb/FAQ — mirror by construction
- [02-04]: RelatedPosts never returns null now — empty same-silo list renders 'See all {Label} guides' landing link (1-post silos have no dead end); silo prop narrowed to SiloSlug (content enum guarantee), call site unchanged
- [02-04]: Phase verification sweeps assert schema against SERVED visible markup with ground truth text-parsed from frontmatter + lib/silos.ts (suites never import site code); React SSR quirks to expect: <!-- --> between text expressions, attr-order variance (class before href), hrefLang camelCase
- [03-01]: `SpendOp.month` typed as regex-verified `${number}-${number}` template type — plan's `'YYYY-MM'` annotation cannot compile as a literal type; runtime MONTH_RE proves the shape before cast
- [03-01]: run.ts wraps top-level await in async main() — package.json has no "type":"module" so tsx transforms .ts as CJS; flipping global module type would risk Next build configs, so the runner avoids top-level await instead
- [03-01]: Full-chain runner records per-stage failures and keeps walking (plan requires walking all 5 with honest FAILs, exit 1 at end); only budget exhaustion (assertSpendable) aborts the run immediately per D-02 hard-stop
- [03-01]: check:registry strips // + /* */ comments before vocab/tuple regexes (self-invalidating-gate hygiene); RegistryStage vocabulary grepped from types.ts text, SILO_SLUGS from silos.ts text — site code never imported

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-10-17T09:28:00.000Z
Stopped at: Completed 03-01-PLAN.md (registry + budget + runner foundation) — ready for 03-02
Resume file: .planning/phases/03-content-pipeline/03-02-PLAN.md
