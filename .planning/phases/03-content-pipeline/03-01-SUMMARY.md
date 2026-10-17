---
phase: 03-content-pipeline
plan: 01
subsystem: content-pipeline
tags: [keyword-registry, budget-governance, spend-ledger, cli, json-shards, dataforseo-prep, tdd]

# Dependency graph
requires:
  - phase: 02-seo-architecture-silo-ia
    provides: lib/silos.ts single-source SILO_SLUGS/SiloSlug (imported, never re-declared); zero-dep "N passed" check-script idiom (check-crawl.mjs) reused by check:registry
provides:
  - lib/pipeline/types.ts contract shapes (RegistryEntry/RegistryStage/GeoMetrics/RegistryShard) that Waves 2-4 stage plans implement against verbatim
  - lib/pipeline/registry.ts registry IO (loadShard/saveShard/listByStage/listPromotable/advance/reject) with write-through validation + STAGE_CHAIN
  - lib/pipeline/budget.ts DataForSEO spend governance (readBudget/appendSpend/assertSpendable + BudgetExhaustedError, monthly rollover, $25/mo owner-tunable envelope)
  - lib/pipeline/run.ts orchestrator CLI (STAGE_ORDER, --stage/--registry, dynamic dispatch, StageContext/StageResult contract) + 9 npm pipeline/check scripts (whole-phase package.json ownership)
  - 5 git-committed per-silo registry shards under content/keywords/ + 40 seed topics + spend-ledger.json (one $0.60 verification op as real trail)
  - scripts/check-registry.mjs integrity gate (72 checks, zero-dep, comment-stripped text greps)
affects: [03-02-expand-stage, 03-03-outline-stage, 03-04-asset-stage, 03-05-draft-stage, 03-06-backfill-run, phase-4-quality-gates, phase-5-publish-cron]

# Tech tracking
tech-stack:
  added: [@anthropic-ai/sdk, openai, sharp, tsx, dotenv]
  patterns:
    - "Write-through validation: every loadShard re-proves the D-04 visible-trail invariants (stage vocabulary, rejected⇒reason, promoted-stage proof fields)"
    - "Atomic JSON writes: tmp + rename in destination dir (registry shards + ledger)"
    - "Cents arithmetic in budget sums to kill float drift (25 - 0.6 = 24.4 exactly)"
    - "Text-grep gate parity: check scripts parse TS modules as comment-stripped text, never import site code"
    - "Honest-failure CLI: unimplemented stages print FAIL + chain keeps walking, exit 1"

key-files:
  created:
    - lib/pipeline/types.ts
    - lib/pipeline/registry.ts
    - lib/pipeline/budget.ts
    - lib/pipeline/run.ts
    - scripts/check-registry.mjs
    - content/keywords/seed-topics.json
    - content/keywords/spend-ledger.json
    - content/keywords/ai-writing/registry.json
    - content/keywords/ai-coding/registry.json
    - content/keywords/ai-image/registry.json
    - content/keywords/ai-productivity/registry.json
    - content/keywords/ai-guides/registry.json
    - .env.example (local only — gitignored by design, see Issues)
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "SpendOp.month typed as regex-verified `${number}-${number}` template type — plan's 'YYYY-MM' annotation cannot compile as a literal TS type; runtime MONTH_RE validates before cast"
  - "run.ts wraps top-level await in async main() — package.json lacks \"type\":\"module\" so tsx compiles .ts as CJS; flipping global module type risks Next build configs"
  - "Full chain keeps walking on non-budget failures (records FAIL per stage, exits 1 at end) to satisfy 'walks all 5 stages with honest messages'; only assertSpendable exhaustion aborts mid-run per D-02 hard-stop"
  - "check:registry strips // + /* */ comments before every regex gate (plan's self-invalidating-gate hygiene rule)"
  - "REQUIREMENTS.md left unchecked: PIPE-01/PIPE-03 are only partially delivered by this foundation plan — completion arrives with 03-02..03-05"

