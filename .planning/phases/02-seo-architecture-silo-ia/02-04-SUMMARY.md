---
phase: 02-seo-architecture-silo-ia
plan: 04
subsystem: seo-page-templates
tags: [json-ld, breadcrumb, canonical, hreflang, next-seo, related-posts, link-graph, verification-sweep]

# Dependency graph
requires:
  - phase: 02-seo-architecture-silo-ia
    plan: 01
    provides: [buildArticleJsonLd/buildBreadcrumbJsonLd/buildFaqJsonLd (lib/seo/jsonld.ts), canonicalFor/localeAlternates (lib/seo/canonical.ts), SILOS/getSilo/siloUrl (lib/silos.ts)]
  - phase: 02-seo-architecture-silo-ia
    plan: 03
    provides: [live /{silo} landings (sil crumb up-target, Related up-link endpoint)]
affects: [Phase 3 pipeline (new posts inherit wired template automatically: silo crumb, 3 JSON-LD blocks, alternates, Related empty-state), Phase 4 QA (schema-validity gate consumes these builders), phase-level closure (last plan — phase verification sweep executed here)]

# Tech tracking
tech-stack:
  added: []
  patterns: [same-object feeding (visible crumb/FAQ and JSON-LD render from the identical post object — mirror by construction), next-seo v7 components in RSC (ArticleJsonLd/BreadcrumbJsonLd/FAQJsonLd spread from lib/seo builders), slugs-narrowed prop contract (SiloSlug from content enum), lone-client-island preservation (no new client JS; JSON-LD is RSC-rendered)]

key-files:
  created: []
  modified: [app/blog/[slug]/page.tsx, components/related-posts.tsx]

key-decisions:
  - "FAQJsonLd (actual next-seo v7 export) used where the plan text said FAQPageJsonLd — Plan 01 already documented the rename; builders + components stay in the same union of exports"
  - "RelatedPosts silo prop narrowed from string to SiloSlug — prop names unchanged, call site untouched, siloUrl() becomes compile-time safe"
  - "Related section is never hidden now: null return replaced by empty-state landing link, so 1-post silos have no dead end (D-11/D-12)"
  - "Breadcrumb component takes (siloLabel, siloHref, title); silo resolved via getSilo with fail-closed notFound guard (T-02-02 posture)"

patterns-established:
  - "Post template SEO plumbing is builder-fed only: routes never hand-roll JSON-LD or re-derive canonical/alternates strings"
  - "Phase verification sweeps assert schema against SERVED VISIBLE markup (self-consistency), with ground truth text-parsed from content frontmatter and lib/silos.ts — suites never import site code"

requirements-completed: [SEO-02, SEO-03, GEO-01, GEO-03]

# Metrics
duration: 18min
completed: 2026-10-17
---

# Phase 02 Plan 04: Post-Page SEO Wiring + Phase Verification Summary

**Silo crumb + self-canonical/hreflang + next-seo v7 JSON-LD wired into the post template, Related upgraded to a never-hidden silo up-link, and the full phase-02 evidence sweep green (91 live checks + 85 crawl + 5 seeds)**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-10-17T05:07Z
- **Completed:** 2026-10-17T05:25Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- `app/blog/[slug]/page.tsx` (task 1, commit `95f59d7`):
  - **Breadcrumb (D-06):** Home (`/`) / {Silo label} (links `/{silo}` via siloUrl, label via getSilo) / Title current-page — replaced the static "Blog" crumb; aria-current on the title only
  - **Head (GEO-01/GEO-03):** `generateMetadata` alternates now `localeAlternates(canonicalFor('/blog/{slug}'))` from lib/seo/canonical.ts — self-referencing canonical + en-US + x-default; title/description/OG/Twitter untouched
  - **JSON-LD (SEO-02):** `<ArticleJsonLd type="BlogPosting" {...buildArticleJsonLd(post, canonical)} />`, `<BreadcrumbJsonLd {...buildBreadcrumbJsonLd([Home→SITE_URL, label→landing, title→canonical])} />`, and conditional `<FAQJsonLd {...faqJsonLd} />` — all fed by Plan-01 builders from the same `post` object that renders the visible crumb/FAQ (mirror by construction; `<` already stripped at builder level per Plan 01; next-seo serializes/escapes; no hand-serialized JSON remains)
  - Article body, TOC, FAQ markup, Byline, AiBadge, AdSlot copy script, OG routes byte-unchanged
