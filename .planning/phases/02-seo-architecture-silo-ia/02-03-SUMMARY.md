---
phase: 02-seo-architecture-silo-ia
plan: 03
subsystem: seo-ui
tags: [silo-landings, hub-and-spoke, dynamic-route-siterep, generate-static-params, notfound-defense, internal-linking, homepage-hubs, nextjs-16]

# Dependency graph
requires:
  - phase: 02-seo-architecture-silo-ia
    plan: 01
    provides: [SILO_SLUGS/SILOS/getSilo/siloUrl in lib/silos.ts (labels, landing titles, meta descriptions, intros), canonicalFor/localeAlternates (lib/seo/canonical.ts)]
  - phase: 02-seo-architecture-silo-ia
    plan: 02
    provides: [shard-1 sitemap already listing all 5 /{silo} URLs (data-driven, zero sitemap edits needed), check:crawl CI suite]
affects: [02-04 post-page wiring (crumb up-target now 200 /{silo}; landing-list link endpoint), phase 3 pipeline (new posts auto-listed on their silo landing + auto-counted on homepage hubs)]

# Tech tracking
tech-stack:
  added: []
  patterns: [single-copy-route (labels/intro/meta only from lib/silos.ts, never re-derived in routes), async route params (Promise awaited since Next 15/16), allowlist-or-notFound guard (T-02-02), newest-first localeCompare sort, JSX-SSR-free link graph (hubs→landings→posts two-hop)]

key-files:
  created: [app/[silo]/page.tsx]
  modified: [app/page.tsx]

key-decisions:
  - "Silo landings at root /{silo} per D-02 — flat URLs, hierarchy lives in links only; static routes (/about) would shadow a silo-named page (accepted, documented in code, rename silo instead)"
  - "generateStaticParams returns SILO_SLUGS only — unknown silo slug hits getSilo() miss → notFound() in BOTH generateMetadata and the page component (T-02-02 path traversal/tampering defense)"
  - "Homepage hubs section inserted above the latest-posts list; hubs link exclusively via siloUrl() to landings, never directly to posts (D-15 two-hop); latest-posts markup kept byte-identical below"
  - "OpenGraph images reuse the site fallback /opengraph-image route — no per-silo image routes (scope control)"

patterns-established:
  - "Landing cluster list = newest-first (localeCompare desc) filtered by silo from allPosts"
  - "Every landing carries an explicit up-link: 'Browse all topics' → /#topics (homepage hubs anchor)"
  - "unique-intro discipline: intro prose rendered verbatim from lib/silos.ts entry (120–160 words, unique across silos)"

requirements-completed: [SEO-05]

# Metrics
duration: 15min (continuation session; tasks committed by prior interrupted session at 03:07–03:11Z)
completed: 2026-10-17
---

# Phase 02 Plan 03: Silo Landings + Homepage Hubs Summary

**Five static silo landings at root /{silo} with curated intros + newest-first cluster lists, plus a hubs-on-top homepage that binds the hub-and-spoke link graph**

## Performance

- **Duration:** ~15 min (this continuation session: verification sweep + summary + state)
- **Started:** 2026-10-17T10:49Z (session; task commits predate it — see Continuation note)
- **Completed:** 2026-10-17T11:10Z (approx)
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Continuation Note

A prior executor session committed both task code changes (b4d4ec4 at 03:07Z, 26a1353 at 03:11Z) but died before running plan-level verification. This session verified the committed work end-to-end (build, tsc, check:crawl, check:seeds, live link-graph sweep), found no issues with the code itself — all "failures" during the sweep were probe-script strictness (Next SSR renders camelCase `hrefLang`; JSX SSR inserts `<!-- -->` between text expressions), not site bugs — then completed the summary and state updates. No code edits were needed.

## Accomplishments