patterns-established:
  - "Stage module contract: export async function runStage(ctx: StageContext): Promise<StageResult>; runner hands pre-bound registry/budget APIs"
  - "Per-silo shard layout content/keywords/{silo}/registry.json — never cross-silo clobbering"
  - "npm pipeline:* stage aliases map 1:1 to --stage flags for retries/debugging"
  - "check:* family extension with exit codes + 'N passed' output"

requirements-completed: [PIPE-01, PIPE-03]

# Metrics
duration: 25min
completed: 2026-10-17
---

# Phase 3 Plan 01: Registry + Governance Foundation Summary

**Git-committed 5-shard keyword registry with write-through D-04 validation, $25/mo DataForSEO envelope with monthly rollover + assertSpendable hard-stop, and an honest-failure stage-chain CLI (`npm run pipeline`) enforced by a 72-check zero-dep registry gate.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-17T09:02:44Z
- **Completed:** 2026-10-17T09:28Z
- **Tasks:** 3 (all executed, TDD for tasks 1-2)
- **Files modified:** 14 tracked (12 created + 2 modified); .env.example also created locally (intentionally gitignored)

## Accomplishments

- **Registry contract locked (task 1):** types.ts exports the planner's exact shapes (`RegistryStage` 6-value vocabulary, per-geo `GeoMetrics` US/UK/CA/AU, `SerpResult`, `ImageSlot`, `RegistryEntry` with brief/outline/draft/images proof fields). registry.ts does load/save/listByStage/listPromotable/advance/reject — with write-through validation so a shard missing `rejectionReason` on `rejected`, or `brief`/`outline.lint==='pass'`/`draft.slug` proof at promoted stages, fails closed at load; saves are atomic tmp+rename with a resolved-path prefix guard (T-03-01). 5 empty shards + 40 seed topics (8 silo × 5, inside D-03's 25-40 envelope) committed.
- **Budget governance proven (task 2):** readBudget computes current-month spend in cents (no float drift → 25 - 0.6 = 24.4 exactly), rollover ignores old-month ops but keeps them in the ledger as the audit trail, appendSpend rejects cost ≤ 0 and unknown services before any write, and assertSpendable throws `BudgetExhaustedError` past the envelope (1¢ overshoot and hard-stop both tested). Ledger committed with one self-describing $0.60 verification op as the real trail.
- **Runner + gates wired (task 3):** `npm run pipeline` walks expand→brief→outline→assets→draft sequentially, prints per-stage summary lines (`expand: advanced=N rejected=M spent=$X.XX`), and on the not-yet-written stage modules emits the honest `FAIL: stage 'X' is not implemented yet (expected lib/pipeline/stages/X.ts)` line for each of the 5, exit 1. `check:registry` passes 72 checks (5 shards + vocabulary/ground-truth greps, ledger envelope tolerance +0.01, seed-topics shape) and exits 0. `npm run build` stays green (23 pages). `package.json` now carries all 9 phase scripts — later plans must NOT touch it; deps installed: @anthropic-ai/sdk, openai, sharp (prod) + tsx, dotenv (dev).

## task Commits

Each task was committed atomically:

1. **task 1: Registry types + module + 5 shards + seed topics** - `6480d85` (feat)
2. **task 2: Budget envelope + spend ledger** - `64c7b99` (feat)
3. **task 3: Runner + npm plumbing + check-registry gate** - `51355ef` (feat)

**Plan metadata:** committed together with this SUMMARY (docs commit, see below).

## Verification Results

