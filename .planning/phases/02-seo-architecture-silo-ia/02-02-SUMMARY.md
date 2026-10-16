---
phase: 02-seo-architecture-silo-ia
plan: 02
subsystem: seo
tags: [sitemap-sharding, generateSitemaps, robots-txt, crawl-budget, diff-gated-lastmod, ci-gate, nextjs-16]

# Dependency graph
requires:
  - phase: 01-site-foundation-trust
    provides: [flat /blog/{slug} URLs, lib/site.ts single-source constants, 5 seed posts with silo frontmatter, trust/author pages]
  - phase: 02-seo-architecture-silo-ia (plan 01)
    provides: [SILO_SLUGS single-source taxonomy in lib/silos.ts (parity target, parsed as text — never imported)]
provides:
  - Split sitemaps (shard 0 = posts, shard 1 = pages) with diff-gated lastmod (app/sitemap.ts)
  - Strict robots policy declaring both shards directly (app/robots.ts)
  - Zero-dependency CI crawl-consistency suite, 85 checks across 7 groups (scripts/check-crawl.mjs + check:crawl + lhci crawl job)
affects: [02-03 silo landings (new /{silo} URLs must appear in shard 1 automatically via data-driven derivation), 02-04 post wiring, Phase 3 pipeline (new posts flow into shard 0 + silo parity), Phase 4 QA (crawl suite is the SEO-04 enforcement point)]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-driven sitemap landings (distinct post silos, no taxonomy import — Wave-1 parallelism), diff-gated lastmod (content dates only, REVIEW_DATE constant for evergreen pages), robots-declared shards instead of index (Next generates none), zero-dep .next-output CI suite with negative spot-checks]

key-files:
  created: [scripts/check-crawl.mjs]
  modified: [app/sitemap.ts, app/robots.ts, package.json, .github/workflows/lhci.yml]

key-decisions:
  - "Sitemap handler is async and awaits `id`: Next 16 passes a Promise<string> route param — sync comparison silently renders both shards identically"
  - "No /sitemap.xml index: Next generates none for generateSitemaps() shards and reserves the path (explicit index route breaks the build) — robots.txt declares both shards via two Sitemap: lines instead"
  - "Shard URLs are /sitemap/0.xml + /sitemap/1.xml (not /sitemap.xml/0.xml as the plan assumed)"
  - "Suite parses lib/silos.ts as text for parity (never imports it) — honors Wave-1 parallelism with Plan 01"

patterns-established:
  - "Crawl-surface truth flows from content: shard 1 landings derive from distinct post silos; adding a post/silo updates the sitemap with zero sitemap edits"
  - "CI tripwires over comments: build-breaking constraints (no sitemap.xml route, no Disallow, no tag/archive routes) are suite assertions, not just code comments"
  - "Every crawl-suite check group gets a negative spot-check before sign-off (groups 4 and 5 mutated-and-reverted this plan)"

requirements-completed: [SEO-01, SEO-04]

# Metrics
duration: 60min
completed: 2026-10-17
---

# Phase 02 Plan 02: Crawl Surface Summary

