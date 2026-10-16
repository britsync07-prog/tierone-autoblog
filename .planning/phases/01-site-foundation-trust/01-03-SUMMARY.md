---
phase: 01-site-foundation-trust
plan: 03
subsystem: trust
tags: [eeat, trust-pages, author-identity, ai-disclosure, privacy, nextjs16]

# Dependency graph
requires: [01-01 site scaffold, lib/site.ts constants, header/footer trust links]
provides:
  - Six static trust routes (author, about, editorial-process, contact, privacy, terms)
  - Shared AuthorCard with real-photo-or-monogram fallback via build-time check
  - Per-post-linkable AI disclosure target (/editorial-process with exact H2s)
affects: [01-02 article template (byline/AiBadge link targets now resolve), 01-04 seeds and deploy, phase-2 SEO architecture]

# Tech tracking
tech-stack:
  added: []
  patterns: [App Router Server Components, zero client JS on trust routes, Metadata API title/description/canonical per page, sanitized Person JSON-LD, build-time fs existence check]

key-files:
  created: [lib/author-photo.ts, components/author-card.tsx, app/authors/musfiqur-rahman-saimon/page.tsx, app/about/page.tsx, app/editorial-process/page.tsx, app/contact/page.tsx, app/privacy/page.tsx, app/terms/page.tsx]
  modified: []

key-decisions:
  - "No public/images/author.jpg committed: no owner-supplied headshot exists, and generating orvendoring a stand-in portrait would violate T-03-01; the MS monogram is the live path until the owner drops the real file"
  - "Author-page outbound URLs as literals (not constant references) because the plan's grep acceptance gates require the literal strings in page source"
  - "Author metadata title via layout template (title `About AUTHOR_NAME`) so rendered <title> is exactly the UI-SPEC contract string"
  - "Minimal Person JSON-LD with sameAs on the author page: machine-readable identity for the EEAT trust anchor"

patterns-established:
  - "Trust pages: single column max-w-[65ch], H1 30px semibold, 16px/1.5 body, accent underline links, no client components"
  - "Legal pages end with the exact counsel-deferral sentence (D-15)"

requirements-completed: [SITE-03]

# Metrics
duration: 35min
completed: 2026-10-17
---

# Phase 1 Plan 3: Trust Floor Summary

**Real-entity author page with photo-or-monogram and verifiable profile links, separate About and editorial-process pages with AI disclosure, email-only Contact, and honestly-scoped Privacy/Terms — build and typecheck green, all six routes static**

## Performance

- **Duration:** ~35 min (2026-10-16T18:15Z → 2026-10-16T18:50Z approx; includes two waits on a parallel Plan 02 build lock)
- **Tasks:** 2 of 2
- **Files modified:** 8 created, 0 modified

## Accomplishments

- Author identity (D-12, D-17): `/authors/musfiqur-rahman-saimon` carries every verbatim CONTEXT fact — role line, focus line, philosophy quote, current-building line, factual location line — plus `rel="me noopener"` LinkedIn/GitHub links and a minimal Person JSON-LD block with `sameAs` tying the page to the real profiles
- Photo-or-monogram: `lib/author-photo.ts` (`AUTHOR_PHOTO_EXISTS` via build-time `fs.existsSync`) drives `AuthorCard`; with no owner headshot on disk the rendered page shows the spec'd `MS` monogram (`#4f46e5`, white, 200×200, rounded-full), verified in prerendered HTML with zero `/images/author.jpg` reference
- About + editorial-process are separate pages (D-14): About covers what/who/how/contact-pointer; process page carries the four EXACT H2s (`How articles are produced` / `AI assistance disclosure` / `Sourcing and verification standards` / `What we don't publish`) with AI-assisted-drafts accountability, sourced-and-dated stats, cut-unverifiable-claims, and no-fabricated-authors statements
- Contact (D-13): H1 `Contact`, one paragraph, single `mailto:` link displaying exactly `saimon@ascentraconsulting.co.uk`, response line `Replies within a few business days.` — zero `<form>`, inputs, `useState`, or API routes anywhere in the new files
- Privacy/Terms (D-15): clean-room pages in site voice matching the actual posture (no accounts/content/forms, cookie-less Plausible analytics, no advertising cookies, email data-request channel; informational guides not professional advice, AI-assistance pointer to `/editorial-process`, no warranty, outbound-link disclaimer), both ending with the EXACT counsel sentence `Last reviewed October 2026; formal counsel review deferred until revenue justifies it.`
- Rendered `<title>` verified byte-exact: `About Musfiqur Rahman Saimon | AI Tool Digest`

