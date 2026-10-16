---
phase: 01-site-foundation-trust
plan: 01
subsystem: infra
tags: [nextjs16, react19, tailwind4, content-collections, zod, mdx, plausible, seo-shell]

# Dependency graph
requires: []
provides:
  - Runnable Next.js 16.4.2 + React 19.3 scaffold with build-green baseline
  - Typed posts collection (zod frontmatter gate: title 50-60, description 150-160, slug regex, FAQ 3-5, tldr word-count)
  - Single-source site constants in lib/site.ts (brand, domain, publisher identity)
  - Editorial-light shell: header/footer/logo, homepage latest-posts index with spec'd empty state
  - Invisible ad-slot reservations (header 728x90 mounted, in-article 336x280 exported)
  - Edge/CDN posture as code (security headers, iad1 region) and docs/edge-cdn.md operator runbook
affects: [01-02 article template, 01-03 trust pages, 01-04 seeds and deploy, phase-2 SEO architecture]

# Tech tracking
tech-stack:
  added: [next@16.4.2, react@19.3.0, tailwindcss@4.3.3, typescript@5.9.3, @content-collections/core@0.15.3, @content-collections/mdx@0.2.2, @content-collections/next@0.2.11, zod@4.6.7, @tailwindcss/typography@0.5.20, next-seo@7.3.0, schema-dts@2.1.0, remark-gfm@4.0.1, rehype-slug@6.0.0, rehype-autolink-headings@7.1.0, rehype-pretty-code@0.14.5, shiki@4.5.0, @vercel/og@1.0.3]
  patterns: [App Router Server Components, static-first prerender, Content Collections zod gate, single-source SEO strings via lib/site.ts, invisible fixed-dimension ad reservations]

key-files:
  created: [content-collections.ts, lib/site.ts, lib/reading-time.ts, app/layout.tsx, app/page.tsx, app/globals.css, app/robots.ts, app/sitemap.ts, components/logo.tsx, components/site-header.tsx, components/site-footer.tsx, components/ad-slot.tsx, docs/edge-cdn.md, next.config.mjs, vercel.json, lighthouserc.cjs, public/favicon.svg]
  modified: [package.json, tsconfig.json, .gitignore]

key-decisions:
  - "defineConfig uses `content` key (core 0.15.3 deprecates `collections`)"
  - "readingMinutes computed in collection transform from post body via _meta.filePath"
  - "Footer year fixed at 2026 per UI-SPEC copy contract (prerender forbids current-time APIs)"
  - "Sitemap homepage lastmod tracks newest post with fixed fallback (deterministic builds)"

patterns-established:
  - "Single-source rule: brand/domain/publisher strings live only in lib/site.ts; all other files import"
  - "No webfonts: system font stack in globals.css, zero next/font imports (grep-gated)"
  - "Plausible snippet is the sole third-party script (T-01-02 accepted)"
  - "Invisible ad slots: aria-hidden fixed-dimension divs, zero ad-network strings (grep-gated)"

requirements-completed: [SITE-01, GEO-02]

# Metrics
duration: 32min
completed: 2026-10-16
---

# Phase 1 Plan 1: Site Foundation + Trust Scaffold Summary

**Next.js 16.4.2 edge-ready blog skeleton with zod-gated MDX collection, editorial-light shell, invisible ad reservations, and documented Cloudflare/Vercel posture — build and typecheck green**

## Performance

- **Duration:** ~32 min (2026-10-16T17:35Z → 2026-10-16T18:07Z; includes two slow-network npm runs)
- **Started:** 2026-10-16T17:35:00Z
- **Completed:** 2026-10-16T18:07:07Z
- **Tasks:** 2 of 2
- **Files modified:** 22 tracked (19 created, 3 modified)

## Accomplishments

- Greenfield scaffold: Next 16.4.2 + React 19.3.0 + Tailwind v4 + TypeScript strict, `npm run build` green with fully static routes (`/`, `/_not-found`, `/robots.txt`, `/sitemap.xml`), `npx tsc --noEmit` green
- Typed `posts` collection enforces the pipeline contract at build time (title 50–60 chars, description 150–160, slug regex, ISO datetimes, FAQ 3–5 `{q,a}`, non-empty `silo`, TL;DR ≤100 words via word-count refine) over `content/posts/*.mdx`
- Editorial-light shell per UI-SPEC: sticky header with nav, 3-column footer, inline-SVG logo (zero image requests), homepage latest-posts index sorted newest-first with verbatim empty state (`No posts yet` / `Fresh AI tool guides are on the way. Check back soon.`)
- CWV budget locked from the first commit: zero `next/font` imports, system font stack, Plausible `https://plausible.io/js/script.js` verified as the ONLY third-party script in prerendered HTML (all other scripts are first-party `/_next/static` chunks), zero font-CDN references
- Ad posture (D-11): `AdSlot` renders the exact invisible fixed-dimension contract (`data-ad-slot`, inline width/height/min styles, `mx-auto overflow-hidden`); header leaderboard `728×90` mounted desktop-only in layout; in-article `336×280` exported for the Plan 02 post template
- Edge posture (D-04/T-01-01): HSTS + nosniff + strict referrer + `X-Frame-Options: DENY` in `next.config.mjs`, AVIF/WebP image formats, Vercel region pinned to `iad1`, plus `docs/edge-cdn.md` operator runbook (DNS, priority-ordered cache rules, crawler-safety prohibitions, Googlebot-UA curl verification)

## Task Commits

Each task was committed atomically:

1. **Task 1: scaffold Next.js 16 + content layer + site shell** - `e030291` (feat)
2. **Task 2: reserve ad slots + edge/cache posture as code and docs** - `a90e03d` (feat)

**Plan metadata:** docs commit for this SUMMARY, stacked directly on the two task commits above (`git log` shows the exact hash)

## Files Created/Modified

- `package.json` - Next ^16.4.2 + content/SEO deps, `engines node >= 22`
- `package-lock.json` - Pinned install tree
- `tsconfig.json` - Strict + `@/*` and `content-collections` generated-types paths
- `next.config.mjs` - Scaffold Turbopack/cacheComponents defaults + security headers + AVIF/WebP + `withContentCollections`
- `vercel.json` - Region pinned `iad1` (US origin)
- `lighthouserc.cjs` - LHCI performance ≥0.9 gate placeholder Plan 04 extends
- `content-collections.ts` - `posts` collection + zod schema + MDX compile + reading-minutes transform
- `lib/site.ts` - SITE_NAME/TAGLINE/URL, AUTHOR_NAME/SLUG, CONTACT_EMAIL, LINKEDIN_URL, GITHUB_URL
- `lib/reading-time.ts` - `readingTime` (200 wpm, min 1) + `wordCount` helpers (UI-SPEC §9)
- `app/layout.tsx` - Metadata API (template `%s | ${SITE_NAME}`, metadataBase, canonical `/`), Plausible, Organization+WebSite JSON-LD (sanitized), skip link, header + ad reservation + footer shell
- `app/page.tsx` - Latest-posts index (H1 brand + tagline, cards with title link/excerpt/date·min-read, empty state)
- `app/globals.css` - Tailwind v4 + typography plugin, system stacks, focus-visible, reduced-motion
- `app/robots.ts` / `app/sitemap.ts` - Crawler files from single-source SITE_URL + collection (Phase-2-minimal)
- `components/logo.tsx` / `site-header.tsx` / `site-footer.tsx` - Brand lockup, sticky nav, footer band with author credit
- `components/ad-slot.tsx` - Invisible reservation component (exact API)
- `docs/edge-cdn.md` - Cloudflare + Vercel operator runbook with verification commands
- `content/posts/.gitkeep` - Collection directory placeholder
- `public/favicon.svg` - Flat indigo geometric mark
- `.gitignore` - Added `.content-collections/` generated dir

## Decisions Made

