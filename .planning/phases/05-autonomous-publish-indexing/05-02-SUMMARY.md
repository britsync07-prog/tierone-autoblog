# Phase 5 Plan 02: Scheduled Publishing Engine & Claim-by-Hash DLQ Summary

**Execution Date:** 2026-10-18  
**Status:** Complete  
**Requirements Satisfied:** [AUTO-01]  

---

## 1. Executive Summary

Plan 05-02 established the core autonomous publishing engine, idempotent claim-by-hash concurrency locking, and 3-strike Dead Letter Queue (DLQ) isolation for TierOne AutoBlog:
- **Registry 'published' Stage (D-09):** Extended `RegistryStage` vocabulary and shard validation to support transition to `'published'`, timestamping `publishedAt` on release.
- **Idempotent Claim-by-Hash Locking (D-02):** Cryptographic SHA-256 fingerprint lock computed from candidate ID and update timestamp, preventing duplicate publishes or collision across overlapping CI runs with automated 30-minute stale lock expiration.
- **Dead Letter Queue & 3-Strike Isolation (D-03):** Transient failures tracked in `content/keywords/dlq.json`. Upon reaching 3 failures, poison-pill candidates are physically isolated to `content/quarantine/`, transitioned to `'quarantined'`, alerted in `ALERT.md`, and recorded in the circuit breaker without blocking publishing rotation.
- **Scheduled Publisher Script & GitHub Actions Workflow (D-01):** `scripts/publish-scheduled.ts` scans shards for QA-passed candidates in FIFO order, acquires lock, publishes, dispatches dual-track indexing (IndexNow + GSC), clears DLQ, and releases lock. Configured via `.github/workflows/publish.yml` on a 4x/week cadence (`0 6 * * 1,3,5,0`).

---

## 2. Artifacts Delivered & Files Modified

| File | Purpose |
|---|---|
| `lib/pipeline/types.ts` | Added `'published'` to `RegistryStage`, `publishedAt` to `RegistryEntry`. |
| `lib/pipeline/registry.ts` | Added `publishEntry`, updated `validateEntry` and `assertTransitionStage` for `'published'`. |
| `lib/pipeline/qa/circuit-breaker.ts` | Added `activeClaim` to `PipelineState`, exported `writePipelineState`. |
| `lib/pipeline/publish/claim-lock.ts` | Implemented `computeClaimHash`, `acquireClaimLock`, `releaseClaimLock`, `isClaimActive`. |
| `lib/pipeline/publish/dlq.ts` | Implemented DLQ failure recording, state persistence, and 3-strike quarantine escalation. |
| `scripts/publish-scheduled.ts` | CLI & programmatic scheduled publisher selecting FIFO candidates and triggering indexing. |
| `.github/workflows/publish.yml` | GitHub Actions workflow executing 4x/week (Mon, Wed, Fri, Sun 06:00 UTC) with git push to `master`. |
| `package.json` | Added `"publish:scheduled"` and `"test"` script commands. |
| `tests/publish-claim-dlq.test.ts` | 10 unit tests verifying claim locking, stale lock eviction, DLQ tracking, 3-strike escalation, and runner. |

---

## 3. Verification & Test Results

1. **Dedicated Unit Test Suite:**
   ```bash
   npx tsx --test tests/publish-claim-dlq.test.ts
   ```
   - 10 tests passed (100% pass rate).
   - Verified deterministic SHA-256 generation, collision rejection, stale override (>30m), DLQ incrementing, 3-strike isolation, and candidate FIFO sorting.

2. **Full Repository Test Suite:**
   ```bash
   npm test
   ```
   - 44 tests passed across all 11 test suites (0 failures).

3. **Template Conformance:**
   ```bash
   npm run check:template
   ```
   - 6/6 post MDX files passed.

4. **CLI Dry Run Validation:**
   ```bash
   npx tsx scripts/publish-scheduled.ts --dry-run
   ```
   - Successfully selected QA-passed candidate `best-ai-writing-tools`, acquired claim lock, output dry run status, and cleanly released the lock.