- `components/related-posts.tsx` (task 2, commit `a07ac5e`):
  - Header pillar up-link **"More in {Label}"** → silo landing (D-09, alongside the crumb) with the silo display name as anchor text (D-13)
  - **Never hidden:** empty same-silo list renders "See all {Label} guides" → landing instead of `return null` (D-11/D-12) — every 1-post silo has a Related block with a live silo link, no dead end
  - Deterministic same-silo newest-first up-to-3 logic untouched (D-10/D-14); strict same-silo only, anchor text = post titles for siblings
  - Props contract preserved (`{ currentSlug, silo }`); `silo` narrowed to `SiloSlug` (compile-time siloUrl safety, call site unedited)
- **Full phase verification sweep (task 2):** production `next start` (port 3200, session-scoped, killed after) + curl fetch + JSON parse across all 5 posts, 5 landings, homepage, and a negative check — **91/91 assertions passed** (evidence below), plus `npm run build`, `npx tsc --noEmit`, `npm run check:crawl` (85 checks), `npm run check:seeds` (5) all green at final HEAD (`a07ac5e`).

## Task Commits

Each task was committed atomically:

1. **Task 1: silo breadcrumb plus canonical/hreflang plus JSON-LD wiring** - `95f59d7` (feat)
2. **Task 2: RelatedPosts minor upgrade plus full phase verification** - `a07ac5e` (feat)

Build output confirms all 5 post routes and 5 landing routes prerendered (●); no route additions/removals.

## Files Created/Modified

- `app/blog/[slug]/page.tsx` — silo crumb (visible Breadcrumb), canonicalFor/localeAlternates in generateMetadata, three next-seo v7 JSON-LD blocks from lib/seo builders; faqJsonLd computed once and conditionally rendered
- `components/related-posts.tsx` — "More in {Label}" header link + empty-state landing link; same-silo logic unchanged; SiloSlug-typed prop

## Phase Verification Evidence (task 2 — per-URL matrix)

Live server: `next start -p 3200`, curl.exe GET + status, JSON-LD parsed as JSON. Ground truth: frontmatter `silo` text-parse + `lib/silos.ts` label text-parse (no site-code imports); schema mirrored against SERVED visible markup.

**Posts (5 × 8 assertion groups):**

| Post | 200 | Canonical self | Alternates (en-US+x-default only) | Article (headline===H1, url/mainEntity/dates) | FAQ (schema n===visible n, 3–5, byte parity) | BreadcrumbList === visible crumb | Related present + silo link + empty-state | No cross-silo in Related |
|------|-----|----------------|-----------------------------------|-----------------------------------------------|----------------------------------------------|----------------------------------|--------------------------------------------|--------------------------|
| best-ai-writing-assistants-2026 | 200 | ✓ | ✓ | ✓ | ✓ (4=4) | ✓ (pos 1..3, trail Home→AI Writing→title) | ✓ | ✓ |
| chatgpt-vs-claude-coding | 200 | ✓ | ✓ | ✓ | ✓ (3=3) | ✓ | ✓ | ✓ |
| best-free-ai-image-generators | 200 | ✓ | ✓ | ✓ | ✓ (4=4) | ✓ | ✓ | ✓ |
| ai-productivity-tools-roundup | 200 | ✓ | ✓ | ✓ | ✓ (3=3) | ✓ | ✓ | ✓ |
| how-to-write-better-ai-prompts | 200 | ✓ | ✓ | ✓ | ✓ (4=4) | ✓ | ✓ | ✓ |

**Landings (5, Plan 03 state intact):** all `/ai-writing`, `/ai-coding`, `/ai-image`, `/ai-productivity`, `/ai-guides` → 200, canonical self-ref, en-US+x-default self only, breadcrumb label === lib/silos label === H1, its post listed, "Browse all topics" up-link present.

**Homepage (Plan 03 state intact):** 200; hubs section `id="topics"` present and preceding the latest-posts list (hubs-on-top); all 5 landing links present; latest list still shows ≥5 blog links.

**Negative (T-02-02):** `/vpn-deals` → 404.

**Exit batteries at final HEAD:**
- `npm run build` → green (23 static pages, 5 posts + 5 landings SSG)
- `npx tsc --noEmit` → 0
- `npm run check:crawl` → "85 crawl checks passed"
- `npm run check:seeds` → "5 passed"
- Live sweep total: "91 sweep checks passed" (JSON in temp evidence dir; no stray listeners on 3200 after)

## Decisions Made