**Split sitemaps (5-post + 12-page shards) with diff-gated lastmod, robots-declared shard discovery, and an 85-check zero-dependency CI crawl-consistency suite**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-10-17T02:20Z (approx)
- **Completed:** 2026-10-17T03:20Z (approx)
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `app/sitemap.ts`: `generateSitemaps()` returns `[{id:0},{id:1}]`; shard 0 = 5 posts (`/blog/{slug}`, lastmod = `updatedAt`); shard 1 = 12 pages (homepage with newest-post lastmod, 5 `/{silo}` landings derived from distinct post silos sorted alphabetically with per-silo max-`updatedAt`, 5 trust pages + author page pinned to `REVIEW_DATE = 2026-10-16`); priorities/frequencies per plan (posts monthly/0.8, landings weekly/0.9, homepage daily/1.0, trust yearly/0.3)
- `app/robots.ts`: `allow:/`, zero Disallow, two `Sitemap:` lines declaring `/sitemap/0.xml` + `/sitemap/1.xml` directly
- `scripts/check-crawl.mjs` + `check:crawl` script + `crawl` CI job in `lhci.yml` (existing jobs untouched): 85 checks across 7 groups (sharding, shard-0 post/lastmod parity vs MDX frontmatter, shard-1 exact membership, silo parity vs `SILO_SLUGS` text-parse + ≥1 post per silo, robots policy, noindex surface walk + layout `index:true`, lastmod freshness) — all-pass exit 0
- Live proof via `next start`: `/sitemap/0.xml` → 200 (5 posts), `/sitemap/1.xml` → 200 (12 pages), `/robots.txt` → allow + both shard pointers
- Negative spot-checks: removing a silo from `SILO_SLUGS` fails group 4 (2 FAILs); appending `Disallow: /` to prerendered robots fails group 5 — both fixtures reverted, tree clean

## Task Commits

Each task was committed atomically:

1. **Task 1: split sitemaps plus robots policy** - `d08aa02` (feat)
2. **Task 2: crawl-consistency suite plus CI enforcement** - `cdbee4e` (feat)

## Files Created/Modified

- `app/sitemap.ts` - sharded sitemap (generateSitemaps 0=posts/1=pages, data-driven landings, REVIEW_DATE evergreen pin)
- `app/robots.ts` - allow:/ + dual-shard Sitemap declarations, no Disallow
- `scripts/check-crawl.mjs` - 7-group crawl-consistency suite (Windows-safe paths, zero deps)
- `package.json` - `check:crawl` script
- `.github/workflows/lhci.yml` - `crawl` job (checkout, node 22, npm ci, build, check:crawl)

## Decisions Made

