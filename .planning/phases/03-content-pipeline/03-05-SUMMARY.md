---
phase: 03-content-pipeline
plan: 05
subsystem: pipeline
tags: [sharp, avif, webp, next-image, opengraph, mdx, seo, image-pipeline]

# Dependency graph
requires:
  - phase: 03-content-pipeline (plan 03-04)
    provides: draft-schema frontmatter contract incl. optional heroImage {src,alt} field + seed-01 comparison retrofit precedent
  - phase: 03-content-pipeline (plans 01–02)
    provides: registry shard model + StageResult contract + llm.ts credential-fail protocol (LlmNoCredentialsError)
  - phase: 02-* (site + SEO)
    provides: post page template, @vercel/og opengraph-image route, MDX component map, JSON-LD builders
provides:
  - lib/pipeline/images.ts — free procedural SVG→sharp image generator (hero 1280x720 AVIF+WebP + same-art OG pair og.avif/og.jpg 1200x630; in-article 1080x608 pair; atomic slot writes; deterministic FNV/mulberry32 seeding) + fixture provider verification lane + fail-closed provider seam (openai FORBIDDEN)
  - lib/pipeline/stages/assets.ts — assets stage: parses `## Image slots` blocks from committed outlines, honest parse gates with park notes, MAX_IMAGES_PER_RUN=6 runtime batch bound, records entry.images while stage stays 'outlined' (D-09)
  - app/blog/[slug]/page.tsx — LCP hero render slot (next/image, priority + fetchPriority="high", enforced frontmatter alt) + OG/twitter metadata branches advertising the generated art for hero posts
  - mdx-components.tsx — MDX img → next/image mapping at the 1080x608 in-article dims, lazy default, empty-alt build failure
  - test/pipeline/{images,assets-stage,hero-render}.test.ts — 17 new tests across the 3 tasks
affects: [03-06 draft stage (real LLM chain + alt regeneration), phase-04 SEO/verification (Lighthouse CWV posture), future render templates]

# Tech tracking
tech-stack:
  added: [] # none — sharp was already installed (Phase 1 scaffold); NO paid SDK was ever installed
  patterns: [procedural-generative-art (deterministic FNV/mulberry32-seeded SVG), provider-seam-fail-closed (LlmNoCredentialsError protocol extended to images), source-probe site tests (no site-code imports), atomic-in-memory-then-write encoding, runtime-not-ledgered spend bound]

key-files:
  created:
    - lib/pipeline/images.ts
    - lib/pipeline/stages/assets.ts
    - test/pipeline/images.test.ts
    - test/pipeline/assets-stage.test.ts
    - test/pipeline/hero-render.test.ts
  modified:
    - .env.example
    - app/blog/[slug]/page.tsx
    - mdx-components.tsx

key-decisions:
  - "Paid image API superseded by owner directive: the plan's 'openai' ImageProvider was reworked into a deterministic FREE procedural generator (concept-derived SVG rendered by already-installed sharp) as the real lane, plus a pure zlib/Buffer fixture lane for verification — no paid client code exists and no paid SDK was installed"
  - "Image spend governance (T-03-14) = runtime batch cap MAX_IMAGES_PER_RUN=6 with visible park notes; spend intentionally NOT ledgered (it is always $0.00, reported per-run in StageResult notes)"
  - "Alt text = the outline slot concept line with the 10-char floor enforced in the assets stage; cheap-model alt regeneration documented as the 03-06 real-chain path"
  - "OG og.jpg path is derived from the frontmatter hero src by basename replace (hero.avif|webp -> og.jpg) — never re-declared, and explicitly NOT a bare extension swap"
  - "Site tests are source-probe text scans per Phase-2 precedent; render wiring for hero-bearing posts is provable the moment drafts land (no hero posts exist today)"

patterns-established:
  - "Fail-closed provider seam: any non-free provider value (incl. openai with or without OPENAI_API_KEY) throws LlmNoCredentialsError naming the owner directive"
  - "In-memory-then-all-writes encoding: each slot's full file set encodes to buffers before a single byte is written — sharp failures can never leave partial slots on disk"
  - "Images evidence lane: PIPELINE_IMAGE_FIXTURE=1 (or provider=fixture) gives deterministic gradient PNGs for zero-credential verification"
  - "D-13 render contract: hero branch is the ONLY new markup for hero posts; seeds render byte-identical (og fallback preserved, no fetchPriority=high)"

requirements-completed: [PIPE-05]

# Metrics
duration: 39min
completed: 2026-10-17
---

# Phase 03 Plan 05: Image Assets Pipeline Summary