- `npx tsc --noEmit` → exit 0 (strict; tsconfig includes **/*.ts)
- `npm run check:registry` → `72 registry checks passed`, exit 0
- `npm run pipeline -- --stage expand` → honest FAIL line + exit 1; `--stage bogus`/`--evil` arg rejected; `--registry content/keywords` override works; `npm run pipeline:draft` alias works
- `npm run pipeline` (full chain) → all 5 stages report FAIL correctly, exit 1
- `npm run build` → green, 23 routes prerendered
- Behavior tests (temp tsx probes deleted after green — see Deviations): 15 registry assertions + 15 budget assertions pass, including roundtrip byte-parity, skip-transition throw, rollover, hard-stop class identity, no-mutation read

## Files Created/Modified
- `lib/pipeline/types.ts` - contract shapes (verbatim planner interfaces + SiloSlug import)
- `lib/pipeline/registry.ts` - shard IO + stage machine with load-time validation + atomic saves
- `lib/pipeline/budget.ts` - envelope read/append/hard-stop + SpendLedger types + MonthKey template type
- `lib/pipeline/run.ts` - orchestrator CLI with StageContext/StageResult exports for stage plans
- `scripts/check-registry.mjs` - zero-dep 72-check integrity gate
- `content/keywords/seed-topics.json` - 8 curated topics × 5 silos = 40 (D-01/D-03)
- `content/keywords/{ai-writing,ai-coding,ai-image,ai-productivity,ai-guides}/registry.json` - empty v1 shards
- `content/keywords/spend-ledger.json` - `{monthlyEnvelopeUsd: 25, ops: [1 verification op]}` (real trail, self-describing note)
- `package.json` - 9 pipeline/check scripts + 5 new deps (this plan owns package.json for the whole phase)
- `package-lock.json` - lockfile for new deps
- `.env.example` - all Phase-3 key names (local only — see Issues Encountered)

## Decisions Made

- `SpendOp.month` as `` `${number}-${number}` ``: the plan's `'YYYY-MM'` is documentation shorthand, not compilable TS; a template-literal type + runtime regex gives the same shape safely.
- Async `main()` wrapper instead of `"type": "module"`: tsx compiles repo `.ts` as CJS (no package.json type change wanted mid-phase — Next 16 configs live in the same package.json), so top-level await moved inside a function rather than flipping global module resolution.
- Keep-walking chain semantics: full-chain runs record each stage's failure and still report the remaining stages (matches the plan verification "walks all 5 stages with honest not-implemented messages"), while `BudgetExhaustedError` aborts the whole run immediately — preserving D-02's expansion hard-stop.
- Ledger verification op carries an explicit note flagging it as an offline smoke test, not a real API charge — D-04-style honesty for the spend trail.
- Seed-topics integrity (25-40 total, keys = SILO_SLUGS) enforced inside check:registry so the owner's pre-run edits can't silently break the D-03 backfill substrate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] types.ts verbatim block didn't compile — `SiloSlug` referenced without import**
- **Found during:** task 1 (first tsc pass)
- **Issue:** plan's types.ts code uses `silo: SiloSlug` but never imports the type
- **Fix:** added `import type { SiloSlug } from '../silos';` at top (still single-source — imported, never re-declared)
- **Files modified:** lib/pipeline/types.ts
- **Verification:** `npx tsc --noEmit` clean
- **Committed in:** 6480d85 (part of task 1 commit)

**2. [Rule 1 - Bug] `month: 'YYYY-MM'` literal-annotation cannot compile (task 2)**
- **Found during:** task 2 (tsc flagged TS2322)
- **Issue:** `'YYYY-MM'` as a TS type is a string literal type, not a pattern; runtime values like `2026-10` can't assign
- **Fix:** exported `type MonthKey = \`${number}-${number}\`` and validate with `/^(20\d{2})-(0[1-9]|1[0-2])$/` before the cast
- **Files modified:** lib/pipeline/budget.ts
- **Verification:** tsc clean; MONTH_RE-tested rollover still passes all budget tests
- **Committed in:** 64c7b99 (part of task 2 commit)

**3. [Rule 3 - Blocking] tsx CJS transform blocks top-level await in run.ts**
- **Found during:** task 3 (first `npm run pipeline -- --stage expand`)
- **Issue:** repo package.json has no `"type":"module"`, so tsx compiles `.ts` as CommonJS → "Top-level await is currently not supported with the cjs output format"
- **Fix:** wrapped parse+run in `async function main()` invoked via `void main()`, using `process.exitCode` instead of `process.exit` at the tail; mid-run budget abort still short-circuits the loop and returns 1
- **Files modified:** lib/pipeline/run.ts
- **Verification:** all runner invocations behave (verified exit codes 1 for FAIL paths, honest messages retained)
- **Committed in:** 51355ef (part of task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 compile-blocking bugs, 1 environmental blocker). **Impact on plan:** all fixes were mechanical unblocks to run exactly the specified contracts; no design or shape changed.

## Issues Encountered

- **TDD test file placement:** plan tasks 1-2 mark `tdd="true"` but list no test file in `files_modified`, and the project has no test framework. Honored TDD by writing the `<behavior>` lists as throwaway tsx probe scripts outside the repo (`%LOCALAPPDATA%\Temp\opencode\t0301\*.mts`), proving RED (import missing → exit 1) before any implementation and GREEN after — same scripts for both phases; they are intentionally not committed (the plan's `<verify>` snippets serve as the standing gates and live in the PLAN itself). One fixture fix was needed on the way (my test fixtures had wrong silo keys for cross-shard entries — validation caught it, which is exactly its job).
- **check:outline / check:template are declared-but-absent by design:** npm scripts referencing scripts that arrive with Plans 03-03/03-06 (`scripts/check-outline.mjs`, `scripts/check-template.mjs`). Nothing invokes them before their files exist (CI wiring in 03-06); deliberate forward scaffolding per plan.
- **no gsd-sdk available in this environment:** STATE/ROADMAP/REQUIREMENTS updates applied via direct file edits following the execute-plan.md protocol (same fields the SDK handlers would write).
- **`.env.example` exists locally but is NOT committed:** repo `.gitignore``s surviving `.env*` pattern (which the plan explicitly told me to verify and never violate) excludes the file from tracking. Zero keys inside at any rate; the owner copies it to `.env` locally. Future plans should not "fix" this by force-adding env files.

## User Setup Required

Partial — see the phase USER-SETUP flow when real API credentials are needed: Plans 03-02 (DataForSEO) and 03-04/03-05 (Anthropic/OpenAI) each document exact env keys; `.env.example` (local) already lists every key name. Nothing blocks 03-02 planning.

## Next Phase Readiness

- **Ready for 03-02 (DataForSEO expansion stage):** stage modules just need `export async function runStage(ctx): Promise<StageResult>` — ctx hands pre-bound `{registry, budget}` APIs, and `npm run pipeline -- --stage expand` already picks up `lib/pipeline/stages/expand.ts` the moment it exists (dynamic import dispatch proven).
- **Wave 2/3 blueprint guaranteed:** imports needed by every later stage (`loadShard/saveShard/listPromotable/advance/reject` + `readBudget/appendSpend/assertSpendable`) are exercised green; do not negotiate shapes — they're frozen per `<interfaces>`.
- **package.json is frozen after this plan** (whole-phase ownership); new deps would be a deviation.
- **Deferred:** pre-existing `basic-ftp` high-severity audit finding under `@lhci/cli` logged in `deferred-items.md` (out of scope for this plan).
- **Requirements status:** PIPE-01/PIPE-03 remain open in REQUIREMENTS.md — this plan delivered the storage/governance substrate only; expansion (03-02) and drafting (03-04/03-05) complete them. Leaving the checkboxes ticked would have been a false claim.

---
*Phase: 03-content-pipeline*
*Completed: 2026-10-17*

## Self-Check: PASSED

- All 15 key files verified present on disk (FOUND on every `[ -f ]` equivalent)
- All 3 task commits verified in git log: 6480d85, 64c7b99, 51355ef
- seed-topics.json re-parsed: total 40 topics, keys exactly the 5 SILO_SLUGS
- Post-verification runs: `npx tsc --noEmit` exit 0; `npm run check:registry` "72 registry checks passed" exit 0; `npm run build` green (23 routes); full-chain + single-stage pipeline FAIL paths verified honest with correct exit codes
