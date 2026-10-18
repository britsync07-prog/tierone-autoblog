# Phase 6: Observe, Refresh + Compound - Plan 02 Summary

**Plan:** 06-02 (Striking-Distance, Content Decay & Refresh Engine)  
**Phase:** 06-observe-refresh-compound  
**Status:** Complete  
**Date:** 2026-10-18  

---

## Executive Overview

Plan 06-02 establishes the search-driven content refresh and compounding optimization engine (GROW-02) for TierOne AutoBlog:
1. **Striking-Distance Detection**:
   - Isolates queries ranking in positions 5.0–20.0 with $\ge 50$ impressions over the last 28 days.
   - Computes prioritized opportunity scores via:
     $$\text{OpportunityScore} = \text{impressions} \times (21.0 - \text{position})$$
   - Formulates targeted FAQ expansions directly answering search queries to unlock page-1 top-3 ranking gains.
2. **Content Decay Radar**:
   - Analyzes mature evergreen articles ($\ge 90$ days old) experiencing traffic drops.
   - Enforces a baseline floor of $\ge 100$ impressions in the prior 30-day period to prevent noise in low-volume queries.
   - Flags posts exhibiting $\ge 25\%$ decrease in impressions or clicks comparing current 30d vs prior 30d.
   - Prioritizes updates using decay score: $\Delta_{\text{drop}} \times \text{priorImpressions}$.
3. **Structured Persistent Queue (`content/keywords/refresh-queue.json`)**:
   - Persists actionable refresh tasks deterministically with diagnostic metrics and suggested actions.
   - Idempotent upsert merges new candidates by unique ID while strictly preserving history and timestamps of `'applied'` and `'quarantined'` items.
4. **Autonomous Non-Destructive Refresh Execution**:
   - Bumps frontmatter `updatedAt` to the current ISO 8601 timestamp (mapped to Schema.org `dateModified` in JSON-LD).
   - Injects striking-distance FAQs while strictly guarding the 3–5 FAQ limit enforced by `draftSchema`. If an article already contains 5 FAQs, the lowest-value item is replaced rather than overflowing to a 6th item (preventing Next.js build breaks).
   - Detects broken external hyperlinks (404/5xx) and unlinks them cleanly (`[Anchor](dead-url)` $\to$ `Anchor`) without disturbing surrounding markdown prose.
5. **CLI Runner (`scripts/run-content-refresh.ts`)**:
   - Supports `--dry-run`, `--apply`, `--detect-only`, and `--slug <slug>` filters.
   - Wired to npm script `"refresh:run"`.

---

## Delivered Artifacts

### 1. Data Structures & Detection Engine
- **`lib/pipeline/refresh/types.ts`**:
  - `RefreshActionType = 'bump-date-modified' | 'inject-faq' | 'repair-links' | 'consolidate-301'`
  - `RefreshItemType = 'striking-distance' | 'content-decay'`
  - Interfaces: `StrikingDistanceQuery`, `ContentDecayResult`, `RefreshQueueItem`, `RefreshQueueFile`
- **`lib/pipeline/refresh/detect.ts`**:
  - `detectStrikingDistance(rows, options)`: filters $5.0 \le \text{pos} \le 20.0$ and $\text{impr} \ge 50$, computes opportunity score, sorts descending.
  - `buildStrikingDistanceQueueItems(queries, existingPosts, now)`: groups queries by post slug, creates prioritized queue items with suggested FAQ items.
  - `detectContentDecay(pages, options)`: enforces age $\ge 90$ days, prior impressions $\ge 100$, and impression or click drop $\ge 25\%$.
  - `buildContentDecayQueueItems(decayResults, now)`: converts decaying articles into prioritized queue tasks.
  - `extractSlugFromPage(page)`: normalizes URL paths and domains into clean post slugs.

### 2. Persistent Queue Management
- **`lib/pipeline/refresh/queue.ts`**:
  - `loadRefreshQueue(filePath)`: safely loads `content/keywords/refresh-queue.json` or returns empty queue file.
  - `saveRefreshQueue(queue, filePath)`: atomically formats and writes JSON queue with auto-created parent directories.
  - `upsertRefreshQueue(existing, newItems)`: deduplicates by item ID, preserves terminal states (`applied` / `quarantined`), and updates pending metrics.
  - `updateRefreshItemStatus(id, status, filePath)`: records status transitions and sets `appliedAt` timestamp.
- **`content/keywords/refresh-queue.json`**:
  - Persistent queue file storing identified refresh tasks and diagnostic snapshots.