**Free procedural SVG→sharp image pipeline (hero AVIF+WebP + same-art OG pair from deterministic concept-seeded art) wired end-to-end: assets stage records entry.images without advancing the stage enum, and the post page renders the LCP hero + OG/twitter art while keeping all 5 seeds byte-identical.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-10-17T13:15:42Z
- **Completed:** 2026-10-17T13:54:56Z
- **Tasks:** 3 (TDD: RED→GREEN each)
- **Files modified:** 8

## Accomplishments

- **Free image machinery (`lib/pipeline/images.ts`)**: deterministic FNV/mulberry32-seeded concept-derived SVG compositions rendered by the already-installed sharp into the exact D-13 dimension set — hero.avif/hero.webp at 1280x720 plus the same-art OG pair og.avif (q60) + og.jpg (q80 mozjpeg) at 1200x630; in-article slots at 1080x608 with no OG pair. Every slot encodes fully in memory before any write (no partial-slot failures), and reruns are idempotent. Real sharp-output probe evidence verified all golden dims.
- **Assets stage (`lib/pipeline/stages/assets.ts`)**: reads committed outlines' `## Image slots` blocks (hero REQUIRED, in-article-1/2 optional), parks with clear notes on every honest parse failure (missing block/hero line/brief-captured-none/alt under 10 chars) while other entries continue, applies the MAX_IMAGES_PER_RUN=6 runtime cap, verifies every generated file on disk BEFORE touching the registry, and records `entry.images` with the stage REMAINING 'outlined' (D-09) and $0.00 spend.
- **Render/SEO wiring (`page.tsx` + `mdx-components.tsx`)**: LCP hero slot (next/image, `priority` + `fetchPriority="high"`, sizes hint, enforced frontmatter alt) below the byline and above the comparison table; generateMetadata advertises the site-absolute hero AVIF first + same-art og.jpg second for hero posts (twitter cards switch to the universal og.jpg raster); all seeds keep the Phase-1 `@vercel/og` fallback byte-identical; MDX img nodes map to next/image at 1080x608 lazy with an empty-alt **build failure** (pipeline-enforced alt).

## task Commits

Each task was committed atomically (TDD RED→GREEN per task):

1. **task 1: images module — provider seam + sharp encode** — `9594b57` (test RED), `1cd82ae` (feat GREEN)
2. **task 2: assets stage wiring + fixture proof** — `88b36ae` (test RED), `314a6fc` (feat GREEN)
3. **task 3: hero/OG render wiring + MDX image mapping** — `d49465e` (test RED), `0d95724` (feat GREEN), `b190d5c` (test regex correction)

**Plan metadata:** `docs(03-05): complete image-assets plan` (git log — SUMMARY/STATE/ROADMAP/REQUIREMENTS)

_Note: TDD tasks carry test→feat commit pairs; hooks ran on every commit._

## Files Created/Modified

- `lib/pipeline/images.ts` - procedural + fixture providers, heroPrompt export, prepareAssets (atomic encode/write), fail-closed provider seam enforcing the owner fully-free directive
- `lib/pipeline/stages/assets.ts` - runStage: outline `## Image slots` parsing, park-note contract, MAX_IMAGES_PER_RUN, disk-first asset verification, entry.images recording (stage stays 'outlined')
- `app/blog/[slug]/page.tsx` - next/image hero slot + OG/twitter metadata branches for hero posts; seeds untouched
- `mdx-components.tsx` - MDX img → next/image (1080x608, lazy, sizes hint, empty-alt build error, native width/height dropped from spread)
- `test/pipeline/images.test.ts` - task-1 RED: 8 tests (fixture encode, sharp dims probe, in-article shape, openai fail-closed incl. with-key case, idempotency, atomicity/no-partial-slot)
- `test/pipeline/assets-stage.test.ts` - task-2 RED: 5 tests (wiring + stage-stays-outlined, idempotent rerun, parse-failure park notes, alt floor, batch cap)
- `test/pipeline/hero-render.test.ts` - task-3 RED: 4 source-probe tests (hero slot/alt/dims/preload, order contract byline→hero→comparison→body, OG branch incl. seed-fallback preservation + basename derivation, MDX img mapping)
- `.env.example` - documents PIPELINE_IMAGE_PROVIDER (procedural|fixture; openai forbidden) + PIPELINE_IMAGE_FIXTURE=1

## Decisions Made

