---
phase: 01-site-foundation-trust
plan: 04
subsystem: content-seeds
tags: [seed-posts, conformance-gate, lhci, deploy-verification, GEO-02, nextjs16]

# Dependency graph
requires: [01-01 scaffold + edge-cache posture, 01-02 article template + OG images, 01-03 trust pages]
provides:
  - 5 template-conformant AI-tools seed posts at flat /blog/{slug} (Phase 3 pipeline reference fixtures)
  - scripts/check-seeds.mjs conformance gate + npm run check:seeds (template-conformance CI)
  - .github/workflows/lhci.yml Lighthouse gate (homepage + post template, performance >= 0.9)
  - docs/deploy-verify.md runbook with real evidence + honest PENDING-DNS production rows
affects: [phase-2 SEO architecture (sitemap/JSON-LD read same frontmatter), phase-3 pipeline (seeds are D-20 reference fixtures), phase-4 QA gates]

# Tech tracking
tech-stack:
  added: []
  patterns: [zero-dep node conformance script, LHCI autorun with startServer, real-output-only deploy evidence with PENDING markers]

key-files:
  created: [content/posts/seed-01-best-ai-writing-assistants-2026.mdx, content/posts/seed-02-chatgpt-vs-claude-coding.mdx, content/posts/seed-03-best-free-ai-image-generators.mdx, content/posts/seed-04-ai-productivity-tools-roundup.mdx, content/posts/seed-05-how-to-write-better-ai-prompts.mdx, scripts/check-seeds.mjs, .github/workflows/lhci.yml, docs/deploy-verify.md]
  modified: [package.json, lighthouserc.cjs]

key-decisions:
  - "ISO full datetimes in frontmatter (not plan's date-only form) because the zod schema requires datetime and date-only fails the build"
  - "Body carries a bold TL;DR lead sentence, not a second <Tldr> component, since the template already renders the frontmatter tldr box"
  - "lighthouserc.cjs extended with the seed-post URL + startServer so lhci autorun actually covers the post template per the task contract"
  - "Production rows marked PENDING DNS with verbatim 404 outputs; local production-build evidence pasted for app behavior — nothing fabricated"

patterns-established:
  - "Seed posts: fresh original prose, per-post Sources H2 with real vendor/docs URLs, pricing described as shapes with verify-on-vendor-page hedging"
  - "check-seeds.mjs: fileURLToPath-based paths (Windows-safe), quote-tolerant scalar parse, faq counted via `- q:` items"

requirements-completed: [SITE-01, SITE-02, SITE-04, GEO-02]

# Metrics
duration: 60min
completed: 2026-10-17
---

# Phase 1 Plan 4: Seed Posts + Gates + Deploy Verification Summary

**Five original AI-tools seed posts live as SSG routes at flat /blog/{slug}, guarded by a zero-dep conformance gate and an LHCI CI workflow, with deployment verified by real curl evidence and honest PENDING-DNS production rows**

## Performance

- **Duration:** ~60 min (2026-10-16T18:00Z → 19:00Z approx)
- **Tasks:** 2 of 2
- **Files modified:** 8 created, 2 modified

## Accomplishments

- 5 original seed posts (AI writing assistants, ChatGPT-vs-Claude coding, free image generators, productivity roundup, prompting guide) at the EXACT required slugs, each with validated frontmatter (title 50–60, description 150–160, ISO datetimes, 3–5 genuine FAQs, silo tag), TL;DR ≤100 words, ≥3 H2s with H3s, comparison table, list, natural code fence, bold takeaway per H2, one `<Callout>`, conclusion + `/about` CTA, and a Sources H2 with 2–3 real vendor/docs URLs
- `scripts/check-seeds.mjs` (zero deps) + `npm run check:seeds`: prints `5 passed`, exit 0; asserts title/description lengths, slug regex + filename agreement, required fields, parseable datetimes, tldr ≤100 words, faq 3–5, H2/table/fence/Sources//about presence, banned-phrase scan
- Build green with all 5 documents: `/blog/{slug}` SSG routes prerendered, homepage + trust pages static; live render verified TL;DR aside, desktop/mobile TOC, static FAQ, byline (`Oct 16, 2026 · 6 min read`), AI badge, breadcrumb, canonical, per-post `og:image` (1200×630, `200 image/png`), in-article ad slot, heading anchors
- `.github/workflows/lhci.yml`: PR + push-to-main, `node 22`, `npm ci` → `check:seeds` → `build`, then `lhci autorun` (performance ≥ 0.9); `lighthouserc.cjs` extended to collect `/` + the seed-post URL with `startServerCommand`
- `docs/deploy-verify.md`: Vercel + Cloudflare owner steps, real local-build evidence (homepage `200` + `strict-transport-security`, seed URL `200` as `Googlebot/2.1` with no `x-robots-tag: noindex`, sitemap/robots `200`, OG tags verbatim), and real production `404`s marked PENDING DNS — zero fabricated output