- `defineConfig({ content: [posts] })`: core 0.15.3 deprecates the `collections` key (build prints a deprecation warning otherwise); verified against installed `index.d.ts` before switching
- `readingMinutes` computed in the collection transform by reading the post file via `document._meta.filePath` (transform documents expose frontmatter + `_meta` only, no raw body) — gives true body-based minutes for the homepage meta row instead of a frontmatter-derived guess
- Footer year hardcoded `2026` exactly per UI-SPEC bottom-row copy; Next 16 prerender (cacheComponents) hard-fails on `new Date()` during static generation
- Sitemap homepage `lastModified` = newest post's date with fixed `2026-10-16` fallback — deterministic, prerender-safe; Phase 2 replaces with diff-gated logic
- `next.config.mjs` (not scaffold's `.ts`) per plan file list; preserved scaffold's Turbopack CSS rule + `cacheComponents`/`partialPrefetching` defaults inside it
- Scaffold leftovers removed: `app/favicon.ico` (would shadow the brand SVG via file-convention), 5 CNA illustration SVGs, boilerplate README, `next.config.ts` (replaced)
- Plausible `data-domain` derived from `SITE_URL` (`SITE_URL.replace(...)`) rather than a literal, keeping the T-01-03 single-source grep clean
- `package.json` uses `"next": "^16.4.2"` caret so the plan's literal `"next": "^16"` acceptance string is present while resolving to the scaffolded 16.x

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `new Date()` prerender failures in footer and sitemap**
- **Found during:** task 1 (first `npm run build`)
- **Issue:** Next 16 prerender aborts static generation on current-time APIs — `SiteFooter` year and sitemap homepage `lastModified` both called `new Date()`, failing the build on `/_not-found` prerender
- **Fix:** Footer year → literal `2026` (matches UI-SPEC verbatim copy); sitemap → newest-post date with fixed `2026-10-16T00:00:00.000Z` fallback
- **Files modified:** components/site-footer.tsx, app/sitemap.ts
- **Verification:** `npm run build` green, all 4 routes static
- **Committed in:** e030291 (task 1 commit)

**2. [Rule 3 - Blocking] `defineConfig` `collections` key deprecated in installed core 0.15.3**
- **Found during:** task 1 (first build printed `Please use "content" instead` deprecation)
- **Issue:** Plan-specified `collections` key is deprecated; future core release will break the build
- **Fix:** Switched to `defineConfig({ content: [posts] })` after verifying the signature in installed `index.d.ts`
- **Files modified:** content-collections.ts
- **Verification:** Deprecation warning gone, collection builds (0 documents, pre-seed)
- **Committed in:** e030291

**3. [Rule 2 - Missing critical] Added `content-collections` tsconfig paths mapping**
- **Found during:** task 1 (bare `content-collections` import has no runtime alias — the Next plugin only triggers generation)
- **Issue:** Without a mapping, `npx tsc --noEmit` cannot resolve `allPosts` imports (plan requires tsc green)
- **Fix:** Added `"content-collections": ["./.content-collections/generated"]` to tsconfig paths (generated at build, gitignored)
- **Files modified:** tsconfig.json
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** e030291

**4. [Rule 2 - Missing critical] Added `lib/reading-time.ts` helper**
- **Found during:** task 1 (UI-SPEC §3 card anatomy requires `{date} · {N} min read`, §9 mandates this module)
- **Issue:** Plan file list omits it, but the homepage meta row needs the 200-wpm budget function from a single source
- **Fix:** Created `readingTime` + `wordCount` per UI-SPEC §9; collection transform supplies true body-based `readingMinutes`
- **Files modified:** lib/reading-time.ts, content-collections.ts, app/page.tsx
- **Verification:** Build + tsc green; cards render minutes when posts exist
- **Committed in:** e030291

**5. [Rule 1 - Bug] Own comments tripped the grep gates**
- **Found during:** task 2 (gate verification)
- **Issue:** `ad-slot.tsx` header comment contained the words `script` and the ad-network names, failing the plan's own `contains NO script` / zero ad-network-string gates
- **Fix:** Reworded comment to `Emits no requests and shows nothing visible` (no gated tokens)
- **Files modified:** components/ad-slot.tsx
- **Verification:** Gates re-run: `script` count 0, ad-network count 0, `data-ad-slot` present
- **Committed in:** a90e03d (task 2 commit)

**6. [Rule 3 - Blocking] Scaffold routed via temp dir (planned fallback)**
- **Found during:** task 1 (`create-next-app` dir-non-empty guard — repo holds `.git`/`.planning`/`AGENTS.md`)
- **Issue:** Direct scaffold into repo root blocked, exactly as the plan anticipated
- **Fix:** Used the plan's specified fallback: scaffolded to `D:\myapps\blogs-scaffold-tmp`, moved `app/`, `public/`, configs into the repo (temp dir removed afterwards)
- **Files modified:** all scaffold files
- **Verification:** Scaffold versions recorded below; install completed in final location
- **Committed in:** e030291

---

**Total deviations:** 6 auto-fixed (2 bug, 2 blocking, 2 missing-critical)
**Impact on plan:** All fixes required for build-green acceptance or UI-SPEC contract compliance. No scope creep — no features beyond the plan's must-haves.

## Issues Encountered

- `create-next-app@16.4.2` run exceeded the 7-minute tool timeout but had completed the file scaffold (install finished separately in the repo) — used the plan's temp-dir fallback; no work lost
- `withContentCollections` in v0.2.11 returns `Promise<Partial<NextConfig>>` — used exactly as documented (`export default withContentCollections(nextConfig)`); Next 16 accepts it, build log shows `Running next.config.mjs` + `Starting content-collections` as expected
- PowerShell environment: no `&&` chaining, no `ls -la`, `Get-Date -AsUTC` unavailable — used `;` separators and .NET UTC clock; cosmetic only
- 19 npm vulnerabilities reported (11 moderate, 8 high) in the fresh tree — left as-is; dependency audit belongs to a hardening pass, not this scaffold plan

## Version Record (exact pins at scaffold)

next 16.4.2 · react/react-dom 19.3.0 · tailwindcss 4.3.3 · typescript 5.9.3 · @content-collections/core 0.15.3 · @content-collections/mdx 0.2.2 · @content-collections/next 0.2.11 · zod 4.6.7 · @tailwindcss/typography 0.5.20 · next-seo 7.3.0 · schema-dts 2.1.0 · remark-gfm 4.0.1 · rehype-slug 6.0.0 · rehype-autolink-headings 7.1.0 · rehype-pretty-code 0.14.5 · shiki 4.5.0 · @vercel/og 1.0.3 · Node 24.12.0 local (engines require >= 22)

## Verification Outputs (final HEAD)

- `npm run build` → exit 0: `Compiled successfully`, `Finished TypeScript`, static routes `/`, `/_not-found`, `/robots.txt`, `/sitemap.xml` — all `(Static) prerendered as static content`
- `npx tsc --noEmit` → exit 0, no output
- `next/font` gate (`app/ components/ lib/`): **0** matches
- Ad-network gate (`googlesyndication|adsbygoogle|doubleclick` in `app/ components/`): **0** matches
- `script` in `components/ad-slot.tsx`: **0** matches; `data-ad-slot` present
- Brand/domain literals outside `lib/site.ts` (`app/ components/ lib/`): **none** (only `lib/site.ts` lines 5/7)
- Prerendered homepage HTML: `lang="en-US"`, zero `fonts.googleapis|gstatic|@font-face|next/font` references, empty-state copy present, `application/ld+json` block present, sole third-party script `https://plausible.io/js/script.js` (remainder are first-party `/_next/static` chunks)
- `docs/edge-cdn.md`: contains `bypass`, `/_next/static`, `Googlebot` (7 matching lines)

## Brand Alternatives for Owner Approval (D-01 — SUMMARY ONLY, not in code)

Implemented default: **AI Tool Digest** (`Practical AI tool guides for busy builders`). Alternatives:

1. **The AI Toolkit** — shorter, tool-roundup connotation; weaker "guide/review" signal than Digest
2. **Best AI Tools Guide** — exact-match keyword phrasing (high Tier-1 query overlap); blander brand, harder to trademark-shape
3. **Everyday AI Tools** — broadest-appeal, beginner-friendly; less authority signal for comparison/review intent

Recommendation: keep **AI Tool Digest** — descriptive, digest-format promise (fits daily publishing), distinctive enough to brand.

## Known Stubs

None that block this plan's goal. Notes for downstream plans:

- Homepage renders the spec'd empty state until Plan 04 lands 5 seed posts (intentional pre-seed state, not a stub)
- In-article `<AdSlot id="in-article" width={336} height={280}/>` is exported but not yet mounted — Plan 02 mounts it after the 2nd H2 in the post template
- Header/footer link `/about`, `/editorial-process`, `/contact`, `/privacy`, `/terms`, `/authors/musfiqur-rahman-saimon` — routes arrive in Plan 03 (links 404 until then; build is unaffected)
- `lighthouserc.cjs` asserts homepage performance only — Plan 04 extends to the post template + CI workflow

## Threat Flags

None — no new security surface beyond the plan's threat model: no new endpoints, no auth paths, no schema changes at trust boundaries. T-01-01 mitigated (headers in `next.config.mjs`, cache rules documented), T-01-02 accepted (single deferred Plausible script, verified sole third-party), T-01-03 mitigated (single-source grep clean).

## User Setup Required

None - no external service configuration required. (Live DNS/Cloudflare application is explicitly a Plan 04 activity with operator credentials; this plan delivers docs + in-repo config only.)

## Next Phase Readiness

- Ready for Wave 2: Plan 02 (article template + MDX system + OG images) can import `AdSlot`, `lib/site.ts`, and the `posts` collection immediately; Plan 03 (trust pages) fills the six linked routes
- No blockers. Watch item for Plan 04: run `npm audit` review and the post-deploy Googlebot-UA curl suite from `docs/edge-cdn.md §4`

---
*Phase: 01-site-foundation-trust*
*Completed: 2026-10-16*

## Self-Check: PASSED

- All 19 created + 3 modified files verified present on disk
- Commits `e030291` (task 1) and `a90e03d` (task 2) verified in `git log`
- No unintended deletions in either task commit (`git diff --diff-filter=D` clean)
- Final HEAD rebuild + `tsc --noEmit` green after all commits