- **Owner full-free directive supersedes the plan's paid provider** (⚠ OVERRIDE 03-CONTEXT, binding): no third-party PAID image API is ever constructed; the free procedural generator is the default real lane and the fixture lane covers verification — see Deviations.
- **Alt text = outline concept line** with a 10-char floor enforced in the stage; park notes name the 03-06 cheap-model regeneration path rather than inventing alts deterministically.
- **og.jpg basename derivation** (`src.replace(/hero\.(?:avif|webp)$/, 'og.jpg')`) pinned by test because a naive extension swap would derive a nonexistent `hero.jpg` (the OG assets are named og.avif/og.jpg).
- **Twitter uses og.jpg for hero posts** (LinkedIn/iMessage/AVIF-gap-safe universal raster) while openGraph carries the D-13 AVIF-first + jpg-second pair.
- **Native `width/height` destructure-dropped** in the MDX img mapping so the 1080x608 dims can never be overridden by authored markup (also resolves next/image's `number | ${number}px` width type).

## Deviations from Plan

### Plan-Level Rework (⚠ owner directive, pre-execution)

**1. [Owner Override - Binding] Paid 'openai' image provider replaced with free procedural generator**
- **Found during:** plan rework before execution (03-CONTEXT ⚠ OVERRIDE — FULLY-FREE OWNER DIRECTIVE 2026-10-17)
- **Issue:** the plan's `openai` Images-API provider violates the owner's binding directive: NO third-party PAID image APIs ever; nothing may depend on paid credentials or a paid SDK.
- **Fix:** reworked the provider seam into two free lanes — 'procedural' (deterministic concept-derived SVG → sharp; the real production lane) and 'fixture' (pure zlib/Buffer gradient PNG for verification). Forcing `openai` via `PIPELINE_IMAGE_PROVIDER=openai` fails CLOSED: `LlmNoCredentialsError` naming `OPENAI_API_KEY` when unset, and naming the owner directive even when a key exists (mirror of the lib/pipeline/llm.ts credential protocol). A paid SDK was never npm-installed; the stack's openai dependency was NOT added for images.
- **Files modified:** lib/pipeline/images.ts, .env.example, test/pipeline/images.test.ts
- **Verification:** 8/8 images tests green incl. both openai-forbidden cases; zero external calls (offline proven by fixture-mode runs on a machine with no .env)
- **Committed in:** `1cd82ae`

**2. [Owner Override - Scope Fix] Deterministic concept art instead of photoreal AI generation**
- **Found during:** plan rework
- **Issue:** the paid plan assumed AI-generated raster art; the free directive requires art generated with zero external spend.
- **Fix:** procedural compositions derive palette/orbits from (slug, slot, concept) hashes so every asset is brand-consistent family art that always reproduces idempotently. `heroPrompt()` is retained and exported (per the plan's `<interfaces>`) as the generation contract for future in-house/local art (e.g. local diffusion) — no paid API consumes it in this plan.
- **Verification:** idempotency test (byte-stable reruns) green
- **Committed in:** `1cd82ae`

### Plan-Verify Adaptation

**3. [Rule 3 - Blocking] Fixture-mode verification, no .env present**
- **Found during:** tasks 1–2 verification
- **Issue:** the plan's verification scenarios assumed real API credentials; no .env exists on this machine (the real LLM chain is plan 03-06's task).
- **Fix:** verified entirely via the fixture lane (+ real sharp encodes in test sandboxes) — `prepareAssets` probe and `runStage` live no-op both proven with zero credentials; per the 03-03 fixture-discipline hard rule, sandbox tests use tmpdirs and delete artifacts after evidence capture.
- **Committed in:** `1cd82ae`, `314a6fc`

### Auto-fixed Issues

**4. [Rule 2 - Missing Critical] Empty-alt MDX images fail the build**
- **Found during:** task 3 (MDX img mapping)
- **Issue:** a markdown image with a missing/empty alt would ship an unnamed image at run time — alt enforcement is the PIPE-05 quality floor and was only guaranteed upstream (draft gate).
- **Fix:** the `img` mapping throws at build/render time on empty alt, making the pipeline-enforced alt airtight regardless of how a draft lands. Seeds have zero MDX img nodes, so this cannot affect byte-compat.
- **Verification:** source-probe test asserts the destructure + guards; 42/42 full suite green
- **Committed in:** `0d95724`

**5. [Rule 1 - Bug] OG crop path derivation correctness**
- **Found during:** task 3 (RED test design)
- **Issue:** a naive extension swap (`hero.avif` → `hero.jpg`) would derive a nonexistent file; the generated OG pair is named `og.avif`/`og.jpg` (basename change, not extension swap).
- **Fix:** derive via `post.heroImage.src.replace(/hero\.(?:avif|webp)$/, 'og.jpg')` (covers both schema-legal src shapes) and pin `'og.jpg'`'s basename in a test assertion that fails against any naive-extension-swap regression.
- **Verification:** hero-render tests green; plan-verify seed HTML probe confirms og fallback intact
- **Committed in:** `d49465e` / `0d95724` / `b190d5c`

**6. [Rule 1 - Bug] next/image width/height type conflict from MDX attrs spread**
- **Found during:** task 3 (tsc gate)
- **Issue:** spreading `ComponentProps<'img'>` rest onto `<Image>` passed native `width?: string | number` — rejected by next/image's `number | ${number}px` width type (2 × TS2322).
- **Fix:** destructure-dropped `width`/`height` from the rest spread so the fixed in-article dims always win.
- **Verification:** `npx tsc --noEmit` = 0 errors after fix
- **Committed in:** `0d95724`

---

**Total deviations:** 3 directive/verify adaptations (pre-execution owner override ×2 + fixture-mode adaptation ×1) + 3 auto-fixed (2 correctness, 1 missing-critical security/a11y)
**Impact on plan:** the owner-override rework was mandatory (binding directive); all auto-fixes were correctness/quality-floor requirements. No scope creep — the full plan surface still shipped (images module → assets stage → render/OG wiring).

## Issues Encountered

- RED-test design bug: two draft assertions didn't match planned reality (a garbled sentinel `/hero\.(afvphtc)/` in the OG test, and the summary's suspicion that `<ArticleBody` was absent — when reading the full page it IS present in-file, so that marker stayed). Fixed the sentinel into a real derivation + site-absolute assertion set BEFORE the RED commit; one later regex escape miss (`\$\{SITE_URL\}` wrapper) was corrected immediately after GREEN with a dedicated test commit (`b190d5c`).
- Earlier probe flagged `fetchpriority` occurrences in seeds — investigation proved they are Next.js runtime-injected `fetchPriority="low"` script preloads present on every prerendered page (identical pre/post); the seed contract's true signal, `fetchPriority="high"` = 0 across all seeds, was verified.
- sharp AVIF encodes are slow (~5s per multi-file batch in test sandboxes) — expected native-codec cost, not a hang.