## Task Commits

Each task was committed atomically:

1. **Task 1: 5 template-conformant seed posts + conformance gate** - `07a2307` (feat, 7 files)
2. **Task 2: LHCI gate + deployment verification** - `d85898e` (feat, 3 files)

**Plan metadata:** docs commit for this SUMMARY, stacked directly on the two task commits above (`git log` shows the exact hashes)

## Files Created/Modified

- `content/posts/seed-0{1..5}-*.mdx` - 5 original seed posts (frontmatter-validated, template-conformant bodies)
- `scripts/check-seeds.mjs` - Zero-dep conformance gate (lengths, counts, structure, banned phrases; Windows-safe paths)
- `package.json` - Added `check:seeds` script (consumed by CI workflow)
- `.github/workflows/lhci.yml` - LHCI gate: build job (check:seeds + build) then `lhci autorun`
- `lighthouserc.cjs` - Collect homepage + seed-post URL, `startServerCommand: npm start` (was homepage-only)
- `docs/deploy-verify.md` - Vercel/DNS owner runbook + real evidence (local 200s, production 404s marked pending)

## Decisions Made

- ISO full datetimes (`2026-10-16T00:00:00.000Z`) instead of the plan's date-only `publishedAt: '2026-10-16'`: the collection schema is `z.string().datetime()` and date-only strings fail the build loudly. Correctness over plan letter; recorded as deviation 1.
- Body TL;DR is a bold lead sentence, not a `<Tldr>` component instance: the Plan 02 template already renders `<Tldr items={[post.tldr]} />` from frontmatter, so a component in the body would render two boxes. The lead sentence satisfies the artifact `contains: TL;DR` gate and reads as a bottom-line verdict.
- Extended `lighthouserc.cjs` (seed URL + startServer): Plan 01 explicitly deferred per-post LHCI assertions to Plan 04, and task 2 requires autorun against homepage + seed URL — impossible with the old single-URL, no-server config. Recorded as deviation 2 (in-scope, plan-anticipated).
- FAQ answers/C TA copy use qualitative pricing ("ten to twenty dollar range", "confirm current prices on the vendor page") rather than specific prices: prices change often and invented numbers would be misinformation. Sources sections name real vendor/docs pages the claims were checked against.
- Production evidence strategy: domain resolves to Cloudflare but returns `404` everywhere (no Vercel project yet — the owner's `user_setup` step). Pasted the real 404s and marked rows PENDING DNS instead of substituting local output as production evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Date-only `publishedAt` fails the zod datetime gate**
- **Found during:** task 1 (schema review before writing)
- **Issue:** Plan specifies `publishedAt: '2026-10-16'`, but `content-collections.ts` requires `z.string().datetime()` — a date-only string fails validation and breaks `npm run build`. The Byline also calls `new Date(iso)`, which is happier with full ISO.
- **Fix:** All 5 posts use `2026-10-16T00:00:00.000Z` for both date fields; `check-seeds.mjs` asserts parseable datetimes rather than exact strings.
- **Files modified:** all 5 seed files, `scripts/check-seeds.mjs`
- **Commit:** 07a2307

**2. [Rule 2 - Missing critical] `lighthouserc.cjs` could not cover the post template**
- **Found during:** task 2 (workflow needs `lhci autorun` on `/` + seed URL)
- **Issue:** The Plan 01 config collected only `/` with no `startServerCommand`, so CI autorun could neither boot the app nor assert the post template. Plan 01's own comment says per-post assertions arrive in Plan 04 — this plan.
- **Fix:** Added the seed-post URL + `startServerCommand: 'npm start'` + `startServerReadyPattern`; assert block (performance ≥ 0.9) unchanged.
- **Files modified:** `lighthouserc.cjs`
- **Commit:** d85898e

**3. [Rule 3 - Blocking] `check-seeds.mjs` path handling broke on Windows**
- **Found during:** task 1 (first gate run threw ENOENT with doubled drive prefix)
- **Issue:** `join(new URL(...).pathname, file)` produces `D:\D:\...` on Windows (`/D:/` pathname + backslash join).
- **Fix:** `fileURLToPath()` for the directory + `join(POSTS_DIR, file)`. Cross-platform by construction.
- **Files modified:** `scripts/check-seeds.mjs`
- **Commit:** 07a2307 (fixed before commit; only the working version was committed)

## Issues Encountered

- PowerShell has no `&&` statement separator and aliases `curl` to `Invoke-WebRequest`: used `;` separators and `curl.exe` throughout. Tooling friction only, no plan impact.
- Background `next start` server used for live-render verification is session-scoped and dies with the session — no repo impact. A final `npm run build` after the task-2 commit confirms green at HEAD.

## Verification Outputs (final HEAD)

- `node scripts/check-seeds.mjs` → `5 passed`, exit 0 (after trimming all 5 descriptions into 150–160 chars; titles passed first try)
- `npm run build` → exit 0: `1 collection and 5 documents`, 17 static pages, all 5 `/blog/{slug}` SSG
- Banned-vocab gates (`delve|fast-paced world|game-changer|unlock the power`, `In today's digital age` over `content/posts/`): **0** matches
- Workflow gates: `lhci autorun` ×1, `check:seeds` ×1 in `lhci.yml`; `strict-transport-security` + `Googlebot/2.1` + `PENDING DNS` ×12 in `deploy-verify.md`
- Live render (`next start`, seed post 1): TL;DR aside, desktop `nav[aria-label="Table of contents"]` + mobile `<details>`, h2 ids with anchor `aria-label`s, Shiki `data-language` code block + copy button, in-article `data-ad-slot` exactly once, static FAQ section, byline + AI badge, breadcrumb, canonical, `og:image` → per-post route (`200 image/png`), full `<head>` with title/description/robots/canonical/OG/Twitter verified byte-level
- Stub scan over plan files: only false positives (`Todoist` matching case-insensitive `todo`, `placeholders` matching `placeholder`) — zero real stubs

## Known Stubs

None. Notes for downstream plans:

- Seed pricing is intentionally qualitative ("shapes", verify-on-vendor-page): the Phase 3 pipeline must re-verify prices at generation time rather than copying seed text — seeds are template fixtures (D-20), not a pricing database.
- Production deploy is the outstanding owner step (`user_setup`: Vercel project + domain + Cloudflare rules). `docs/deploy-verify.md` §3b must be re-run post-delegation; the LHCI median score row is likewise awaiting its first production run.

## Threat Flags

None beyond the plan's threat model — no new endpoints, auth paths, or schema changes:

- T-04-01 (scraped/duplicate seeds) mitigated: fresh original prose, per-post Sources sections, `check-seeds.mjs` + zod build gates green, banned-phrase scan clean.
- T-04-02 (CWV regression) mitigated: CI fails on performance < 0.9 across homepage + post template; `check:seeds` runs before `build` in the same workflow.
- T-04-03 (false deploy confidence) mitigated: real 404s pasted verbatim, production rows explicitly PENDING DNS, Googlebot-UA check procedure documented with the exact UA string, human DNS steps kept in `user_setup`.

## User Setup Required

- **Vercel project + domain (blocking production verify):** Create the Vercel project from this repo (region `iad1`), add `exclusivesources.online`, apply the 3 Cloudflare cache rules from `docs/edge-cdn.md` — full steps in `docs/deploy-verify.md` §§1–2. Then rerun §3b curls and paste the LHCI production summary. No code changes needed.

## Next Phase Readiness

- Phase 1 closes with this plan: SITE-01 (CWV proof via gates + local evidence), SITE-02 (template proven by 5 rendered seeds), SITE-03 (prior plan), SITE-04 (per-post OG cards verified 200 + meta present), GEO-02 (code + config complete; edge behavior verified locally, production pending owner DNS step)
- Ready for Phase 2 (SEO architecture): flat `/blog/{slug}` URLs live, single-source frontmatter (title/description/faq/silo) feeding both visible template and future JSON-LD/sitemap builders, `<RelatedPosts currentSlug silo>` contract stable
- Ready for Phase 3 (pipeline): 5 D-20 reference fixtures with the exact frontmatter contract the generator must reproduce, plus a reusable conformance script the pipeline QA stage can adopt

---

*Phase: 01-site-foundation-trust*
*Completed: 2026-10-17*

## Self-Check: PASSED

- All 8 created + 2 modified files verified present on disk
- Commits `07a2307` (task 1) and `d85898e` (task 2) verified in `git log`
- No unintended deletions in either task commit (`git diff --diff-filter=D` clean)
- Final HEAD `npm run build` + `node scripts/check-seeds.mjs` green after all commits
