---
phase: 03-content-pipeline
plan: 04
subsystem: site-render
tags: [zod, content-collections, comparison-table, server-component, frontmatter-schema, react-ssr, lint-gate, tdd]

# Dependency graph
requires:
  - phase: 03-content-pipeline/03-01
    provides: pipeline module geography (lib/pipeline/* exclusivity) + the registry/budget modules the draft stage will reuse
  - phase: 03-content-pipeline/03-03
    provides: stage/adapter contracts the 03-06 draft stage will borrow; confirmed the fully-free directive bounds everything downstream
  - phase: 02-seo-architecture-silo-ia/02-04
    provides: post-page contract (JSON-LD, silo crumb, RelatedPosts with 'More in {Label}' pillar up-link) verified untouched by this plan
  - phase: 01-site-foundation-trust/01-04
    provides: Content Collections zod build-gate precedent + check:seeds zero-dep lint idiom
provides:
  - lib/pipeline/draft-schema.ts — SINGLE-SOURCE zod module for ALL post frontmatter (existing fields + optional comparison + optional heroImage); imported by content-collections.ts at build time and reusable verbatim by the 03-06 draft stage (T-03-08/T-03-09 one-contract rule)
  - components/comparison-table.tsx — zero-client-JS server component rendering frontmatter comparison data (data-comparison-table hook, figcaption title, th scope=col, indigo best-row tint + aria-labelled star, muted note)
  - app/blog/[slug]/page.tsx comparison-gated render slot immediately before the MDX body (Wirecutter early-table pattern)
  - seed-01 as the live frontmatter→zod→component proof (all other seeds keep GFM tables)
  - check:seeds conditional: comparison frontmatter presence satisfies the table requirement; shape stays the build's zod job
affects: [03-05 (heroImage path format), 03-06 (draft stage emits comparison frontmatter through this schema), phase 4 QA gates, phase 5 publishing]

# Tech tracking
tech-stack:
  added: [] # no new dependencies — zod schemas + plain React server component
  patterns: [single-source frontmatter schema (draft-schema.ts imported by build AND pipeline), data-not-markup comparison tables (frontmatter rows → shared server component), build-fail refine gate for row-width vs column count, early-table Wirecutter render slot, source-probe site-code assertions in suites (Phase-2 precedent)]

key-files:
  created:
    - lib/pipeline/draft-schema.ts
    - components/comparison-table.tsx
    - test/pipeline/draft-schema.test.ts
    - test/pipeline/comparison-table.test.ts
  modified:
    - content-collections.ts
    - app/blog/[slug]/page.tsx
    - content/posts/seed-01-best-ai-writing-assistants-2026.mdx
    - scripts/check-seeds.mjs

key-decisions:
  - "draft-schema.ts is the one deliberate lib/pipeline edge site code may consume: imports ONLY zod + lib/silos (pure zod module, no pipeline internals), so no registry/LLM/data code reaches the site bundle (locked pipeline/site split honored)"
  - "Comparison row width is NOT a fixed-length schema field: the refine at comparisonSchema level enforces rows.cells.length === columns.length ('one cell per column') so negative cases fail with a readable build error — proven once against a temp fixture that failed the build with exactly that message"
  - "heroImage path contract (/images/{silo-slug}/{name}.avif|webp + alt >=10 chars) is enforced NOW as optional so every 03-05 asset lands in the controlled layout"
  - "seed-01 verdict pick for best:true = ChatGPT ('Best all-rounder for bloggers' — the article's own starting-point verdict); all 7 rows carry verbatim cells from the deleted GFM table"
  - "check-seeds table rule is conditional on comparison frontmatter presence (columns: + >=2 cells rows); the flat-key frontmatter parser was ALSO fixed to anchor at column 0 so nested comparison keys cannot shadow top-level fields from the lint's perspective"
  - "Post-page render slot verified as source probe + integration prerender probe (Phase-2 precedent: suites never import site code); seed-02 absence confirms the gate, seed-01 presence + 'More in' up-link confirm both PIPE-04 halves"

patterns-established:
  - "Frontmatter-as-data render pattern: zod-validated frontmatter object → `{post.comparison && <Component {...post.comparison} />}` slot — drafts (03-06) inherit a guaranteed render path by filling frontmatter alone"
  - "Build-fail negative proof pattern: temp content file fails `next build` with the exact zod message once, then is deleted (no fixture residue)"

requirements-completed: [PIPE-04]

# Metrics
duration: 15min
completed: 2026-10-17
---

# Phase 3 Plan 04: Comparison Tables as Frontmatter Data Summary

**Draft-schema single-source zod contract + zero-client-JS ComparisonTable server component + seed-01 frontmatter retrofit, with malformed rows failing the build and the prerender proof carrying both PIPE-04 halves (table component + 'More in' pillar up-link)**

## Performance

- **Duration:** 15 min (12:47Z → 13:02Z)
- **Started:** 2026-10-17T12:47:30Z
- **Completed:** 2026-10-17T13:01:59Z
- **Tasks:** 3/3 complete (TDD RED→GREEN on tasks 1-2)
- **Files modified:** 8 code/test files across 6 commits

## Accomplishments
- `lib/pipeline/draft-schema.ts`: the single zod source for ALL post frontmatter — existing Phase-1 fields byte-compat, plus optional `comparison` (2-6 columns, 2-12 rows, row-width refine) and optional `heroImage` pre-wired for 03-05; imports only zod + `lib/silos` so the site/pipeline dependency edge stays clean
- `content-collections.ts` validates posts via `draftSchema.extend({ content: z.string() })` — the build gate and the future draft stage share ONE schema (no drift, T-03-09); transform + extractHeadings untouched
- `components/comparison-table.tsx`: server component with `data-comparison-table` hook, figcaption title strip, `th scope="col"` header, indigo-tinted best row with `aria-label="best pick"` star, muted note paragraph — mirrors the GFM table visual system so both table routes read as one surface
- `app/blog/[slug]/page.tsx`: comparison-gated slot immediately before the MDX body; related-posts block and breadcrumbs untouched (Phase-2 contract)
- seed-01 retrofitted: GFM tool table → `comparison` frontmatter (4 columns / 7 verbatim rows, ChatGPT `best: true`), body table deleted, section intro reworded to flow with the early table (pricing caution kept)
- `check:seeds` accepts the component route on comparison-frontmatter presence; seed-01 passes alongside the 4 GFM seeds (5 passed)
- Negative build proof executed once: a temp fixture with a 4-cell row under 3 columns failed `next build` with exactly "comparison: every comparison row must have one cell per column", then was deleted

## Task Commits

Each task committed atomically (TDD RED → GREEN for tasks 1-2):

1. **task 1: draft-schema module + Content Collections attachment** — RED `b667499` (test) → GREEN `9d6ec34` (feat)
2. **task 2: ComparisonTable component + post-page render slot** — RED `20f5c68` (test) → GREEN `726dc4d` (feat)
3. **task 3: seed-01 retrofit + check-seeds conditional** — `e5db851` (feat)

**Plan metadata:** final `docs(03-04)` commit (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `lib/pipeline/draft-schema.ts` — single-source frontmatter contract (comparison + heroImage schemas, silo enum reuse via import)
- `content-collections.ts` — posts schema attached from draftSchema (import single-source, no inline re-declaration)
- `components/comparison-table.tsx` — D-14 render half, zero client JS
- `app/blog/[slug]/page.tsx` — comparison-gated early render slot
- `content/posts/seed-01-best-ai-writing-assistants-2026.mdx` — frontmatter rows replace the inline GFM table (live proof)
- `scripts/check-seeds.mjs` — comparison-aware table rule + column-0 anchor for top-level keys
- `test/pipeline/draft-schema.test.ts` — 5 tests: seed-01 verbatim parse, row-width refine, well-shaped comparisons, heroImage path contract, all-seeds parity
- `test/pipeline/comparison-table.test.ts` — 5 tests: SSR markup probes, best-row signals, figcaption/note, page source probe

## Decisions Made
- **best:true pick for seed-01 = ChatGPT**: the table's verdict column rates each tool per-category, and the article's own narrative crowns ChatGPT as the starting point ("Best all-rounder for bloggers"; "Start with a general drafter"). Row cells otherwise verbatim from the deleted GFM table.
- **Task-2 test 4 semantics (source + integration probe):** the plan's "post page for seed-01 renders the component before MDX body" is proven two ways without importing site code into suites (Phase-2 precedent): (a) a source probe asserting the `{post.comparison && <ComparisonTable {...post.comparison} />}` slot precedes `<ArticleBody>`, and (b) the task-3 integration probe asserting the prerendered seed-01 HTML contains `data-comparison-table` + verbatim cells + aria best pick + 'More in' up-link while comparison-less seed-02 does NOT.
- **Plan verify command adaptation:** the `npx tsx -e` inline markup probe is mirrored exactly by test `T1b` (same four regex assertions) inside `test/pipeline/comparison-table.test.ts` — PowerShell-safe and CI-runnable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] check-seeds flat-key frontmatter parser would let nested comparison keys shadow top-level fields**
- **Found during:** task 3 (seed-01 retrofit + check-seeds conditional)
- **Issue:** the parser matched `key: value` on `.trim()`-ed lines, so the comparison block's nested `  title:` (34 chars) would overwrite `fm.title` and fail the 50-60 gate for the wrong reason — previously invisible because nested keys (`q`/`a`) were never checked fields
- **Fix:** match the `^([A-Za-z]+):` pattern on the RAW line (column-0 anchor) so only real top-level keys register; nested keys stay out of the flat map
- **Files modified:** scripts/check-seeds.mjs
- **Verification:** check:seeds 5 passed — seed-01's real title still measured (56 chars), comparison block accepted via the conditional
- **Committed in:** `e5db851`

---

**Total deviations:** 1 auto-fix (Rule 1 correctness bug in an in-scope file)
**Impact on plan:** none beyond correctness; all plan verify lines green (`npx tsc --noEmit`, `npm run build` ×5 across tasks incl. the negative proof, `npm run check:seeds`, suite 25/25, prerender probe PASS).

## Issues Encountered
- `npm run lint` exits 1 with 4 errors + 13 warnings — ALL pre-existing (Breadcrumb `<a href="/">` on code this plan never wrote; `prefer-const` in 03-02/03-03 stage files). Per the scope boundary they were not fixed; recorded in `.planning/phases/03-content-pipeline/deferred-items.md`.
- 5 `npm run build` runs across the plan (schema attach green, negative-proof fail, post-delete green, component green, seed retrofit green) — each ~1-2 min; the negative proof failed early in the Collections sync stage as designed.

## User Setup Required

None - no external service configuration required (pure site/data plumbing).

## Known Stubs
None — the render path is fully wired end-to-end (frontmatter → zod gate → component → prerendered HTML verified on seed-01). The heroImage field is intentionally optional and unpopulated until Plan 03-05 (documented plan dependency, not a stub).

## Next Phase Readiness
- **03-05 (assets stage):** the heroImage path contract is already schema-enforced (`/images/{silo-slug}/{name}.avif|webp`, alt ≥10) — the assets stage should emit exactly that shape and the hero render/OG wiring lands next
- **03-06 (draft stage):** import `draftSchema` from `lib/pipeline/draft-schema.ts` (the single contract) when emitting compareable frontmatter from outlines — the render slot, build gate, and lint conditional all already accept it; outlined entries with a comparison-table marker can now materialize rows safely
- 27 live `filtered` survivors + outline-stage machinery remain queued for 03-06's real full-chain run (free-endpoint env keys required per 03-03)

---
*Phase: 03-content-pipeline*
*Completed: 2026-10-17*

## Self-Check: PASSED

All 8 claimed code/test files verified on disk (page.tsx confirmed via literal path — PowerShell glob quirk); all 5 task commits (b667499, 9d6ec34, 20f5c68, 726dc4d, e5db851) found in git log --all. Suite 25/25, `tsc --noEmit` clean, `npm run build` green post-retrofit, `check:seeds` 5 passed, prerender probe PASS (seed-01 table + 'More in'; seed-02 gated). One deferred lint backlog documented in deferred-items.md.