## User Setup Required

None - no external service configuration required. The images path needs zero credentials by design (free procedural lane; `PIPELINE_IMAGE_PROVIDER`/`PIPELINE_IMAGE_FIXTURE` documented in .env.example are optional ergonomics, not requirements).

## Next Phase Readiness

- **03-06 real chain (draft stage)** picks up an images-complete slice: outlined entries now carry `entry.images` (D-09 precondition met), the 03-06 draft stage advances the enum and writes heroImage frontmatter from `entry.images.hero` (src + enforced alt; cheap-model alt regeneration lands there per the park-note contract).
- The 03-06 `heroPrompt` hook is exported if the real chain wants live free-art prompts; draft LLM (title/desc/body) wiring remains that plan's threshold (keys only).
- Prerendered seeds verified byte-compat post-wiring: og:image/twitter:image = `/blog/{slug}/opengraph-image`, `fetchPriority="high"` = 0, zero pipeline `/images/{slug}/` img srcs.
- Watch item: 03-06 should keep in-article image count ≤2 per draft (schema/parser already allow in-article-1|in-article-2 only).

## Verification Evidence

- `npx tsx --test test/pipeline/*.test.ts` (8 suites): **42/42 pass** (was 38/38 pre-task-3)
- `npx tsc --noEmit`: **0 errors**
- `npm run check:registry`: **5589 checks passed** (entry.images contract: non-empty hero.src/hero.alt)
- `npm run build`: green — 5 seed posts prerendered (SSG) + `/blog/[slug]/opengraph-image` route intact
- Live honesty probe (task 2): `npm run pipeline:assets` → `advanced=0 rejected=0 spent=$0.00` honest no-op, no shard mutation
- Plan-verify HTML probe: seeds render og fallback + no `fetchPriority="high"` (Next baseline `fetchPriority="low"` unchanged), og:image bytes checked on the ph-1 route

---
*Phase: 03-content-pipeline*
*Completed: 2026-10-17*

## Self-Check: PASSED

All 9 created/modified files verified on disk (`app/blog/[slug]/page.tsx` needed `Test-Path -LiteralPath` — bracketed path segments are PowerShell wildcards); all 7 task-commit hashes verified present in `git log --oneline --all`: `9594b57`, `1cd82ae`, `88b36ae`, `314a6fc`, `d49465e`, `0d95724`, `b190d5c`.
