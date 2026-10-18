# Phase 05 Plan 03: Post-Publish Live-URL Verification & Automated Rollback Summary

## Overview
Plan 05-03 implemented an autonomous, zero-human safety net ensuring that newly published blog posts deployed to production edge nodes are strictly inspected before search engine indexing is dispatched. Any post that fails HTTP delivery, corrupts structured data schemas, contains unrendered placeholder markers, or links to dead internal URLs is immediately and automatically rolled back via git unpublish, isolated into quarantine, and alerted via the circuit breaker.

## Deliverables & Key Components

### 1. Multi-Point Live URL Verifier (`lib/pipeline/publish/verifier.ts`)
- **Exponential Backoff Polling (`pollUntilLive`)**:
  - Polling loop with exponential/step backoff (intervals up to 180s total timeout) awaiting Vercel edge build and routing propagation.
  - Verifies HTTP 200 and `text/html` content-type.
- **JSON-LD Schema Validator (`extractJsonLd`, `validateJsonLd`)**:
  - Discovers all `<script type="application/ld+json">` blocks (supporting top-level objects and nested `@graph` nodes).
  - Validates `Article`/`BlogPosting` schema (headline length >= 10, valid author name, ISO `datePublished`).
  - Validates `BreadcrumbList` schema with non-empty `itemListElement` crumbs.
- **Banned Placeholder Scanner (`scanPlaceholders`)**:
  - Scans rendered DOM outside script and style tags.
  - Zero-tolerance regex detection for editorial tokens: `[TODO]`, `[Insert ...]`, `[Draft ...]`, `[TBD]`, `lorem ipsum`, `FIXME`, `PLACEHOLDER`, `<!-- TODO ... -->`.
  - Scans for client-side hydration/interpolation artifacts (`undefined`, `NaN`, `null`) outside code/pre blocks.
- **Dead Link Health Probe (`probeInternalLinks`)**:
  - Extracts internal links (`href="/..."`), normalizes URLs, filters out static assets and fragment hashes.
  - Executes HTTP `HEAD` probes (with `GET` fallback on 405) to ensure zero 404 crawl waste.
- **Suite Coordinator (`verifyLiveUrl`)**:
  - Runs all checks in sequence and returns a detailed `LiveVerificationReport`.

### 2. Automated Git Rollback Engine (`lib/pipeline/publish/rollback.ts`)
- **Isolation (`quarantineDraft`)**:
  - Automatically moves the failing post from `content/posts/${slug}.mdx` to `content/quarantine/${entryId}.mdx`.
- **Incident Audit Report**:
  - Writes comprehensive JSON incident report to `content/quarantine/${entryId}-live-fail-report.json`.
- **Registry Shard Transition**:
  - Transitions the keyword registry entry from `published` (or `drafted`) to `quarantined`, attaching `quarantine: { failedRule: 'live_verification_failed', reportPath, quarantinedAt }`.
- **Circuit-Breaker Tracking**:
  - Invokes `recordQaFailure` to increment consecutive QA failures and trip `content/quarantine/ALERT.md` if K >= 3.
- **Automated Git Revert & Push**:
  - Runs `git add content/posts content/quarantine content/keywords`.
  - Commits `[auto-unpublish] ${slug}: live verification failed [skip ci]`.
  - Pushes commit to `master` to immediately redeploy clean site state on Vercel.

### 3. Publisher Integration & CLI Tooling (`scripts/publish-scheduled.ts`, `scripts/verify-live-url.ts`, `package.json`)
- **Publisher Gate**:
  - Gated `dispatchDualTrackIndexing` behind successful live URL verification.
  - Added `--verify-live` flag (default `true` in CLI runs, `false` in offline dry-runs).
  - On verification failure: executes rollback, clears claim lock, and exits with code 1.
- **CLI Inspector**:
  - `npx tsx scripts/verify-live-url.ts <url-or-slug> [--rollback]` allows manual or automated on-demand inspection with optional unpublish.
  - Added npm script `"verify:live": "tsx scripts/verify-live-url.ts"`.

## Verification & Test Results
- **Unit & Integration Suite (`tests/verify-live-url.test.ts`)**:
  - 17 test cases covering polling, retries, backoff, schema validation, placeholder scans, link probes, automated rollback, and publisher integration.
  - All 17 tests passed in 5.9s.
- **Full Test Suite (`npm test`)**:
  - 61 test cases across the entire project repository passed with 0 errors.
- **Template Health Check (`npm run check:template`)**:
  - All 6 seed articles verified and passed.

## Files Modified & Created
- `lib/pipeline/publish/verifier.ts` (created)
- `lib/pipeline/publish/rollback.ts` (created)
- `scripts/verify-live-url.ts` (created)
- `scripts/publish-scheduled.ts` (modified)
- `lib/pipeline/registry.ts` (modified: allowed `published` -> `quarantined` transition)
- `package.json` (modified: added `verify:live` script)
- `tests/verify-live-url.test.ts` (created)