- `app/[silo]/page.tsx` (new): `generateStaticParams()` maps `SILO_SLUGS` from lib/silos (single source — no local slug list); `generateMetadata` resolves the silo via `getSilo()`, calls `notFound()` on unknown slugs (T-02-02 invalid-silo defense), and returns landing title + 150–160-char meta description from the Silos entry + `localeAlternates(canonicalFor('/'+silo))` (self-referencing canonical, en-US + x-default — consistent with post pages). Page renders: breadcrumb Home / {Label} (aria-labeled nav, `aria-current="page"` on the label), H1 = label, unique intro prose from SILOS, "Latest {label} guides" cluster list newest-first (title anchor text = post title per D-13, description excerpt, date · min read) linking to `/blog/{slug}`, and a "Browse all topics" up-link to the homepage hubs anchor (`/#topics`). Zero client JS; same max-w editorial column and card styles as the homepage. Code comment documents the static-route-shadowing edge (a future static page named like a silo shadows the landing — accepted, rename the silo instead).
- `app/page.tsx` (modified): "Browse by topic" hubs section inserted ABOVE the unchanged latest-posts list — five cards (label + one-line intro excerpt via first-sentence slice + post count "1 guide") each linking via `siloUrl(slug)` to the landing only (D-15 two-hop: hubs never link directly to posts). Labels/intros/counts derive from `@/lib/silos` + `allPosts` at render — zero duplicated copy (grep gate holds: silo display copy appears only in lib/silos.ts).
- Live link-graph proof on production build (66/66 sweep checks passed): `/` 200 with hubs on top + unchanged latest list; each of the 5 landings 200 with self-ref canonical + en-US/x-default self alternates + breadcrumb + its 1 post + up-link; landing titles unique across the 5 silos; `/vpn-deals` → 404; sitemap shard 1 already lists all 5 landing URLs and each now resolves 200 (Plan 02's URLs alive).

## Task Commits

Each task was committed atomically:

1. **Task 1: silo landing route at root /{silo}** - `b4d4ec4` (feat)
2. **Task 2: homepage hubs section plus link-graph verification** - `26a1353` (feat)

Build output confirms 5 new static routes (`/ai-writing`, `/ai-coding`, `/ai-image`, `/ai-productivity`, `/ai-guides` — ● SSG via generateStaticParams).

## Files Created/Modified

- `app/[silo]/page.tsx` - silo landing route (static params from SILO_SLUGS, notFound defense, canonical/alternates, intro + cluster list + up-link)
- `app/page.tsx` - hubs-on-top section (5 cards via siloUrl, counts from allPosts, latest list unchanged)

## Decisions Made

- notFound guard placed in both `generateMetadata` and the page component: the param-typing date means an unknown slug could reach either entry point; both must fail closed (T-02-02 mitigation kept single-source via getSilo()).
- Up-link anchor target is `/#topics` (homepage hubs section `id`), not `/` plain — the D-16 up-link triangle wants the visitor to land exactly on the hub cards.
- Count line uses singular/plural rendering ("1 guide") with the count derived from `allPosts` at render — future pipeline posts auto-update hub counts with zero edits.

## Deviations from Plan

### Auto-fixed Issues

None in this code: plan executed as written; both tasks' done criteria were met by the committed implementation. (Two live-sweep probe failures were fixed in the temp verification script itself — regex literals don't interpolate `template ${s}` expressions, and JSX SSR comment markers `<!-- -->` break naive `includes` on "1 guide"; site output was correct in both cases.)

---

**Total deviations:** 0 code deviations, 0 scope additions
**Impact on plan:** None. No D-decision (D-01..D-16) altered; no post-page/Related changes (Plan 04's files untouched).

## Issues Encountered

- PowerShell quoting has burned prior waves with inline node scripts — reused the temp-script pattern (write to temp dir, run, delete); all temp probes removed after verification.
- Prior-session orphan risk with next start servers: sweep used ports 3100/3101 with child-process kill in finally; netstat confirms no strays.

## Threat Flags

None — the route's new URL-driven content-selection surface was in the plan's threat model and is mitigated: T-02-02 (generateStaticParams allowlist + getSilo miss → notFound in both generateMetadata and page body; no filesystem or query-param reflection), T-02-06 (unique 120–160-word intros from lib/silos.ts, list context on every landing, hubs + crumb + up-link prevent orphan/thin shape).

## Known Stubs

None — all five landings render real data (unique intro + 1 real seed post each, crawled live), homepage hubs count real posts. Note: each landing currently lists only 1 post (thin by volume, not by design) — expected sequencing with 5 seed posts across 5 silos; Phase 3's pipeline scales posts while landings auto-expand (no code stubs).

## Self-Check: PASSED

- FOUND: app/[silo]/page.tsx, app/page.tsx (hubs section present, checks grep-green)
- FOUND: commits b4d4ec4, 26a1353 in git log; no file deletions in either commit
- `npm run build` green with 5 static /{silo} routes; `npx tsc --noEmit` exit 0; `npm run check:crawl` → "85 crawl checks passed"; `npm run check:seeds` → 5 passed
- Live sweep: 66/66 checks (homepage hubs-on-top + D-15 no-/blog-in-topics + latest intact; landings 200 + canonical + hrefLang self + breadcrumb + post + up-link; titles unique; /vpn-deals 404; shard-1 landings resolve 200); no stray servers; single-source grep gate clean (silo display copy only in lib/silos.ts)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-04 post-page wiring: every crumb's middle node ({silo} landing) is now a live 200 static page; the landing-list link budget endpoint exists; D-13 title-anchor-text proven in plan files
- Phase 3 pipeline: a new post lands on its silo landing automatically (newest-first list + shard-1 lastmod via per-silo max-updatedAt) and updates its homepage hub card count — zero UI edits needed per post
- No blockers
