---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Completed 03-04-PLAN.md (comparison-as-frontmatter state machine live: draft-schema single source, ComparisonTable component, seed-01 proof) — ready for 03-05"
last_updated: "2026-10-17T13:07:39.558Z"
last_activity: 2026-10-17
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 14
  completed_plans: 12
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-16)

**Core value:** Tier-1 readers find our articles on Google page 1 and stay to read — organic sessions from US/UK/CA/AU grow every week.
**Current focus:** Phase 3 — content-pipeline

## Current Position

Phase: 3 (content-pipeline) — EXECUTING
Plan: 5 of 6
Status: Ready to execute
Last activity: 2026-10-17

Progress: [█████████░] 86%

## Performance Metrics

**Velocity:**

- Total plans completed: 10 of 14 (milestone planned; Phase 3 is 2/6 done)
- Average duration: ~37 min/plan (recent plans)
- Total execution time: ~4.5 hours

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | ~2h | ~30min |
| 02 | 4 | - | - |
| 03 | 2/6 | ~2h40 | ~1h20 |

*Updated after each plan completion. Latest: Phase 03 P02 — ~2h15m wall (interrupted run resumed) — 3 tasks — 6 data files + 4 pipeline modules.*
| Phase 03 P03 | 29min | 3 tasks | 23 files |
| Phase 3 P04 | 15min | 3 tasks | 8 files |

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
- [2026-10-17 OWNER DIRECTIVE — Phase 3]: **Fully-free platform. NO third-party PAID APIs ever.** DataForSEO is out (build keyless in-house keyword intelligence: Google autocomplete per-geo + Trends + free SERP signal; free-signal proxy filters replace KD/volume gates; anti-cannibalization + per-geo capture unchanged; ledger repurposed as monthly request-cap governor). LLM/image stages must use free providers only (env-configured OpenAI-compatible adapter pointing at free-tier/Ollama/gateway; never a paid bill). See 03-CONTEXT.md ⚠ OVERRIDE.
- [03-01]: `SpendOp.month` typed as regex-verified `${number}-${number}` template type — plan's `'YYYY-MM'` annotation cannot compile as a literal type; runtime MONTH_RE proves the shape before cast
- [03-01]: run.ts wraps top-level await in async main() — package.json has no "type":"module" so tsx transforms .ts as CJS; flipping global module type would risk Next build configs, so the runner avoids top-level await instead
- [03-01]: Full-chain runner records per-stage failures and keeps walking (plan requires walking all 5 with honest FAILs, exit 1 at end); only budget exhaustion (assertSpendable) aborts the run immediately per D-02 hard-stop
- [03-01]: check:registry strips // + /* */ comments before vocab/tuple regexes (self-invalidating-gate hygiene); RegistryStage vocabulary grepped from types.ts text, SILO_SLUGS from silos.ts text — site code never imported
- [03-02]: Real backfill EXECUTED fully-free per the 2026-10-17 OWNER DIRECTIVE above — terminal line `expand: advanced=27 rejected=274 spent=$0.00`, ledger 807 keyless requests (autocomplete 257 / trends 413 / serp 137), shards hold 27 filtered + 305 rejection-trail entries (cumulative; check:registry 5589 passed)
- [03-02]: KD/volume gates -> free-signal proxies G1 (autocomplete rank 1-8) / G2 (2-8 word shape, breadth>=5) / G3 (article-worthy intent form); D-05 >=60% overlap + D-07 per-geo capture UNCHANGED; every rejection keeps a reason prefix (G1/G2/G3/near-cannibal/U1)
- [03-02]: Anonymous Google HTML SERP blocked upstream -> anonymous Bing HTML swap (c19c8a1); consequence: paa[] empty platform-wide (Bing HTML has no PAA block) — FAQ stages must source questions elsewhere, no fabrication
- [03-02]: Request-cap governance added over the $0 ledger — monthlyRequestCap 4000 (used 807, 20%); SpendOp.requests records actual HTTP attempts incl. retries; monthlyEnvelopeUsd retained but all free ops bill $0.00 (correct per fully-free policy)
- [Phase 3]: 03-03: LLM adapter reworked to env-configurable OpenAI-compatible over plain fetch per binding fully-free directive (LLM_BASE_URL/LLM_MODEL/optional LLM_API_KEY + CHEAP/FALLBACK; errors name env vars, never values)
- [Phase 3]: 03-03: new free.llm ledger service records real-mode LLM calls at cost 0 with truthful attempts + assertRequestsAvailable preflight
- [Phase 3]: 03-03: outline FAQs carry DERIVED provenance from brief candidate questions (paa[] empty platform-wide); check-outline lint enforces non-invention via sibling brief
- [Phase 3]: 03-03: real full-chain run over 27 filtered survivors deferred to Plan 03-06 with free-endpoint env keys; pipeline:brief fails honestly at LlmNoCredentialsError before touching registry
- [Phase 3]: 03-04 — draft-schema.ts is the SINGLE zod source for post frontmatter (content-collections.ts imports it; comparison + optional heroImage pre-wired for 03-05); site edge stays pure zod + lib/silos
- [Phase 3]: 03-04 — ComparisonTable is a zero-client-JS server component with a comparison-gated slot before the MDX body; row-width refine fails the build ('one cell per column', negative-proof verified once); check:seeds accepts the component route on comparison presence
- [Phase 3]: 03-04 — PIPE-04's both halves verified in served HTML: seed-01 prerender carries data-comparison-table + verbatim cells + aria best pick + 'More in' up-link; seed-02 (no comparison) renders none

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

Last session: 2026-10-17T13:07:39.532Z
Stopped at: Completed 03-04-PLAN.md (comparison-as-frontmatter state machine live: draft-schema single source, ComparisonTable component, seed-01 proof) — ready for 03-05
Resume file: None
