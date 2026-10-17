---
phase: 03-content-pipeline
plan: 03
subsystem: pipeline
tags: [llm, openai-compatible, fetch, zod, fixture-testing, tdd, lint-gate, markdown-artifacts]

# Dependency graph
requires:
  - phase: 03-content-pipeline/03-01
    provides: registry stage machine (listPromotable/advance/reject), budget ledger (assertSpendable/appendSpend), StageContext/StageResult contract
  - phase: 03-content-pipeline/03-02
    provides: registry entries with serpTop3[]/paa[]/geo metrics + asOf dates, backfilled real keywords
provides:
  - lib/pipeline/llm.ts — env-configurable OpenAI-compatible structured-JSON adapter (single `fetch` transport, fixture mode through the same zod gate, repair retry, free-endpoint fallback, honest credential errors)
  - lib/pipeline/stages/brief.ts — competitor-gap brief stage (filtered → briefed) writing committed Markdown artifacts per D-11 with D-02 no-SERP-repull rule
  - lib/pipeline/stages/outline.ts — outline stage (briefed → outlined) gated by a pre-draft mechanical structure lint per D-12
  - scripts/check-outline.mjs — zero-dep 9-rule structure lint in the check-registry family idiom (`check:outline` npm script)
  - `free.llm` ledger service — cost-0, attempts-truthful spend records for real-mode LLM calls
affects: [03-04 (assets stage), 03-05, 03-06 (draft stage + real full-chain run), phase 4 QA gates, phase 5 publishing]

# Tech tracking
tech-stack:
  added: [env-configurable OpenAI-compatible chat-completions adapter over plain fetch, zero-dep spawn-based structure lint]
  patterns: [fixture-payload-through-the-same-zod-gate (provider='fixture', attempts=0), fail-closed LLM preflight before any registry mutation, committed-Markdown artifact + registry stage machine pairing, cross-file provenance linting]

key-files:
  created:
    - lib/pipeline/llm.ts
    - lib/pipeline/stages/brief.ts
    - lib/pipeline/stages/outline.ts
    - scripts/check-outline.mjs
    - .env.example
    - test/pipeline/llm.test.ts
    - test/pipeline/brief.test.ts
    - test/pipeline/outline.test.ts
    - test/fixtures/pipeline/registry-clones/ (5 silo shards + llm-fixtures.json)
    - test/fixtures/pipeline/outline-fixtures/good/ + bad/
  modified:
    - lib/pipeline/budget.ts (SpendOpService `free.llm`)
    - scripts/check-registry.mjs (SERVICES/FREE_SERVICES allowlist)
    - .gitignore (.env)

key-decisions:
  - "LLM contract reworked per the binding fully-free owner directive: one env-configurable OpenAI-COMPATIBLE adapter over plain fetch (LLM_BASE_URL, optional LLM_API_KEY, LLM_MODEL, optional LLM_MODEL_CHEAP, optional LLM_FALLBACK_*) instead of the plan's original paid Anthropic/OpenAI SDK split — errors name the missing env var, never a value"
  - "Fixture mode validates through the SAME zod gate as real calls (provider='fixture', attempts=0) so stage tests prove the real validation path with zero network"
  - "New ledger service `free.llm` (Rule 2): real-mode LLM calls record cost 0 + truthful attempts, with assertRequestsAvailable preflight per call — spend observation without any paid API"
  - "Brief task routes to the cheap model ('summarize'); worthIt=false still writes the brief (auditable judgement trail) then rejects; no cached SERP rejects 'cannot brief' (D-02 — brief time never re-pulls SERPs)"
  - "Outline uses the strong model ('outline-body', never cheap); D-12 layering: zod outline schema is shape-only, mechanical quality enforced by spawning scripts/check-outline.mjs BEFORE any registry mutation — lint pass records outline.lint='pass', lint fail leaves the entry briefed with the lint output in notes"
  - "Wave-2 reality: paa[] is empty platform-wide, so outline FAQs carry DERIVED provenance from the brief's '## FAQ candidate questions' section, honestly labelled 'not captured PAA' — the lint cross-checks against that section (invented questions fail the build) and fails closed if the sibling brief is missing"
  - "Real-run caps as named constants: REAL_RUN_PER_SILO_CAP=2 (brief) and OUTLINE_REAL_RUN_PER_SILO_CAP=2 (outline) — per D-09 slot discretion; the real full-chain run on the 27 live survivors is Plan 03-06's task"