- Async sitemap handler awaiting `id`: Next 16's metadata-route loader calls `handler({ id: targetIdPromise })` (verified in `next-metadata-route-loader.js`) — the plan-implied sync `{ id: number }` signature received a Promise object, `Number(Promise)` was NaN, and both shards silently rendered the pages branch. Fixed by `Number(await id)` with a comment citing the loader.
- No `/sitemap.xml` index: Next generates none for `generateSitemaps()` shards (live-verified 404) and reserves the path — an explicit `app/sitemap.xml/route.ts` fails the build with a route/metadata conflict (attempted, build error observed, file removed). Discovery is via two `Sitemap:` lines in robots.txt, which the sitemap protocol explicitly allows and Google/Bing consume without an index.
- Shard URL shape is `/sitemap/0.xml` + `/sitemap/1.xml` (build-manifest ground truth), not the plan's `/sitemap.xml/0.xml`.
- Suite holds Wave-1 parallelism: never imports `lib/silos.ts` (Plan 01's module); group 4 parses the `SILO_SLUGS` tuple as text and asserts set-equality with distinct post silos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Async `id` param in sharded sitemap handler**
- **Found during:** task 1 (build output showed both shards with identical pages content)
- **Issue:** Plan's `sitemap({ id }: { id: number })` signature never matches at runtime — Next 16 passes `id` as a `Promise<string>` (route params are async since Next 15). Both shards rendered the pages branch; without the fix the posts shard would be silently missing.
- **Fix:** Handler is `async`, type `id: Promise<string> | string | number`, `const shard = Number(await id)` (`await` is a no-op on plain values, future-proof). Comment cites the loader behavior.
- **Files modified:** app/sitemap.ts
- **Verification:** Rebuilt; `0.xml.body` = 5 posts, `1.xml.body` = 12 pages; live curl confirms 5/12 URL counts
- **Committed in:** d08aa02 (task 1 commit)

**2. [Rule 3 - Blocking] No sitemap index: robots declares both shards directly**
- **Found during:** task 2 verification (live `next start` curl)
- **Issue:** Plan assumed `/sitemap.xml` auto-index pointing at `/sitemap.xml/0.xml` + `/sitemap.xml/1.xml`. Reality: Next serves shards at `/sitemap/0.xml` + `/sitemap/1.xml`, generates no index (live 404), and an explicit index route at that path breaks the build (route/metadata conflict — attempted and observed). Following the plan literally yields undiscoverable shards + a red build.
- **Fix:** `app/sitemap.xml/route.ts` attempt removed; `robots.ts` declares both shards via two `Sitemap:` lines (protocol-standard); suite group 1 asserts exactly shards {0,1} in build output + guards against re-adding the build-breaking index route; group 5 asserts both shard pointers present.
- **Files modified:** app/robots.ts, scripts/check-crawl.mjs (app/sitemap.ts/suite comments document the constraint)
- **Verification:** `npm run build` green; live `/robots.txt` shows allow + both pointers; both shards 200 with 5/12 URLs
- **Committed in:** cdbee4e (task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 correctness bug, 1 blocking framework mismatch)
**Impact on plan:** Both required for the plan's own must-have truths (shard separation actually holding; crawlers actually discovering shards). SEO-01/SEO-04 satisfied at crawl-surface level via robots-declared shards rather than an index — equivalent discovery guarantee, one fewer hop. No scope added.

## Issues Encountered

- PowerShell `||`/`&` operators and `echo ===` quirks: used `;`-chained commands, `Select-Object`, and file ops instead. No impact on deliverables.
- Background `next start` servers persist as orphan processes after shell calls end (jobs don't survive across invocations): killed strays via port lookup before/after live verification; no servers left running.
- A failed intermediate build (index-route conflict) left `.next` in a state where the suite failed on robots checks: resolved by removing the conflicting route and rebuilding; final `npm run build && npm run check:crawl` is green on a clean tree.

## Threat Flags

None — all new surface was in the plan's threat model and is mitigated: T-02-03 (only canonical 200-status URLs, no query params; suite groups 2–3 enforce exact membership), T-02-04 (explicit allow:/, zero Disallow; group 5 fails CI on site-wide disallow; dual-shard declaration keeps shards discoverable), T-02-05 (no archive/tag/pagination routes; group 6 fails CI if introduced).

## Known Stubs

None — shard 1's 5 `/{silo}` landing URLs are currently 404 (no landing pages yet); that is expected sequencing, not a stub: Plan 02-03 builds `app/[silo]/page.tsx` and the data-driven derivation means shard 1 needs zero edits when landings land. Suite group 3 asserts URL *membership*, not HTTP status, so it stays green until 02-03 ships.

## Self-Check: PASSED

- FOUND: app/sitemap.ts (generateSitemaps + async handler), app/robots.ts (dual-shard pointers), scripts/check-crawl.mjs, package.json (check:crawl), .github/workflows/lhci.yml (crawl job)
- FOUND: commits d08aa02, cdbee4e in git log
- `npm run build` green; `npm run check:crawl` → "85 crawl checks passed"; `npx tsc --noEmit` clean; live `next start` → shard0 5 URLs, shard1 12 URLs, robots allow + 2 shard pointers
- No stray servers left running; temp mutation fixtures (lib/silos.ts, robots.txt.body) verified byte-identical after revert (`git diff` clean on lib/silos.ts; robots body matches fresh build)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-03 landings: create `app/[silo]/page.tsx` with `generateStaticParams` over post silos — shard 1 already lists all 5 `/{silo}` URLs, no sitemap changes needed; suite group 4 (every silo ≥1 post) already enforces the D-07 ship-all-5 contract
- 02-04 post wiring: no sitemap/robots impact; `npm run build && npm run check:crawl` stays the per-task gate (ROADMAP cross-cutting constraint)
- Watch: any new route segment matching tag|archive|category or a dynamic segment other than `[slug]`/`[silo]` fails group 6 — 02-03's `[silo]` segment is explicitly allowlisted
- No blockers

---
*Phase: 02-seo-architecture-silo-ia*
*Completed: 2026-10-17*