- **FAQJsonLd, not FAQPageJsonLd:** the plan text named a component that doesn't exist in next-seo v7; Plan 01 established (and runtime-proved) `FAQJsonLd` as the actual export — continuation of a documented Plan-01 deviation, not a new one.
- **SiloSlug prop:** related-posts' `silo: string` → `SiloSlug`. The content-collections enum guarantees every post's silo is a declared slug; narrowing makes `siloUrl()`/`getSilo()` misuse compile-time impossible while keeping the `{ currentSlug, silo }` shape the post page (and Phase 3 engine) already calls.
- **Related never-null:** D-11 says "empty-state link when no siblings" — implemented by always rendering the section; with 1 post per silo all five posts exercise the empty-state path today, and the sibling path activates automatically as the pipeline adds posts.
- **Silo resolution guard:** `getSilo(post.silo) || notFound()` — unreachable for enum-validated posts but fail-closed (T-02-02 posture), consistent with the landing route.

## Deviations from Plan

### Auto-fixed Issues

None in shipped code — plan executed as written. (Plan-text deltas folded into documented decisions: FAQJsonLd rename carried from Plan 01; the plan's "keep the `.replace(/</g,'\u003c')` sanitize pattern on any hand-serialized block" is moot — no hand-serialized JSON-LD blocks exist after wiring; sanitization lives in the Plan-01 builders' true-`<`-strip, which the sweep exercised.)

### Bookkeeping (docs-only, discovered at phase close)

- REQUIREMENTS.md showed SEO-01/SEO-04 still "Pending" although Plan 02-02 delivered and committed them (its executor never ran mark-complete). Marked Complete alongside this plan's four during phase close — a trade-file bookkeeping fix, no code impact.

---

**Total deviations:** 0 code deviations in shipped files; 1 docs-only bookkeeping fix (traceability table). No D-decision (D-01..D-16) altered; files stayed inside the plan's files_modified scope (lib/* untouched).

## Issues Encountered

- Windows PowerShell mangles inline `node -e` regexes — reused the temp-`*.cjs`-script pattern for every probe (all removed after; evidence JSON left in `%TEMP%\opencode-sweep` outside the repo).
- Three sweep-probe strictness failures fixed in the probe only (site output correct in every case): (a) `next-seo` emits flat `ListItem` shapes (`name`, `item`: URL-string) — schema.org-recommended, not `{item:{name,item}}`; (b) landing `<a>` tags serialize `class` before `href` — anchor regex needed attribute-order tolerance; (c) homepage latest-list anchors break the `<a\s*href>` pattern — same ordering cause. Also corrected the earlier FAQ-count probe to count H3s inside the FAQ section only (article H3s/Related titles are H3 too), and to expect the Phase-1 sitewide `@graph` (Organization+WebSite) JSON-LD block on every page.
- Server killed via netstat-PID taskkill; netstat confirms no listener on 3200.

## Threat Flags

None — no new trust-boundary surface beyond the plan's threat model. T-02-07 (schema/visible mismatch) disproven per post by sweep parity checks; T-02-03 (canonical reflection) unchanged — canonical derives from SITE_URL + enum-validated slug only, no query reflection; T-02-08 (link-graph dilution) preserved — strict same-silo related, silo-name anchors only, cross-silo strictly via homepage hubs (asserted live).

## Known Stubs

None — every post renders real builders' output from real frontmatter (parsed and asserted), Related links to live landings, no placeholder text anywhere in the two modified files.

## Self-Check: PASSED

- FOUND: app/blog/[slug]/page.tsx imports+renders ArticleJsonLd/BreadcrumbJsonLd/FAQJsonLd, silo Breadcrumb, localeAlternates; components/related-posts.tsx has "More in" + "See all" + siloUrl links
- FOUND: commits 95f59d7 (feat 02-04 task 1), a07ac5e (feat 02-04 task 2) in git log; no file deletions in either commit
- `npm run build` green at final HEAD content; `npx tsc --noEmit` exit 0; `check:crawl` 85 passed; `check:seeds` 5 passed; live sweep 91 passed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 is CLOSED: all 5 success criteria verified (this sweep re-proved SEO-01 split sitemaps/robots via check:crawl, SEO-04 noindex surface via check:crawl group 6, SEO-02/SEO-03/GEO-01/GEO-03 via the live matrix, SEO-05 via landings state)
- Phase 3 pipeline inherits the wired template: every new post automatically gets silo crumb + 3 JSON-LD blocks + alternates + auto-listing on its landing + hub counts — zero template edits needed
- Phase 4 schema-validity gates can consume the same lib/seo builders; the sweep's mirror-proof pattern is reusable for post-publish live verification (AUTO-02)
- No blockers

---

*Phase: 02-seo-architecture-silo-ia*
*Completed: 2026-10-17*
