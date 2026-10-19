# Phase 7 Plan 04: Daily Autonomous Publisher & GitHub Actions Workflow Summary

**Executed Date:** 2026-10-19  
**Plan:** `07-04-PLAN.md`  
**Status:** Completed & Validated  
**Requirement Addressed:** NEWS-04  

---

## Executive Summary

Plan 07-04 delivered the master autonomous publishing engine and scheduled CI/CD workflow for the **Daily Tech & AI News Ingestion and Publishing** track (NEWS-04).

The platform now operates an autonomous daily publishing loop orchestrated by `scripts/publish-daily-news.ts` and automated via `.github/workflows/daily-news.yml` scheduled at 06:00 UTC daily. The runner coordinates the complete publishing lifecycle: multi-feed ingestion (Hacker News + Google News, TechCrunch, The Verge), 24-hour freshness gating, duplicate checking against `content/news/covered.json`, editorial scoring, LLM journalistic synthesis with anti-buzzword filtering, `draftSchema` frontmatter validation, MDX file emission to `content/posts/`, ledger and registry persistence, and dual-track search engine indexing dispatch (IndexNow for Bing/Yandex/Seznam and Google Search Console sitemap submission).

Strict daily idempotency guards prevent runaway publishing or duplicate runs on the same UTC day unless explicitly overridden by `--force`, and automated git commits with `[skip ci]` push content to `master` to immediately trigger Cloudflare Pages edge deployments.

---

## Delivered Components

### 1. Autonomous Daily News Publisher CLI (`scripts/publish-daily-news.ts`)
- Standalone CLI executable with flags:
  - `--dry-run`: Complete pipeline simulation without writing files or pinging indexers.
  - `--force`: Bypasses daily single-post idempotency guard for breaking news events.
  - `--mock`: Offline testing harness utilizing local XML/JSON fixtures.
  - `--feed=<source>`: Feed filtering for specific sources (`hn`, `google`, `techcrunch`, `verge`).
- Implemented `checkAlreadyPublishedToday(postsDir?: string, now: Date = new Date())`:
  - Inspects `content/posts/*.mdx` frontmatter (`silo === 'ai-news'` and UTC `publishedAt.slice(0, 10)`).
  - Returns `{ alreadyPublished: true, todaySlug }` if today's post already exists.
- Implemented `toRegistryId(slug: string)`:
  - Generates slug-safe registry ID conforming strictly to `/^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/` (max 120 chars).
- Master lifecycle orchestration:
  1. Idempotency check: exits cleanly with code 0 if already published today and not `--force`.
  2. Ingests and ranks stories via `aggregateDailyNews`.
  3. Synthesizes news article with anti-buzzword sanitization via `synthesizeNewsArticle`.
  4. Validates frontmatter and assembles MDX via `assembleNewsPostMdx`.
  5. Emits MDX file to `content/posts/${slug}.mdx`.
  6. Updates `content/news/covered.json` ledger.
  7. Updates `content/keywords/ai-news/registry.json` with stage: `'published'`.
  8. Dispatches dual-track indexing via `dispatchDualTrackIndexing`.
  9. Displays publication summary.

### 2. Package.json Script Wiring (`package.json`)
- Added npm script:
  ```json
  "news:publish": "tsx scripts/publish-daily-news.ts"
  ```

### 3. Scheduled Daily GitHub Actions Workflow (`.github/workflows/daily-news.yml`)
- Workflow name: `daily-news-publish`
- Scheduled trigger: `cron: '0 6 * * *'` (06:00 UTC daily, 7 days/week).
- Workflow dispatch inputs:
  - `force`: boolean (default `false`).
  - `dry_run`: boolean (default `false`).
- Environment secrets injection:
  - `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_CHEAP`
  - `INDEXNOW_KEY`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`
  - `NEXT_PUBLIC_SITE_URL`
- Automated Git commit & push:
  - Checks `git status --porcelain content/`
  - Commits with message `"publish(news): daily automated tech news release [skip ci]"`
  - Pushes to `origin master`, triggering edge deployment on Cloudflare Pages.

### 4. Comprehensive Automated Test Suite (`tests/news-publish.test.ts`)
- Test 1: `checkAlreadyPublishedToday` accurately detects same-day `ai-news` posts and ignores non-news silos or previous days.
- Test 2: `runDailyNewsPublisher` in dry-run mock mode completes without modifying disk or calling external networks.
- Test 3: Idempotency lock blocks duplicate runs on the same date unless `force: true`.
- Test 4: Force override successfully publishes additional posts on the same date.
- Test 5: Emits valid `CoveredEvent` to `covered.json` and valid `RegistryEntry` to `content/keywords/ai-news/registry.json`.
- Test 6: Emitted MDX frontmatter strictly conforms to `draftSchema`.
- Test 7: `toRegistryId` enforces registry regex constraint `/^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/`.

---

## Verification & Quality Gates

All project validation suites and checks passed:
- `npm test`: 152/152 tests passing (including all news ingestion, deduplication, scoring, synthesis, silo, and publishing tests).
- `npm run check:template`: 8/8 MDX posts passing frontmatter and structural rules.
- `npm run check:crawl`: 102 crawl checks passing across all routes and internal links.
- `npm run build`: Static site generation build succeeded across all 28 routes with zero TypeScript or compilation errors.

---

## Git Commit History
1. `feat(07-04): implement autonomous daily news publisher script and package.json wiring` (Commit `f3e165f`)
2. `feat(07-04): implement daily news GitHub Actions workflow and automated publish test suite` (Commit `7f6fb67`)
3. `fix(07-04): correct hnOptions limit parameter in daily news publisher` (Commit `c21f0d6`)