### 3. Autonomous Execution & Guardrails
- **`lib/pipeline/refresh/execute.ts`**:
  - `executeRefreshAction(target, options)`: executes `bump-date-modified`, `inject-faq`, and `repair-links`.
  - **FAQ Limit Guard**: inspects `data.faq`. If length $< 5$, appends new FAQ. If length $\ge 5$, replaces lowest-value item so the post never exceeds 5 FAQs. Re-validates against `draftSchema.shape.faq`.
  - **Link Unlinking**: `unlinkMarkdownUrl(content, url)` regex-replaces dead markdown links while preserving anchor text.
  - **Resilient Post Resolution**: `resolvePostFilePath(slug, postsDir)` matches direct filenames and scans frontmatter slugs across `.mdx` files.
- **`scripts/run-content-refresh.ts`**:
  - End-to-end CLI workflow coordinating analytics ingestion, striking-distance detection, decay radar, queue persistence, and selective or batch refresh execution.
- **`package.json`**:
  - Added `"refresh:run": "tsx scripts/run-content-refresh.ts"`.
  - Added `"gray-matter": "^4.0.3"` to explicit dependencies.

### 4. Verification Suite
- **`tests/refresh-decay.test.ts`**:
  - Striking-distance query filtering, boundary checks (pos 5.0, 20.0, impr 50), and opportunity score sorting.
  - Content decay threshold checks: age gate ($\ge 90$d), volume gate ($\ge 100$ prior impr), and $\ge 25\%$ drop condition.
  - Queue persistence, deduplication, and applied status preservation.
  - Link repair unlinking syntax.
  - Frontmatter `updatedAt` bump.
  - FAQ boundary test: verifies an article with 5 FAQs never gets a 6th FAQ, and still satisfies `draftSchema.safeParse()`.
  - `--dry-run` vs live execution file integrity.

---

## Threat Mitigations & Verifications

### Threat T-06-03: False-Positive Content Decay Churn & Queue Pollution
- **Risk**: Seasonal search noise or natural fluctuations on low-volume posts trigger unnecessary file updates and git churn.
- **Mitigation Implemented**: Three-fold filter gate in `detectContentDecay`:
  1. Minimum post age of 90 days.
  2. Prior 30-day baseline floor of 100 impressions.
  3. Strict 25% drop threshold in impressions or clicks.
  4. Unique deterministic queue IDs (`refresh-{slug}-{YYYY-MM}` and `decay-{slug}-{YYYY-MM}`) prevent task duplication across multiple pipeline runs.
- **Verification**: Verified in `tests/refresh-decay.test.ts` where posts <90 days old, with <100 prior impressions, or with only 10% drops are rejected.

### Threat T-06-04: Frontmatter Schema Violation via FAQ Overflow & Broken Build
- **Risk**: Automated FAQ additions push post FAQ count to 6, violating `draftSchema` (`.max(5)`), causing `@content-collections` and Next.js production builds to fail.
- **Mitigation Implemented**: Hard ceiling check in `lib/pipeline/refresh/execute.ts`:
  - When `data.faq.length >= 5`, replaces the lowest-value item rather than appending.
  - Validates `draftSchema.shape.faq.safeParse(data.faq)` and `draftSchema.partial().safeParse(data)` before writing any file to disk.
- **Verification**: Verified in `tests/refresh-decay.test.ts` by asserting that an article seeded with 5 FAQs retains exactly 5 items after injection and cleanly passes `draftSchema.safeParse()`.

---

## Test & Verification Evidence

- `tests/refresh-decay.test.ts`: **6 passed, 0 failed**
- Full test suite (`npm test`): **85 passed, 0 failed**
- Post template conformance (`npm run check:template`): **6 passed, 0 failed**
- Dry-run CLI test (`npx tsx scripts/run-content-refresh.ts --dry-run`): **Executed cleanly with 0 errors**

```
✔ extractSlugFromPage: extracts slug from clean path or full URL (2.15ms)
✔ detectStrikingDistance: isolates queries with pos 5.0-20.0 and impressions >= 50 (4.94ms)
✔ detectContentDecay: enforces >= 90d age, >= 100 prior impressions, and >= 25% drop (0.73ms)
✔ queue: load, save, and upsert deduplication preserves applied history (13.97ms)
✔ unlinkMarkdownUrl: cleanly removes link wrapper preserving anchor prose (0.37ms)
✔ executeRefreshAction: bumps updatedAt and respects FAQ boundary (max 5) (35.96ms)
ℹ tests 6
ℹ pass 6
ℹ fail 0
```
