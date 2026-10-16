---
phase: 02-seo-architecture-silo-ia
plan: 01
subsystem: seo
tags: [next-seo, schema-org, json-ld, canonical, hreflang, content-collections, zod-enum, silo-taxonomy]

# Dependency graph
requires:
  - phase: 01-site-foundation-trust
    provides: [flat /blog/{slug} URLs, lib/site.ts single-source constants, 5 seed posts with silo frontmatter, self-referencing canonical in generateMetadata]
provides:
  - SILO_SLUGS / SILOS / getSilo / siloUrl single-source taxonomy (lib/silos.ts)
  - canonicalFor() + localeAlternates() en-US/x-default derivation (lib/seo/canonical.ts)
  - buildArticleJsonLd / buildBreadcrumbJsonLd / buildFaqJsonLd next-seo-v7-spreadable builders (lib/seo/jsonld.ts)
  - Build-fail silo enum gate in content-collections.ts (undeclared silo fails loudly)
affects: [02-02 sitemaps/robots (silo inventory source), 02-03 silo landings + homepage hubs, 02-04 post-page SEO wiring, Phase 3 pipeline (valid silo values)]

# Tech tracking
tech-stack:
  added: []
  patterns: [single-source SEO contracts (lib/silos.ts + lib/seo/ builders), zod enum build-fail gate, per-field `<`-strip sanitization before JSON-LD, Extract-before-Omit for next-seo union prop types]

key-files:
  created: [lib/silos.ts, lib/seo/canonical.ts, lib/seo/jsonld.ts]
  modified: [content-collections.ts]

key-decisions:
  - "Builders typed against installed next-seo v7 prop types (not raw schema-dts unions) so returns are directly spreadable into components"
  - "T-02-01 implemented as true `<`-stripping, not the plan's single-escaped '\\u003c' (runtime no-op)"
  - "inLanguage omitted from Article props (not a next-seo v7 ArticleBase field); language conveyed via html lang + hreflang alternates"
  - "FAQ component is FAQJsonLd (actual v7 export), not FAQPageJsonLd"

patterns-established:
  - "SEO strings single-source: routes import from lib/silos.ts and lib/seo/, never re-derive"
  - "Structured-data hygiene: FAQPage props return null when no visible FAQs exist"
  - "Domain literal lives only in lib/site.ts (grep gate)"

requirements-completed: [SEO-02, SEO-03, GEO-01, GEO-03]

# Metrics
duration: 45min
completed: 2026-10-17
---

# Phase 02 Plan 01: SEO Contracts Summary