## Task Commits

Each task was committed atomically:

1. **Task 1: author page + about + editorial process with AI disclosure** - `907b157` (feat)
2. **Task 2: contact (email-link only) + privacy/terms adapted now** - `6620797` (feat)

**Plan metadata:** docs commit for this SUMMARY, stacked directly on the two task commits above (`git log` shows the exact hash)

## Files Created/Modified

- `lib/author-photo.ts` - `AUTHOR_PHOTO_EXISTS` build-time headshot existence check (D-17)
- `components/author-card.tsx` - `<AuthorCard showPhoto>` — `next/image` 200×200 photo or `MS` monogram + name + role + `rel="me noopener"` profile links (constants-imported)
- `app/authors/musfiqur-rahman-saimon/page.tsx` - Real-entity author page: H1 name, bio facts verbatim, literal profile URLs, Person `sameAs` JSON-LD, canonical
- `app/about/page.tsx` - What the site is (imports `SITE_TAGLINE`), who publishes (author-page link), how content is made (`/editorial-process` link), `mailto:` contact pointer
- `app/editorial-process/page.tsx` - Four exact H2s, AI disclosure with both `AI assistance` and `AI-assistance` forms, sourcing standards, what-we-don't-publish
- `app/contact/page.tsx` - H1 `Contact`, literal email display + `mailto:` href, response-expectation line, no form surface
- `app/privacy/page.tsx` - Cookie-less posture: no accounts/content/forms, Plausible (cookie-less, no personal data, no consent banner), no ad cookies, email data-request channel, exact counsel footer
- `app/terms/page.tsx` - Informational-guides-not-advice, `/editorial-process` AI pointer, no warranty, outbound-link disclaimer, exact counsel footer

## Decisions Made

- No `public/images/author.jpg` committed: no owner-supplied headshot exists, and generating, downloading, or vendoring any stand-in portrait would violate threat T-03-01. The monogram fallback is therefore the live rendering path (verified in prerendered HTML), and the owner step is documented in code comments. `fs.existsSync` flips to the photo automatically on the first build after the real file lands.
- Author-page profile URLs written as literals rather than `LINKEDIN_URL`/`GITHUB_URL` references: the plan's acceptance gates grep page source for the literal strings (`musfiqur-rahman-saimon-a5994b3aa`, `github.com/britsync07-prog`). The key-link pattern is still satisfied via `AUTHOR_NAME`/`SITE_*` imports, and the shared `AuthorCard` keeps the single-source pattern for the reusable component. Same reasoning for the literal email on the contact page.
- Author metadata title set as `` `About ${AUTHOR_NAME}` `` (not the full string): the root layout template appends `| AI Tool Digest`, so the rendered `<title>` resolves to exactly the UI-SPEC contract string — verified byte-exact in prerendered HTML.
- Minimal Person JSON-LD (`name`, `url`, `jobTitle`, `homeLocation`, `sameAs`) added on the author page beyond the plan file list: the author page is the EEAT trust anchor and `sameAs` is the standard machine-readable identity binding. Sanitized with the layout's `.replace(/</g, '\u003c')` pattern. Small Rule-2-grade addition, documented here.
- `sitemap.ts` left untouched: UI-SPEC §8 foresees trust pages in the sitemap, but sitemap extension belongs to Phase 2 SEO architecture; adding URLs now would touch Plan 01's file for no acceptance benefit. Flagged for Phase 2 / Plan 04.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. Two environment incidents were routed around without code changes (see Issues Encountered); the one content addition (Person JSON-LD) is recorded above as a decision, not a deviation.

## Issues Encountered

- **Parallel-executor build lock:** first task-2 `npm run build` failed with "Another next build process is already running" — the Plan 02 (wave 2) executor was building in the same tree. Waited 90s and retried; no action taken on shared state.
- **Parallel-executor broken file broke my verification build:** second attempt failed on `app/blog/[slug]/page.tsx` (`export const dynamic` incompatible with `cacheComponents`) — Plan 02's uncommitted in-progress file, not mine. Per scope boundary (out-of-scope files belong to another agent's active task) I did not touch it; ran `tsc --noEmit` (green) plus all grep gates meanwhile, waited ~2 min for the Plan 02 agent to fix their file, then rebuilt green. No workaround edits, no stash, no interference with their files.
- **Write-tool escape mangling:** the `\u003c` JSON-LD sanitize sequence was decoded mid-write into stray characters (two bad edits). Rewrote the file with a placeholder and patched the exact 6-char escape via Python char codes; verified with `repr()` that file bytes match `layout.tsx`'s pattern. Cosmetic tooling issue only; final file correct.
- **Over-broad stub grep hit `node_modules`:** an unrestricted `grep -rn` descended into `node_modules` and timed out. Re-ran scoped to the 8 plan files only: zero matches. Lesson applied inline.

