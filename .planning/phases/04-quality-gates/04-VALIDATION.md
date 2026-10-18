---
phase: 04
slug: quality-gates
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-18
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 4 introduces automated quality gates (EEAT + Anti-Spam), quarantine isolation, and circuit-breaker auto-pause.
> Validation requires deterministic unit assertions, link-crawling mocks, and four explicit red-team attack tests.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js native test runner (`node --test` or `npx tsx --test`) + custom gate check scripts |
| **Config file** | Built into Node / `package.json` scripts |
| **Quick run command** | `npx tsx --test tests/qa-*.test.ts` |
| **Full suite command** | `npm run check:template && npx tsx --test tests/qa-*.test.ts` |
| **Estimated runtime** | ~10–25 seconds |

---

## Sampling Rate

- **After every task commit:** Run corresponding unit test (e.g. `npx tsx --test tests/qa-shingle.test.ts`)
- **After every plan wave:** Run full test suite (`npx tsx --test tests/qa-*.test.ts`)
- **Before `/gsd-verify-work`:** Full suite green + all 4 red-team scenarios verified
- **Max feedback latency:** 30 seconds

---

## Per-task Verification Map

| Task ID | Plan | Wave | Requirement | Threat / Gate Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-------------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | QA-01, QA-04 | D-01, D-02 | Quarantine mover moves file out of `content/posts/` to `content/quarantine/` with JSON report; registry stage becomes `'quarantined'` | unit | `npx tsx --test tests/qa-quarantine.test.ts` | no W0 | pending |
| 04-01-02 | 01 | 1 | QA-04 | D-10, D-11, D-12 | Circuit breaker trips after $K=3$ consecutive failures, generates `ALERT.md`, halts preflight, resumes via CLI | unit | `npx tsx --test tests/qa-circuit-breaker.test.ts` | no W0 | pending |
| 04-02-01 | 02 | 2 | QA-03 | D-06 | Blocklist regex catches YMYL terms in title, description, body | unit | `npx tsx --test tests/qa-blocklist.test.ts` | no W0 | pending |
| 04-02-02 | 02 | 2 | QA-03 | D-06 | Byline validator verifies real publisher + `/about` + `/editorial-process` links | unit | `npx tsx --test tests/qa-blocklist.test.ts` | no W0 | pending |
| 04-02-03 | 02 | 2 | QA-01 | D-09 | Link crawler catches broken internal routes and quarantines draft | unit | `npx tsx --test tests/qa-link-crawler.test.ts` | no W0 | pending |
| 04-03-01 | 03 | 2 | QA-01 | D-07 | 5-gram Jaccard shingler detects identical texts (1.0) and disjoint texts (0.0) | unit | `npx tsx --test tests/qa-shingle.test.ts` | no W0 | pending |
| 04-03-02 | 03 | 2 | QA-01 | D-07 | Draft with $> 0.70$ similarity against existing corpus triggers quarantine | unit | `npx tsx --test tests/qa-shingle.test.ts` | no W0 | pending |
| 04-04-01 | 04 | 3 | QA-02 | D-04, D-05 | Two-tier claim verification: minor ungrounded fluff auto-excised | unit/mock | `npx tsx --test tests/qa-claims.test.ts` | no W0 | pending |
| 04-04-02 | 04 | 3 | QA-02 | D-04, D-05 | Red-Team 1: Planted false stat ("78% of code in 1994") caught & quarantined | unit/mock | `npx tsx --test tests/qa-redteam.test.ts` | no W0 | pending |
| 04-05-01 | 05 | 3 | QA-01 | D-08 | 4-point Information Gain evaluator passes score $\ge 3/4$ and quarantines $< 3/4$ | unit/mock | `npx tsx --test tests/qa-info-gain.test.ts` | no W0 | pending |
| 04-05-02 | 05 | 4 | QA-01..04 | All | Full pipeline integration: `npm run pipeline -- --stage qa` validates landed drafts fail-closed | integration | `npx tsx --test tests/qa-integration.test.ts` | no W0 | pending |

*Status: pending → green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/qa/` directory created with mock drafts:
  - `clean-draft.mdx` (valid draft passing all gates)
  - `ymyl-draft.mdx` (contains tax/credit advice)
  - `broken-link-draft.mdx` (contains non-existent internal route)
  - `near-duplicate-draft.mdx` (rewritten seed with > 0.70 Jaccard similarity)
  - `planted-false-stat-draft.mdx` (contains "78% of code written by AI in 1994")
  - `thin-gain-draft.mdx` (lacks edge cases, comparisons, and gap closure; scores 1/4)
- [ ] Test helper harness for mocking LLM `completeJson` outputs deterministically without hitting network or token limits.

---

## Red-Team Acceptance Verification (Success Criteria 1 & 4)

1. **Red-Team 1 (Planted False Statistic):**
   - Inject `"In 1994, 78% of all enterprise software was created autonomously by AI (Gartner 1994)."` into fixture.
   - Run QA gate.
   - **Expected:** Draft MUST be moved to `content/quarantine/`, entry stage set to `'quarantined'`, report details the false historical statistic.
2. **Red-Team 2 (Near-Duplicate Post):**
   - Take `seed-01-best-ai-writing-assistants-2026.mdx`, apply synonym replacements across paragraphs while keeping structure identical (> 0.70 Jaccard similarity).
   - Run QA gate.
   - **Expected:** Draft MUST be moved to `content/quarantine/`, entry stage set to `'quarantined'`, report details Jaccard similarity score.
3. **Red-Team 3 (Broken Internal Link):**
   - Inject `[Explore AI tools](/non-existent-cluster/best-tool)` into a draft.
   - Run QA gate.
   - **Expected:** Draft MUST be moved to `content/quarantine/`, report details broken internal route `/non-existent-cluster/best-tool`.
4. **Red-Team 4 (Circuit-Breaker Auto-Pause):**
   - Feed 3 failing drafts sequentially.
   - **Expected:** On 3rd failure, pipeline sets `paused: true` in `content/keywords/pipeline-state.json`, generates `content/quarantine/ALERT.md`, terminal prints red banner, and next pipeline run aborts immediately with non-zero exit code.
   - Run `npm run pipeline:resume` $\rightarrow$ pipeline unlocks, `paused: false`, `ALERT.md` resolved.