**Single-source silo taxonomy, canonical/hreflang derivation, and next-seo v7-spreadable JSON-LD builders with a build-fail silo enum gate**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-10-17T01:30Z (approx)
- **Completed:** 2026-10-17T02:15Z (approx)
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `lib/silos.ts`: five locked silos (ai-writing, ai-coding, ai-image, ai-productivity, ai-guides) with display labels, landing titles, 150–160-char meta descriptions, and unique 120–160-word intros (zero duplicated sentences) plus `getSilo()` / `siloUrl()` (`/{silo}` root shape)
- `content-collections.ts`: `silo: z.string()` tightened to `z.enum(SILO_SLUGS)` — a post with silo `vpn-deals` fails the build loudly (negative check performed, fixture removed)
- `lib/seo/canonical.ts`: `canonicalFor(path)` from `SITE_URL` (no domain literal) + `localeAlternates()` returning canonical with `en-US` + `x-default` self-ref (single-locale GEO-03)
- `lib/seo/jsonld.ts`: `buildArticleJsonLd` (BlogPosting headline/description/dates/author Person + author-page URL/publisher Organization/OG image/mainEntityOfPage), `buildBreadcrumbJsonLd` (trail-order crumbs, 1-based positions via next-seo processor), `buildFaqJsonLd` (null on empty FAQ — phantom-schema hygiene), all `<`-stripped per T-02-01
- Runtime proof: temp route rendered real `<ArticleJsonLd type="BlogPosting">`, `<BreadcrumbJsonLd>`, `<FAQJsonLd>` and prerendered HTML contained valid BlogPosting/BreadcrumbList/FAQPage blocks with absolute URLs (route deleted afterwards)
- `npm run build` green with 5 documents, `npx tsc --noEmit` clean, domain grep matches only `lib/site.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: silo taxonomy module plus schema enum** - `60ff7ce` (feat)
2. **Task 2: canonical/hreflang plus JSON-LD builder modules** - `7cf1531` (feat)

## Files Created/Modified

- `lib/silos.ts` - SILO_SLUGS tuple, SILOS record, getSilo(), siloUrl()
- `content-collections.ts` - silo schema tightened to z.enum(SILO_SLUGS)
- `lib/seo/canonical.ts` - canonicalFor() + localeAlternates()
- `lib/seo/jsonld.ts` - buildArticleJsonLd(), buildBreadcrumbJsonLd(), buildFaqJsonLd()

## Decisions Made

- Builders typed against installed next-seo v7 prop types (verified in `node_modules/next-seo/dist/index.d.ts`) rather than raw schema-dts imports: schema-dts `Person`/`Organization` broad unions are not assignable to the component props, which would break the plan's hard "directly spreadable" requirement. next-seo v7's bundled vocabulary is the schema-dts-derived surface versioned with the renderer.
- `inLanguage` omitted from Article props: not a field on next-seo v7 `ArticleBase`; adding it would break spreadability. Language is conveyed via `<html lang="en-US">` + hreflang alternates (GEO-03 single-locale).
- FAQ builder targets `FAQJsonLd` (the actual v7 export) rather than the plan-named `FAQPageJsonLd`, which does not exist in next-seo v7.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] True `<`-stripping instead of plan's single-escaped `'\u003c'`**
- **Found during:** task 2 (JSON-LD builder sanitization)
- **Issue:** The plan's literal `.replace(/</g, '\u003c')` is a runtime no-op — `'\u003c'` evaluates to `<` itself. The double-escaped variant (`'\\u003c'`) only works on serialized JSON strings; applied per-field before `JSON.stringify` it would corrupt parsed values (`\u003c` literal text in Google's parsed FAQ/Article). Either way the T-02-01 injection mitigation would silently not hold.
- **Fix:** `clean()` strips `<` entirely (`.replace(/</g, '')`), matching the threat register's verbatim mitigation ("Strip `<` in all builders").
- **Files modified:** lib/seo/jsonld.ts
- **Verification:** tsc clean; smoke HTML shows intact prose (no `<` present in seed copy, no corruption possible)
- **Committed in:** 7cf1531 (task 2 commit)

**2. [Rule 1 - Bug] Extract-before-Omit for BreadcrumbJsonLdProps union**
- **Found during:** task 2 (runtime smoke route typecheck)
- **Issue:** `BreadcrumbJsonLdProps` is a union (`{items} | {multipleTrails}`); `Omit` over a union collapses to `{}`, so the builder return type lost `.items` and `<BreadcrumbJsonLd {...props} />` failed typecheck. Build caught it only because the smoke route exercised the spread.
- **Fix:** `Extract<BreadcrumbJsonLdProps, { items: unknown }>` before `Omit` — single-trail variant preserved, still spreadable.
- **Files modified:** lib/seo/jsonld.ts
- **Verification:** `npm run build` green with smoke route spreading all three builders into real next-seo components; prerendered HTML contained all three JSON-LD blocks
- **Committed in:** 7cf1531 (task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 correctness/security, 0 scope creep)
**Impact on plan:** Both fixes required for the plan's own contracts (T-02-01 mitigation actually working; "directly spreadable" actually typechecking). No D-01..D-08 decision altered; no scope added.

## Issues Encountered

- PowerShell quoting mangled inline `node -e` scripts with regexes — switched to temp `.cjs` script files (deleted afterwards). No impact on deliverables.
- Temp smoke route (`app/tmp-smoke`) and temp fixtures/scripts created during verification were all removed; final tree contains only the four contract files.

## Threat Flags

None — all new surface (JSON-LD emission, canonical derivation, silo enum) was already covered by the plan's threat model (T-02-01 mitigated via true-strip + FAQ-only-when-visible; T-02-02 mitigated via enum + negative check).

## Known Stubs

None — builders are fully wired against the real `Post` type and real seed data (proven by prerendered JSON-LD output). No page wiring was in scope (Plans 02-03/02-04 consume these contracts).

## Self-Check: PASSED

- FOUND: lib/silos.ts, lib/seo/canonical.ts, lib/seo/jsonld.ts, content-collections.ts (enum import)
- FOUND: commits 60ff7ce, 7cf1531 in git log
- `npm run build` exits 0 with 5 documents; `npx tsc --noEmit` clean; domain grep isolated to lib/site.ts

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 02-02/02-03/02-04 can `import { SILOS } from '@/lib/silos'` and `import { canonicalFor } from '@/lib/seo/canonical'` with zero SEO-string duplication
- 02-03 landings: silo inventory + intro/meta copy ready; `siloUrl()` gives landing paths; `generateStaticParams` can map over `SILO_SLUGS`
- 02-04 post wiring: `<ArticleJsonLd type="BlogPosting" {...buildArticleJsonLd(post, canonical)} />` pattern proven; silo crumb label via `getSilo(post.silo)?.label`; `localeAlternates()` spreads into `generateMetadata`
- No blockers

---
*Phase: 02-seo-architecture-silo-ia*
*Completed: 2026-10-17*
