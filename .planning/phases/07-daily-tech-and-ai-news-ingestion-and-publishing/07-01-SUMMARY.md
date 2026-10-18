# Phase 7 Plan 01: Multi-Feed News Aggregator & Deduplication Engine Summary

**Executed Date:** 2026-10-19  
**Plan:** `07-01-PLAN.md`  
**Status:** Completed & Validated  
**Requirement Addressed:** NEWS-01  

---

## Executive Summary

Plan 07-01 implemented the core multi-feed ingestion and deduplication engine powering TierOne AutoBlog's daily tech and AI news publishing capability under the Zero-Paid APIs mandate (D-01).

The engine queries public REST and XML feeds (Hacker News Firebase API, Google News RSS, TechCrunch RSS, and The Verge Atom XML), sanitizes and extracts structured items without native compilation dependencies, enforces a strict 24-hour freshness gate (D-02), and executes multi-tier deduplication against `content/news/covered.json` using URL canonicalization and 3-word shingle Jaccard similarity ($\ge 0.40$). Candidates are scored and ranked to surface breaking news with high developer interest.

---

## Delivered Components

### 1. Data Contracts & Interfaces (`lib/pipeline/news/types.ts`)
- Defined unified representations for news items:
  - `RawNewsItem`: Normalized payload with deterministic 16-character SHA-256 hash ID, sanitized title and summary, ISO 8601 publication timestamp, source identifier, and author attribution.
  - `CoveredEvent` / `CoveredStoryEntry`: Persistent ledger entry tracking covered articles, normalized titles, canonical domains, slugs, and keywords.
  - `CoveredLedger` / `NewsCoveredLedger`: Schema versioning and array of covered events.
  - `ScoredNewsCandidate` / `ScoredNewsItem`: Scored candidate with itemized breakdown (`hnPoints`, `crossFeedMentions`, `entityBonus`, `recencyBonus`, `totalScore`) and matched entity tokens.
  - `NewsFeedSource`: Specification for syndicated feeds.

### 2. Lightweight XML/Atom Parser (`lib/pipeline/news/parser.ts`)
- `cleanCdataAndEntities`: Unwraps CDATA sections (`<![CDATA[...]]>`), decodes named HTML entities (`&amp;`, `&lt;`, `&quot;`, `&#039;`, `&#8217;`, etc.), evaluates numeric and hex entities, strips HTML markup, and normalizes whitespace.
- `parseRssOrAtomXml` (and alias `parseXmlFeed`): Robust parser supporting both RSS 2.0 (`<item>`) and Atom 1.0 (`<entry>`) without native dependencies or C++ bindings. Handles attributes (`<link href="..." />`), extracts dates (`pubDate`, `published`, `updated`), and calculates deterministic IDs.

### 3. Feed Clients (`lib/pipeline/news/hn.ts`, `lib/pipeline/news/rss.ts`, `lib/pipeline/news/sources.ts`)
- `fetchHackerNewsStories` / `fetchHackerNewsTop`: Firebase REST API client querying `topstories.json` and resolving item details in parallel chunks of 10. Filters for score ($\ge 80$), 24-hour freshness, and AI/tech domain keywords regex.
- `fetchRssFeed` & `fetchRssFeeds`: Configured with canonical feeds (Google News, TechCrunch, The Verge, Ars Technica). Implements parallel fetching with per-request timeouts (8000ms) and error isolation so failing individual feeds do not halt aggregation.

### 4. Freshness Gate & Deduplication Engine (`lib/pipeline/news/dedup.ts`)
- `isWithinFreshnessWindow` & `filterFreshNews`: Enforces strict 24-hour freshness cutoff ($24 \times 60 \times 60 \times 1000\text{ ms}$).
- `normalizeUrl`: Strips tracking parameters (`utm_*`, `ref`, `source`, `fbclid`, `gclid`), protocols, `www.`, hash fragments, and trailing slashes.
- `tokenizeTitle` & `generate3WordShingles`: Extracts clean alphanumeric tokens, removes common stop words, and generates contiguous 3-word n-gram shingles.
- `calculateJaccardSimilarity`: Computes exact set intersection over union.
- `isStoryDuplicate`: Multi-tier duplicate detector inspecting canonical URL equality, 14-day rolling window shingle Jaccard overlap ($\ge 0.40$), and high-density entity token overlap.

### 5. Persistent Ledger & Scoring Aggregator (`lib/pipeline/news/ledger.ts`, `lib/pipeline/news/scorer.ts`, `lib/pipeline/news/aggregator.ts`)
- `loadCoveredLedger`, `saveCoveredLedger`, `recordCoveredStory`: Manages `content/news/covered.json`.
- `scoreNewsItem`: Multi-factor prioritization algorithm applying HN upvote multipliers ($1.5\times$), cross-feed validation bonus (+40 per co-reporting source), high-intent Tier-1 entity bonus (+50 for 1 entity, +80 for $\ge 2$ entities from OpenAI, Anthropic, Gemini, Claude, Cursor, Nvidia, etc.), and recency boosts ($\max(0, 24 - \text{ageHours}) \times 3$).
- `rankNewsCandidates`: Filters stale and duplicate items, scores all candidates, and sorts descending by total score.
- `aggregateDailyNews`: Master coordinator ingesting HN and RSS feeds, running deduplication and scoring, and surfacing the #1 top candidate story.

### 6. Offline Mock Fixtures & Automated Test Suites
- Static test fixtures created in `tests/fixtures/news/`:
  - `hn-topstories.json` & `hn-items.json`
  - `google-news.xml`
  - `techcrunch.xml`
  - `theverge.xml`
- `tests/news-ingestion.test.ts` (8 passing unit tests)
- `tests/news-dedup.test.ts` (11 passing unit tests)
- All 127 repository tests pass with 0 failures (`npm test`).

---

## Verification & Test Results

```
✔ cleanCdataAndEntities handles CDATA, entities, and HTML tags
✔ cleanCdataAndEntities handles malformed or empty inputs gracefully
✔ parseRssOrAtomXml parses RSS 2.0 feeds correctly (Google News & TechCrunch)
✔ parseRssOrAtomXml parses Atom 1.0 feeds correctly (The Verge)
✔ parseRssOrAtomXml returns empty array for invalid or non-xml input
✔ fetchHackerNewsStories filters for score, AI keywords, and 24h freshness
✔ fetchHackerNewsStories handles network failure gracefully without throwing
✔ fetchRssFeed handles network error gracefully
✔ isWithinFreshnessWindow validates 24-hour cutoff accurately
✔ filterFreshNews filters out items exceeding maxAgeHours
✔ normalizeUrl strips tracking parameters, protocol, www, and trailing slash
✔ extractDomain retrieves canonical host
✔ tokenizeTitle and generate3WordShingles create contiguous 3-grams
✔ calculateJaccardSimilarity computes accurate set similarity
✔ isStoryDuplicate detects duplicates via URL, shingle similarity, and entity overlap
✔ loadCoveredLedger and recordCoveredStory persist stories to disk
✔ scoreNewsItem weights HN points, entities, cross-mentions, and recency
✔ rankNewsCandidates sorts highest value candidates first
✔ aggregateDailyNews orchestrates end-to-end multi-feed ingestion with mocks
```

---

## Commits
1. `feat(07-01): implement news feed types, XML/Atom parser, and feed clients` (`c642af1`)
2. `feat(07-01): implement 24h freshness filter, shingle deduplication, and news aggregator` (`6311c3d`)
