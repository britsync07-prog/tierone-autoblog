# Phase 5: Autonomous Publish + Indexing - Plan 04 Summary

**Plan:** 05-04 (Pinned 20-Query Evaluation Benchmark)  
**Phase:** 05-autonomous-publish-indexing  
**Status:** Complete  
**Date:** 2026-10-18  

---

## Executive Overview

Plan 05-04 establishes the Pinned 20-Query Evaluation Benchmark (AUTO-04) protecting TierOne AutoBlog against silent prompt degradation, template regressions, or hallucination collapses that would compromise Google search ranking quality:
1. **Pinned 20-Query Dataset (`tests/fixtures/eval-queries.json`):** 20 canonical queries evenly distributed across all 5 verified silos (4 queries each across `ai-writing`, `ai-coding`, `ai-image`, `ai-productivity`, and `ai-guides`) covering 'best-of', 'comparison', 'guide', and 'troubleshooting' search intents (D-10).
2. **Fast Synthetic Evaluation Runner (`scripts/run-eval-suite.ts`):** Deterministic evaluation runner verifying frontmatter schemas (`draft-schema.ts`), exact title (50–60) and description (150–160) bounds, author byline and EEAT disclosure links (`checkAuthorByline`), topic safety blocklists (`checkBlocklist`), and the 4-point Information Gain rubric (`evaluateInformationGainDeterministic`). Completes offline execution across all 20 queries in under 20ms (D-11).
3. **Strict CI Regression Gate (`tests/eval-20.test.ts`):** Automated regression suite asserting 20/20 structural and safety passes, mean Information Gain score $\ge 3.0 / 4.0$, and confirming that artificially degraded output (dropping comparison tables or edge cases) fails the CI gate (D-12, T-05-07).

---

## Delivered Artifacts

### 1. Pinned 20-Query Dataset
- **`tests/fixtures/eval-queries.json`**:
  - Exactly 20 high-demand query objects across all 5 verified silos (4 per silo).
  - Schema per query:
    - `id`: unique identifier (e.g. `eq-write-01` through `eq-guide-04`).
    - `query`: canonical user search query.
    - `silo`: valid `SiloSlug` (`ai-writing`, `ai-coding`, `ai-image`, `ai-productivity`, `ai-guides`).
    - `targetAudience`: specific target audience segment.
    - `intent`: search intent category (`comparison`, `guide`, `best-of`, `troubleshooting`).
    - `expectedGainPoints`: four Information Gain dimensions (`workflowGuidance`, `comparisonSynthesis`, `edgeCaseCoverage`, `gapClosure`).

### 2. Fast Evaluation Runner & CLI
- **`scripts/run-eval-suite.ts`**:
  - Exports interfaces `EvalQuery`, `EvalItemResult`, `EvalQueryResult`, and `EvalSuiteSummary`.
  - Implements `runEvalSuite(options)`:
    - Loads fixture queries from disk.
    - Synthesizes or evaluates draft representations against `draftSchema`, title length (50–60), description length (150–160), byline integrity (`musfiqur-rahman-saimon`, `/about`, `/editorial-process`), blocklist matching, and the 4-point Information Gain rubric.
    - Computes `passedCount`, `meanInfoGain`, and `passedGate` (`passedCount === totalQueries && meanInfoGain >= 3.0`).
    - Outputs a formatted CLI table with status diagnostics and duration metrics when run directly or with `verbose: true`.
  - Supports custom `synthesizer` injection for regression testing degraded prompts or custom models.

### 3. CI Regression Test Suite
- **`tests/eval-20.test.ts`**:
  - Test 1: Verifies exactly 20 queries loaded evenly across all 5 silos (4 per silo).
  - Test 2: Verifies execution completes in < 5000ms offline (runs in ~15–30ms).
  - Test 3: Asserts 100% structural pass rate (`passedCount === 20`).
  - Test 4: Asserts mean Information Gain $\ge 3.0 / 4.0$ across the full portfolio.
  - Test 5: Asserts `passedGate === true` for compliant output.
  - Test 6: Artificially degrades outputs by omitting comparison tables and edge cases; verifies mean score drops to 2.0 / 4.0 and `passedGate === false`.

### 4. Package Integration & Validation Gate
- **`package.json`**:
  - Added `"test:eval": "tsx --test tests/eval-20.test.ts"`.
  - Added `"eval:run": "tsx scripts/run-eval-suite.ts"`.
  - Included `eval-20.test.ts` in overall `"test": "tsx --test tests/**/*.test.ts"`.
- **`scripts/check-registry.mjs`**:
  - Updated stage vocabulary check to accommodate the `'published'` stage introduced in Phase 5 alongside `'quarantined'` and `'rejected'`.

---

## Test Verification

```
> npm run test:eval
✔ Test 1: eval-queries.json contains exactly 20 queries across 5 silos (4 per silo) (1.7ms)
✔ Test 2: runEvalSuite() executes fast (< 5000ms offline) (17.8ms)
✔ Test 3: summary.passedCount === 20 (100% structural and safety pass rate) (4.8ms)
✔ Test 4: summary.meanInfoGain >= 3.0 (Information Gain threshold satisfied) (3.3ms)
✔ Test 5: summary.passedGate === true for baseline compliant suite (3.2ms)
✔ Test 6: Artificially degraded test: dropping comparison tables and edge cases drops score below 3.0 and fails the gate (3.3ms)
ℹ tests 6, pass 6, fail 0
```

```
> npm test
ℹ tests 67, pass 67, fail 0 (all test suites passing)
```

```
> npm run check:template
6 passed

> npm run check:registry
5722 registry checks passed
```
