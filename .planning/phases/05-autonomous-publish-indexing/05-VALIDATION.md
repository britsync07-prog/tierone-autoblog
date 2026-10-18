---
phase: "5"
slug: "autonomous-publish-indexing"
status: ready
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-18"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js Test Runner (`node:test`, `node:assert/strict`) via `tsx` |
| **Config file** | `package.json` (`test` script) |
| **Quick run command** | `npx tsx --test tests/indexing-*.test.ts tests/publish-*.test.ts tests/verify-*.test.ts` |
| **Full suite command** | `npm test && npm run check:template && npm run check:registry` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test <relevant-test>.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | AUTO-03 | T-05-01 | Key verify route rejects mismatched/malicious key tokens | unit | `npx tsx --test tests/indexing-indexnow.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | AUTO-03 | T-05-02 | GSC credentials never logged; missing creds gracefully degrades | unit | `npx tsx --test tests/indexing-gsc.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | AUTO-01 | T-05-03 | SHA-256 hash prevents duplicate claim and concurrent publish | unit | `npx tsx --test tests/publish-claim-dlq.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | AUTO-01 | T-05-04 | 3-strike DLQ exhausts to quarantine without hanging | unit | `npx tsx --test tests/publish-claim-dlq.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | AUTO-02 | T-05-05 | Corrupted/placeholder HTML or invalid schema triggers auto-rollback | unit | `npx tsx --test tests/verify-live-url.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 3 | AUTO-02 | T-05-06 | Broken internal links trigger quarantine and auto-unpublish commit | unit | `npx tsx --test tests/verify-live-url.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 4 | AUTO-04 | T-05-07 | 20-query eval benchmark enforces Info Gain >= 3.0/4.0 gate | regression | `npx tsx --test tests/eval-20.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/indexing-indexnow.test.ts` — stubs for AUTO-03
- [ ] `tests/indexing-gsc.test.ts` — stubs for AUTO-03
- [ ] `tests/publish-claim-dlq.test.ts` — stubs for AUTO-01
- [ ] `tests/verify-live-url.test.ts` — stubs for AUTO-02
- [ ] `tests/eval-20.test.ts` & `tests/fixtures/eval-queries.json` — stubs for AUTO-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real GitHub Actions Cron Run | AUTO-01 | Triggered by GitHub Actions scheduler | Trigger via `workflow_dispatch` in GitHub Actions UI or push tag |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified
