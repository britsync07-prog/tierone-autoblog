# Phase 6: Observe, Refresh + Compound - Plan 03 Summary

**Plan:** 06-03 (Data-Driven 301 Redirect Consolidation & Post Retirement)  
**Phase:** 06-observe-refresh-compound  
**Status:** Complete  
**Date:** 2026-10-18  

---

## Executive Overview

Plan 06-03 delivers data-driven 301 redirect consolidation and clean post retirement (GROW-02) for TierOne AutoBlog:
1. **Dynamic 301 Redirect Registry (`content/redirects.json`)**:
   - Declarative machine-readable permanent 301 redirects registry containing `source`, `destination`, `permanent`, `reason`, and `retiredAt`.
   - Integrated into Next.js App Router via dynamic `async redirects()` hook in `next.config.mjs`.
   - Build-time crash protection: `loadJsonRedirects()` safely fails soft to an empty array `[]` on missing, corrupt, or invalid JSON.
2. **Redirect Hygiene & Loop Prevention (`lib/pipeline/redirects/registry.ts`)**:
   - Path format validation ensuring leading `/` on source and destination.
   - Self-referential loop elimination (`source === destination`).
   - Duplicate source detection preventing contradictory rules.
   - Circular pair prevention (`A -> B` contradicts `B -> A`).
   - Transitive cycle detection (`A -> B -> C -> A`).
   - Multi-hop chain warning and destination resolution (`A -> B -> C`).
3. **Physical MDX Quarantine & Registry Synchronization (`lib/pipeline/redirects/retire.ts`)**:
   - When an article is superseded or merged, its `.mdx` file is physically relocated from `content/posts/` to `content/quarantine/{slug}.mdx` via `quarantineDraft`.
   - Keyword registry entry is transitioned from `'published'` to `'quarantined'` with failure rule `'301-consolidated'`, audit report path `'content/redirects.json'`, and updated timestamp.
   - Removal from `content/posts/` guarantees `@content-collections` and `app/sitemap.ts` immediately purge the retired URL from builds and XML sitemaps, avoiding crawl friction or soft-404s.
4. **CLI Retirement Tooling & Automation**:
   - `scripts/retire-post.ts` CLI command supporting argument parsing (`--slug`, `--destination`, `--reason`, `--dry-run`, and positional arguments).
   - Added npm script `"post:retire": "tsx scripts/retire-post.ts"`.

---

## Delivered Artifacts

### 1. Redirect Registry & Next.js Dynamic Integration
- **`content/redirects.json`**:
  - Declarative JSON array of permanent 301 redirect definitions.
- **`lib/pipeline/redirects/registry.ts`**:
  - `RedirectEntry` interface.
  - `loadRedirects(filePath?)`: loads and filters valid redirect entries.
  - `saveRedirects(entries, filePath?)`: persists redirect entries atomically using `.tmp` files.
  - `validateRedirectEntry(entry, existing)`: comprehensively validates rules against self-loops, duplicate sources, circular pairs, transitive cycles, and multi-hop chains.
  - `formatForNextConfig(entries)`: formats entries for Next.js App Router `redirects()` schema.
- **`next.config.mjs`**:
  - Implements `loadJsonRedirects()` with safe try/catch error boundaries.
  - Implements `async redirects()` returning permanent 301 redirects alongside existing `async rewrites()` and `async headers()`.

### 2. Post Retirement Workflow & CLI Tooling
- **`lib/pipeline/redirects/retire.ts`**:
  - `retireAndRedirectPost`: coordinates verification, physical `.mdx` relocation to `content/quarantine/`, keyword registry stage updates to `'quarantined'`, and 301 redirect entry persistence. Supports dry-run simulation mode.
- **`scripts/retire-post.ts`**:
  - CLI script exposing `--slug`, `--destination`, `--reason`, and `--dry-run`.
- **`package.json`**:
  - Added script `"post:retire": "tsx scripts/retire-post.ts"`.

### 3. Verification & Test Suite
- **`tests/redirects-consolidation.test.ts`**:
  - 13 comprehensive unit tests covering:
    - Empty file, missing file, and corrupt JSON soft fallback in `loadRedirects`.
    - Atomic file saving and loading round trip.
    - Path format validation (leading slash enforcement).
    - Self-referential loop detection.
    - Duplicate source detection.
    - Direct circular pair detection.
    - Transitive multi-hop cycle detection.
    - Multi-hop chain warning and destination resolution.
    - Next.js config format mapping.
    - End-to-end post retirement: physical file move, registry shard transition to `'quarantined'`, audit report creation, and redirect persistence.
    - Dry-run mode non-mutation guarantee.
    - Missing source post and invalid destination fail-safe checks.

---

## Verification & Test Results

### 1. `tests/redirects-consolidation.test.ts` (13 tests passed)
- `loadRedirects`: returns empty array when file does not exist
- `loadRedirects`: returns empty array on invalid or corrupt JSON
- `loadRedirects & saveRedirects`: round trips valid redirect entries atomically
- `validateRedirectEntry`: catches missing leading slashes and malformed paths
- `validateRedirectEntry`: catches self-referential loop (A -> A)
- `validateRedirectEntry`: catches duplicate source rules
- `validateRedirectEntry`: catches direct circular pair (A -> B and B -> A)
- `validateRedirectEntry`: catches multi-hop transitive cycles (A -> B -> C -> A)
- `validateRedirectEntry`: warns on multi-hop chains (A -> B when B -> C exists)
- `formatForNextConfig`: maps entries to Next.js redirects format
- `retireAndRedirectPost`: successfully relocates post to quarantine, updates registry, and appends redirect
- `retireAndRedirectPost`: dry run validates without modifying disk
- `retireAndRedirectPost`: fails safely on missing source post or invalid destination

### 2. Full Regression & Template Checks
- `npm run check:template`: 6/6 published articles pass frontmatter and structure validation.
- `npm test`: 98/98 tests passed across all test suites with 0 failures.

---

## Threat Model Compliance

- **T-06-05 (Infinite Redirect Loops & Configuration Crashes):**
  - `validateRedirectEntry()` enforces that circular redirect paths (both direct and transitive) are blocked with descriptive error strings before being saved to `content/redirects.json`.
  - In `next.config.mjs`, `loadJsonRedirects()` wraps JSON parsing in try/catch and guarantees an empty array fallback on missing or corrupt files, ensuring Next.js builds never crash.
- **T-06-06 (Orphaned MDX Residuals & Search Index Duplication):**
  - Retiring a post relocates the `.mdx` file to `content/quarantine/` via `quarantineDraft()` and transitions the keyword registry entry to `'quarantined'`.
  - Removing the file from `content/posts/` instantly purges the slug from Content Collections and `app/sitemap.ts`, allowing search engines to follow the 301 redirect without conflicting canonicals or soft-404s.
