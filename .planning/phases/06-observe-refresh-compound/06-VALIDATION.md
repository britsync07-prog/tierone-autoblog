---
phase: "6"
slug: "observe-refresh-compound"
status: ready
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-18"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js Test Runner (`node:test`, `node:assert/strict`) via `tsx` |
| **Config file** | `package.json` (`test` script) |
| **Quick run command** | `npx tsx --test tests/dashboard-route.test.ts tests/refresh-decay.test.ts tests/redirects-consolidation.test.ts tests/velocity-governor.test.ts tests/pillar-hub.test.ts` |
| **Full suite command** | `npm test && npm run check:template && npm run check:registry && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test <relevant-test>.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (`npm test` + `npm run build`)
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | GROW-01 | T-06-01 | GSC/Plausible queries normalize Tier-1 countries; fallback cleanly on missing credentials | unit | `npx tsx --test tests/dashboard-route.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | GROW-01 | T-06-02 | Route `/dashboard` blocks unauthorized access via 404 `notFound()`; validates secret token | integration | `npx tsx --test tests/dashboard-route.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | GROW-02 | T-06-03 | Striking-distance and decay detection algorithms correctly identify actionable items | unit | `npx tsx --test tests/refresh-decay.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | GROW-02 | T-06-04 | Refresh updates `updatedAt`, injects max 5 FAQs, and validates outbound link health | unit | `npx tsx --test tests/refresh-decay.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | GROW-02 | T-06-05 | `content/redirects.json` dynamically loads in Next config without throwing on missing file | unit | `npx tsx --test tests/redirects-consolidation.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | GROW-02 | T-06-06 | Retired cannibalized posts safely move to quarantine and update registry | unit | `npx tsx --test tests/redirects-consolidation.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 3 | GROW-03 | T-06-07 | 4-point governor locks scaling when <60d or <70% index ratio; unlocks when all pass | unit | `npx tsx --test tests/velocity-governor.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 3 | GROW-03 | T-06-08 | Silo landing page dynamically upgrades to Pillar Hub at >=8 posts with CollectionPage schema | unit | `npx tsx --test tests/pillar-hub.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/dashboard-route.test.ts` — stubs for GROW-01 (API clients, token auth, fallback)
- [ ] `tests/refresh-decay.test.ts` — stubs for GROW-02 (striking distance, decay, queue IO, FAQ limits)
- [ ] `tests/redirects-consolidation.test.ts` — stubs for GROW-02 (redirect registry, Next config integration, retirement)
- [ ] `tests/velocity-governor.test.ts` — stubs for GROW-03 (4-point gate, scheduled publisher hook)
- [ ] `tests/pillar-hub.test.ts` — stubs for GROW-03 (cluster threshold, CollectionPage schema, link mesh)

---

## Manual / Visual Verification Checkpoints

1. Navigate to `http://localhost:3000/dashboard` -> Verify HTTP 404 is returned.
2. Navigate to `http://localhost:3000/dashboard?token=${DASHBOARD_SECRET}` -> Verify dashboard renders with Tier-1 headline card, indexation ratio, and breakdown tables.
3. Access `http://localhost:3000/[silo]` -> Verify standard list when <8 posts and rich Pillar Hub when >=8 posts.