patterns-established:
  - "Stage pattern: listPromotable → per-entry LLM via completeJson → artifact file written → advance/reject → saveShard, idempotent on rerun"
  - "Mechanical gate pattern: zero-dep check script prints `FAIL: file: rule N — reason` lines + `N passed`, exits 0/1; stages spawn it per artifact before promoting state"
  - "Fixture discipline: test fixtures live in test/fixtures/pipeline/, are copied to a tmpdir sandbox per test, and are NEVER run against in place (in-place runs mutate the committed clones)"

requirements-completed: [PIPE-02]

# Metrics
duration: 29min
completed: 2026-10-17
---

# Phase 3 Plan 03: LLM Adapter + Brief/Outline Stages + Structure-Lint Gate Summary

**Env-configurable OpenAI-compatible LLM adapter (fixture mode through the same zod gate, free-endpoint routing, honest credential errors) plus the gap-brief and outline stages, with outlines gated by a zero-dep 9-rule structure lint before any draft spend (D-12)**

## Performance

- **Duration:** 29 min (12:01Z → 12:30Z)
- **Started:** 2026-10-17T12:01:13Z
- **Completed:** 2026-10-17T12:30:04Z
- **Tasks:** 3/3 complete
- **Files modified:** 23 distinct files across 6 commits

## Accomplishments
- `lib/pipeline/llm.ts`: single OpenAI-compatible `fetch` adapter to `{LLM_BASE_URL}/chat/completions` with structured-JSON zod validation, 60s timeout, max 2 attempts (retry only on 5xx/429/network), exactly 1 repair retry on schema failure, one optional free-endpoint fallback, and `LlmNoCredentialsError` that names the missing env vars + free signup options — never a key value
- Brief stage: filtered → briefed with committed gap-brief Markdown (D-11), SERP top-3 reused from the registry (D-02), not-worth-a-post rejections keep their brief as a judgement trail, fixture mode makes zero ledger ops
- Outline stage: briefed → outlined, gated by `scripts/check-outline.mjs` (9 rules: H1 50–60 / meta 150–160 / TL;DR 10–100 words / ≥3 template H2s / 3–5 FAQs cross-checked against the brief's derived candidate list / image hero / single comparison-table marker / no placeholders) — no entry can reach `outlined` without a passing lint, so no draft spend can inherit an unlinted outline
- 15/15 tests pass (6 llm + 4 brief + 5 outline), `tsc --noEmit` clean, `check:registry` 5,589 checks pass

## Task Commits

Each task was committed atomically (TDD: RED then GREEN per task):

1. **task 1: LLM adapter** — RED `0f8cb1a` (test) → GREEN `4b373a9` (feat)
2. **task 2: Brief stage** — RED `8c730ef` (test + registry-clone fixtures) → GREEN `ab98e11` (feat + `free.llm` ledger service)
3. **task 3: Outline stage + structure-lint gate** — RED `e79604e` (test + lint fixtures) → GREEN `e3833fc` (feat)

**Plan metadata:** final `docs(03-03)` commit (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `lib/pipeline/llm.ts` — OpenAI-compatible structured-JSON adapter: `completeJson`, `readFixtureMap`, `assertLlmReady`, error classes, provider tags
- `lib/pipeline/stages/brief.ts` — gap-brief stage (`task: 'summarize'` → cheap model; `REAL_RUN_PER_SILO_CAP = 2`)
- `lib/pipeline/stages/outline.ts` — outline stage (`task: 'outline-body'` → strong model; `OUTLINE_REAL_RUN_PER_SILO_CAP = 2`; spawns the lint gate pre-promotion)
- `scripts/check-outline.mjs` — zero-dep 9-rule structure lint (`check:outline` npm script)
- `lib/pipeline/budget.ts`, `scripts/check-registry.mjs` — new `free.llm` ledger service (Rule 2)
- `.env.example`, `.gitignore` — env-var contract documented; `.env` ignored
- `test/pipeline/{llm,brief,outline}.test.ts` — task contracts
- `test/fixtures/pipeline/registry-clones/` — committed registry fixture clones + `llm-fixtures.json` (brief + outline payloads, keyed `brief:{silo}:{id}` / `outline:{silo}:{id}`)
- `test/fixtures/pipeline/outline-fixtures/{good,bad}/` — lint fixtures (good: 56-char H1, 156-char meta, 4 FAQs all derived; bad: 140-char meta, 2 FAQs, invented-FAQ cross-check case)

## Decisions Made
- **Provider rework (documented deviation from the plan's original llm contract):** the plan specified dual Anthropic/OpenAI SDKs with paid keys (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, `claude-sonnet-4-5`/`gpt-5-mini`). This contradicted the binding owner directive — **no third-party paid APIs, ever**. Reworked (Rule 4 decision recorded in plan context, executed as a deviation) to one env-configurable OpenAI-COMPATIBLE adapter pointing at free-tier endpoints: Groq (`https://api.groq.com/openai/v1`), OpenRouter `:free` models (`https://openrouter.ai/api/v1`), or local Ollama (`http://localhost:11434/v1`, keyless). Every task-level verify line still passes.
- **`free.llm` ledger service (Rule 2):** the ledger allowlist had no LLM service; real-mode calls need observable-but-free spend records. Added `SpendOpService`/`SERVICES` entries recording cost 0 + truthful attempt counts, with `assertRequestsAvailable` preflight per call.
- **Derived FAQ provenance (wave-2 reality):** `paa[]` is empty platform-wide (expansion captured no PAA), so the plan's must-have "FAQs derive from captured PAA data" is satisfied in its honest possible form: FAQs derive from the brief's model-generated candidate questions, labelled "not captured PAA" in the artifact itself, and the lint enforces non-invention via a cross-file check.
- **Real runs deferred:** the plan objective scopes this plan to FIXTURE-mode verification; the real full-chain run over the 27 live `filtered` survivors happens in Plan 03-06 with live keys. Verified the honest no-credentials behavior: `npm run pipeline:brief` exits 1 at `LlmNoCredentialsError` naming `LLM_BASE_URL`/`LLM_MODEL` (+ free endpoint suggestions) BEFORE touching any registry state (27 survivors remain untouched); `npm run pipeline:outline` no-ops cleanly (0 briefed entries exist yet).

## Deviations from Plan

### Auto-fixed Issues

**1. [Documented deviation — owner-directive conflict] Dual paid-provider SDK contract → env-configurable OpenAI-compatible adapter**
- **Found during:** task 1 (LLM adapter)
- **Issue:** the plan's llm contract required `@anthropic-ai/sdk` + `openai` SDKs with paid API keys and paid defaults (`claude-sonnet-4-5`, `gpt-5-mini`) — a direct conflict with the project's binding fully-free directive ("no third-party PAID API is ever allowed")
- **Fix:** single adapter over plain `fetch` to `{LLM_BASE_URL}/chat/completions`; model routing via `LLM_MODEL`/`LLM_MODEL_CHEAP` per task; optional one-shot fallback via `LLM_FALLBACK_*`; fixture payloads flow through the same zod gate
- **Files modified:** lib/pipeline/llm.ts, .env.example, .gitignore
- **Verification:** all 6 llm tests + task-1 verify line pass; `tsc --noEmit` clean
- **Committed in:** `4b373a9`

**2. [Rule 2 - Missing Critical] Added `free.llm` ledger service**
- **Found during:** task 2 (brief stage)
- **Issue:** real-mode LLM calls had no ledger service to record their (zero-cost) spend — real runs would be unobservable and unthrottled by the budget preflight
- **Fix:** `SpendOpService` entry in lib/pipeline/budget.ts + `SERVICES`/`FREE_SERVICES` in scripts/check-registry.mjs; real-mode calls record cost 0 + truthful attempts after `assertRequestsAvailable`
- **Files modified:** lib/pipeline/budget.ts, scripts/check-registry.mjs
- **Verification:** `check:registry` 5,589 checks pass; brief-stage tests confirm fixture mode makes zero ledger ops
- **Committed in:** `ab98e11`

**3. [Rule 1 - Bug] Fixed three bugs in check-outline.mjs caught by the RED tests during GREEN**
- **Found during:** task 3 (outline stage + lint gate)
- **Issue:** (a) rule 4's scan loop `break`ed on any `## ` line before counting — but the template content H2s themselves start with `## `, so the count was always 0; (b) rule 6 parsed `- Q: ` with `line.slice(6)` (5-char prefix) eating the first question character ("Is"→"s"), so no question could ever match the brief's candidate list; (c) per-rule failure lines lacked the literal `FAIL` prefix the check-family contract (and tests) require
- **Fix:** count template-shaped H2s first and break only on non-template `## ` lines (fail-closed on malformed H2s); `slice(5)`; `FAIL: ` prefix on every failing line
- **Files modified:** scripts/check-outline.mjs
- **Verification:** good fixture dir → exit 0, "9 passed"; bad fixture dir → exit 1 with precise FAIL lines (140-char meta, 2-FAQ count, invented "Does the fixture calendar app sync offline?" named verbatim); full suite 15/15
- **Committed in:** `e3833fc` (part of task 3 GREEN)

---

**Total deviations:** 3 (1 documented owner-directive rework, 1 Rule 2 missing-critical, 1 Rule 1 bug trio caught by TDD)
**Impact on plan:** All deviations serve the binding fully-free directive or correctness. No scope creep; all plan verify lines green.

## Issues Encountered
- During task-2 verification the brief stage was briefly run against `test/fixtures/pipeline/registry-clones/` in place, mutating the committed fixture clones; resolved by removing generated artifacts and restoring the clones via `git checkout --`. Established as a hard rule: stages run ONLY in tmpdir sandboxes.
- PowerShell 5.1 quirks handled: `[datetime]'...Z'` casts mis-parse timezone math (duration computed from git commit timestamps instead); `npx tsx --test` used for node:test files.

## User Setup Required
- **This plan:** none — everything verified in fixture mode with zero network.
- **For Plan 03-06's real full-chain run** (the credential gate lives there): create a `.env` (already gitignored) with an env-configurable FREE endpoint — `LLM_BASE_URL` (e.g. `https://api.groq.com/openai/v1`, `https://openrouter.ai/api/v1`, or `http://localhost:11434/v1`), `LLM_MODEL` (a long-form-capable free model), optionally `LLM_API_KEY` (unset for keyless Ollama), optionally `LLM_MODEL_CHEAP` for the brief task, optionally `LLM_FALLBACK_BASE_URL`/`LLM_FALLBACK_MODEL`. Verification: `npm run pipeline:brief` then `npm run pipeline:outline`.

## Known Stubs
None — all stages are fully implemented; real mode is complete and simply awaits live env credentials in 03-06 (an operational gate, not a code stub).

## Next Phase Readiness
- 03-04/03-05 (assets + template machinery) can consume the stage-machine and lint-family patterns; 03-06 consumes `outline.lint === 'pass'` as its pre-draft gate (already re-assertable) and the adapter's `draft-body` task slot
- The draft plan needs the env credential setup above; the `LlmNoCredentialsError` message already walks the user through it
- 27 live `filtered` survivors (3 of which lack `serpTop3` and will be rejected by the brief stage's D-02 rule on the first real run) are queued for 03-06

---
*Phase: 03-content-pipeline*
*Completed: 2026-10-17*

## Self-Check: PASSED

All 12 claimed files exist on disk; all 6 task commits (0f8cb1a, 4b373a9, 8c730ef, ab98e11, e79604e, e3833fc) found in git log --all. Test suite 15/15, tsc clean, check:registry 5,589 checks pass, lint fixtures good/bad verified (exit 0/exit 1 with precise FAIL lines), honest no-credentials CLI behavior verified with zero registry mutation.