## Verification Outputs (final HEAD)

- `npm run build` → exit 0: `Compiled successfully`, `Finished TypeScript`, all routes static — `/about`, `/authors/musfiqur-rahman-saimon`, `/contact`, `/editorial-process`, `/privacy`, `/terms` all `(Static) prerendered as static content`
- `npx tsc --noEmit` → exit 0, no output
- Author gates: `musfiqur-rahman-saimon-a5994b3aa` ×2, `github.com/britsync07-prog` ×2, `Bangladesh` ×3 in author page source
- Editorial gates: `AI assistance` ×4 (incl. exact H2), `AI-assistance` ×1 in process page source
- Fabricated-identity gate (`AI-generated portrait|AI avatar|generated headshot|pravatar|dicebear|unsplash.*portrait` over `app/authors/`, `author-card.tsx`, `author-photo.ts`): **0** matches
- Contact gates: email literal ×2 (display + `mailto:` href), `<form` ×0, `useState|<input|<textarea|<button` ×0 across all 8 files
- Counsel gates: `counsel review deferred` ×1 in each of privacy/terms source; exact full sentence verified in prerendered `privacy.html` + `terms.html`
- `Plausible` ×1 in privacy source; `/editorial-process` ×1 in terms source
- Rendered-HTML spot checks (`.next/server/app/*.html`): `<title>About Musfiqur Rahman Saimon | AI Tool Digest</title>` exact; monogram present (`Initials monogram…`, `>MS</div>`), zero `/images/author.jpg` reference; contact page has `mailto:` link and no `<form`; process page has `AI assistance disclosure` H2
- Stub scan (scoped to the 8 files): zero `TODO|FIXME|placeholder|coming soon|not available` matches

## Known Stubs

None. Notes for downstream plans:

- `public/images/author.jpg` is intentionally absent — the monogram renders until the owner supplies the real headshot (D-17). Not a stub: the fallback is the spec'd behavior.
- Trust-page URLs are not yet in `app/sitemap.ts` (Phase-1-minimal lists homepage + posts). Phase 2 extends the sitemap; no action needed in Plan 04 unless it wants the one-line addition.
- `<AuthorCard showPhoto />` is currently consumed only by the author page; it is the shared card for future post-footprint/byline use (Plan 02's `Byline` links to the author route, which now resolves).

## Threat Flags

None beyond the plan's threat model — no new endpoints, auth paths, or schema changes at trust boundaries:

- T-03-01 (fabricated identity) mitigated: verbatim CONTEXT facts only, real-links-only with `rel="me noopener"`, monogram instead of any generated face, zero banned-string matches.
- T-03-02 (contact abuse surface) mitigated by construction: no form/backend, `mailto:` only, verified zero form elements.
- T-03-03 (legal over-claim) accepted per D-15: clean-room pages with no generator brand/license text and the explicit counsel-deferral sentence on both pages.

## User Setup Required

- **Owner headshot (non-blocking):** drop the real headshot at `public/images/author.jpg` (square, ≥400px) to replace the `MS` monogram — no code change needed; next build picks it up automatically. No AI-generated or stock substitutes, ever.

## Next Phase Readiness

- Ready for Plan 04 (seeds + deploy): all footer/header trust links (`/about`, `/editorial-process`, `/contact`, `/privacy`, `/terms`, `/authors/musfiqur-rahman-saimon`) now resolve; Plan 02's byline (`/authors/musfiqur-rahman-saimon`) and AI badge (`/editorial-process`) targets exist
- No blockers. Watch item: coordinate with the parallel Plan 02 executor before Plan 04's final build — both plans share `next.config.mjs`/`package.json` territory (their agent modified both during this window)

---

*Phase: 01-site-foundation-trust*
*Completed: 2026-10-17*

## Self-Check: PASSED

- All 8 created files verified present on disk
- Commits `907b157` (task 1) and `6620797` (task 2) verified in `git log`
- No unintended deletions in either task commit (create-only: 355 + 196 insertions, 0 deletions)
- Final HEAD `npm run build` + `npx tsc --noEmit` green after all commits
