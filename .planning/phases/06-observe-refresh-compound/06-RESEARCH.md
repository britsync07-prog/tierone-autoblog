# Phase 6: Observe, Refresh + Compound - Technical Research & Architecture

**Created:** 2026-10-18  
**Status:** Complete & Validated  
**Target Architecture:** Next.js 16 App Router (React 19, Server Components), Google Search Console Search Analytics API (`googleapis`), Plausible Stats API, Node 22+ Test Runner  
**Primary Output Target:** `D:/myapps/blogs/.planning/phases/06-observe-refresh-compound/06-RESEARCH.md`

---

## Executive Summary

Phase 6 implements the **compounding growth and observation engine** for TierOne AutoBlog. Building on the autonomous publishing pipeline established in Phase 5, Phase 6 closes the feedback loop between search performance and editorial automation. Operating strictly under the **fully-free platform constraint** (no paid SEO subscriptions, DataForSEO out; free/self-hosted tiers and deterministic offline fallbacks only), this phase delivers:

1. **Owner-Facing Growth Analytics Dashboard (`/dashboard`)**:
   - Gated Next.js 16 App Router Server Component accessible only via a secret token (`?token=...` matching `process.env.DASHBOARD_SECRET`). Unauthorized attempts trigger an immediate `notFound()` (HTTP 404) to prevent metric exposure to scrapers.
   - Sourced from Google Search Console Search Analytics API (country × page × query) and Plausible Stats API, with automatic fallback to cached snapshots (`content/analytics/snapshot.json`) or deterministic synthetic data when API keys are absent.
   - Headline metrics: Tier-1 Search & Engagement Share (US, UK, CA, AU) and the live Indexed-vs-Submitted Ratio against the $\ge 70\%$ health target.
2. **Autonomous Striking-Distance & Content Decay Refresh Engine**:
   - Algorithmic detection of striking-distance queries (positions 5.0–20.0 with $\ge 50$ impressions over 28 days) and decaying content (>90 days old with $\ge 25\%$ traffic loss comparing 30d vs prior 30d).
   - Structured queue management in `content/keywords/refresh-queue.json`.
   - Safe automated refresh actions: updating frontmatter `updatedAt` (emitted as `dateModified` in schema.org JSON-LD), injecting high-value FAQ questions derived from real queries (conforming to the strict 3–5 FAQ frontmatter limit), and repairing broken outbound links.
3. **Data-Driven 301 Redirect Consolidation & Post Retirement**:
   - Machine-managed redirect registry at `content/redirects.json` dynamically ingested by Next.js `next.config.mjs` `redirects()`.
   - Automated post retirement: moving cannibalized posts out of `content/posts/` into `content/quarantine/{slug}.mdx` via `quarantineDraft` and marking registry stage as `'quarantined'`, preventing build clutter and index duplication.
4. **Publishing Velocity Scaling Governor (`lib/pipeline/publish/governor.ts`)**:
   - Strict 4-point gate preventing the cadence from expanding to daily (7 posts/week) until 60-day operational maturity is proven:
     1. Domain operating age $\ge 60$ days from first published article.
     2. GSC indexed-vs-submitted ratio $\ge 70\%$.
     3. Circuit breaker unpaused with 0 trips in the preceding 30 days.
     4. Active corpus floor $\ge 10$ live indexed articles.
   - Integrated into `scripts/publish-scheduled.ts`: on non-scheduled days (Tue, Thu, Sat), exits cleanly with code 0 if locked; unlocks automatically to daily once all 4 criteria pass.
5. **Pillar Hub Dynamic Promotion & Automated Link Mesh**:
   - Dynamic promotion of silo landing pages (`app/[silo]/page.tsx`) into rich Pillar Hubs once a silo reaches $\ge 8$ published articles (up to 12).
   - Introduces thematic clustering, spoke directories, and enhanced `CollectionPage` JSON-LD schema.
   - Queues and drafts cornerstone pillar guides (`/blog/{silo}-complete-guide`) with bidirectional link mesh updating spoke frontmatter and contextual cross-links.

---

## 1. Google Search Console Search Analytics API

### 1.1 API Client, Endpoints & Authentication

The Google Search Console API is accessed via the official `googleapis` package (v186.0.0, already installed). In Phase 5, `lib/pipeline/indexing/google-search-console.ts` established service account authentication for sitemap submission. Phase 6 extends this integration to query performance analytics and sitemap indexation status.

- **Library**: `googleapis` (Node.js official SDK)
- **Service Name & Version**: `google.searchconsole({ version: 'v1', auth })`
- **Required OAuth Scopes**:
  - Read-Only: `'https://www.googleapis.com/auth/webmasters.readonly'`
  - Read/Write (already used in Phase 5): `'https://www.googleapis.com/auth/webmasters'`
- **Authentication**: `google.auth.GoogleAuth` consuming service account email and private key:
  ```typescript
  import { google } from 'googleapis';

  export function getGscAuth(clientEmail?: string, privateKey?: string) {
    const email = (clientEmail ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)?.trim();
    const rawKey = (privateKey ?? process.env.GOOGLE_PRIVATE_KEY)?.trim();

    if (!email || !rawKey || email === 'undefined' || rawKey === 'undefined') {
      return null;
    }

    const key = rawKey.replace(/\\n/g, '\n');
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key,
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
  }
  ```

### 1.2 Multi-Dimensional Search Analytics Query (`country × page × query`)

To calculate country-specific metrics, Tier-1 share, striking-distance queries, and page-level decay, the pipeline executes a multi-dimensional query over the search analytics endpoint:

- **Method**: `searchconsole.searchanalytics.query`
- **Request Parameters**:
  ```typescript
  export interface GscAnalyticsQueryOptions {
    siteUrl: string;
    startDate: string; // 'YYYY-MM-DD'
    endDate: string;   // 'YYYY-MM-DD'
    dimensions?: ('country' | 'page' | 'query' | 'device' | 'date')[];
    rowLimit?: number; // Max 25,000 per request (default: 5,000)
    startRow?: number;
    dimensionFilterGroups?: Array<{
      groupType?: string;
      filters: Array<{
        dimension: string;
        operator: 'contains' | 'equals' | 'notEquals' | 'notContains';
        expression: string;
      }>;
    }>;
  }
  ```
- **Calling Interface**:
  ```typescript
  const auth = getGscAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const response = await searchconsole.searchanalytics.query({
    siteUrl: formattedSiteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['country', 'page', 'query'],
      rowLimit: 5000,
    },
  });
  ```
- **Response Row Schema**:
  ```typescript
  export interface GscSearchAnalyticsRow {
    keys: [string, string, string]; // [country, page, query]
    country: string; // ISO 3166-1 alpha-3 lowercase (e.g. 'usa')
    page: string;    // Full URL (e.g. 'https://exclusivesources.online/blog/chatgpt-vs-claude')
    query: string;   // User search query (e.g. 'chatgpt vs claude for coding')
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }
  ```

### 1.3 Country Code Normalization & Tier-1 Mapping

Google Search Console returns country codes in **ISO 3166-1 alpha-3 lowercase format** (e.g., `'usa'`, `'gbr'`, `'can'`, `'aus'`). This differs from Plausible and standard ISO alpha-2 codes.

The system normalizes all country codes to standard Tier-1 keys:

```typescript
export type Tier1Geo = 'US' | 'UK' | 'CA' | 'AU';

export const GSC_TIER1_MAP: Record<string, Tier1Geo> = {
  usa: 'US',
  gbr: 'UK',
  can: 'CA',
  aus: 'AU',
};

export function isGscTier1(countryCode: string): boolean {
  return countryCode.toLowerCase() in GSC_TIER1_MAP;
}

export function normalizeGscCountry(countryCode: string): string {
  const lower = countryCode.toLowerCase();
  return GSC_TIER1_MAP[lower] ?? lower.toUpperCase();
}
```

### 1.4 Sitemap Indexation Ratio Query

Google Search Console provides sitemap processing metrics through the `sitemaps.list` endpoint:

- **Method**: `searchconsole.sitemaps.list({ siteUrl: formattedSiteUrl })`
- **Data Extracted**:
  ```typescript
  export interface SitemapCoverageResult {
    submitted: number;
    indexed: number;
    ratio: number; // indexed / submitted (e.g. 0.82)
    sitemaps: Array<{
      path: string;
      lastSubmitted?: string;
      isPending?: boolean;
      warnings?: number;
      errors?: number;
      contents?: Array<{ type: string; submitted: number; indexed: number }>;
    }>;
  }
  ```
- **Indexation Ratio Computation**:
  ```typescript
  let totalSubmitted = 0;
  let totalIndexed = 0;

  for (const sitemap of response.data.sitemap || []) {
    for (const content of sitemap.contents || []) {
      if (content.type === 'web') {
        totalSubmitted += Number(content.submitted || 0);
        totalIndexed += Number(content.indexed || 0);
      }
    }
  }

  const ratio = totalSubmitted > 0 ? totalIndexed / totalSubmitted : 0;
  ```

### 1.5 Deterministic Offline Fallback & Snapshot Strategy

Under the owner's fully-free directive, external credentials may be unprovisioned in development, local testing, or during API quota hiccups. The system MUST NEVER throw or crash the dashboard.

1. **Snapshot File**: `content/analytics/snapshot.json`.
2. **Resolution Cascade**:
   - Step 1: Check if `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` exist. If yes, query live GSC.
   - Step 2: If credentials fail or are absent, attempt to read `content/analytics/snapshot.json`.
   - Step 3: If `snapshot.json` is missing or unreadable, invoke `generateSyntheticAnalytics()` to produce deterministic, realistic data based on the current published posts in `content/posts/` and registry shards.

---

## 2. Plausible Analytics Stats API

### 2.1 API Endpoint & Authentication

Plausible Analytics provides a lightweight, privacy-focused REST API for aggregate and breakdown statistics.

- **Base URL**: `https://plausible.io/api/v1/stats/`
- **Breakdown Endpoint**: `https://plausible.io/api/v1/stats/breakdown`
- **Aggregate Endpoint**: `https://plausible.io/api/v1/stats/aggregate`
- **Authentication**: Bearer Token via HTTP header:
  ```http
  Authorization: Bearer ${PLAUSIBLE_API_KEY}
  ```
- **Site ID**: Specified via query param `site_id=${siteId}` (defaults to domain hostname, e.g. `exclusivesources.online`).

### 2.2 Country Breakdown & Engagement Metrics

To evaluate Tier-1 audience share and reader engagement (bounce rate, visit duration):

- **Query Parameters**:
  - `site_id`: `exclusivesources.online`
  - `period`: `30d` (or `7d`, `custom`)
  - `property`: `visit:country`
  - `metrics`: `visitors,visits,pageviews,bounce_rate,visit_duration`
- **Plausible Response Payload**:
  ```json
  {
    "results": [
      { "country": "US", "visitors": 3420, "visits": 3810, "bounce_rate": 41.2, "visit_duration": 184 },
      { "country": "GB", "visitors": 1280, "visits": 1410, "bounce_rate": 43.5, "visit_duration": 162 },
      { "country": "CA", "visitors": 690,  "visits": 760,  "bounce_rate": 39.8, "visit_duration": 195 },
      { "country": "AU", "visitors": 440,  "visits": 485,  "bounce_rate": 44.0, "visit_duration": 170 },
      { "country": "DE", "visitors": 210,  "visits": 230,  "bounce_rate": 58.0, "visit_duration": 95 },
      { "country": "FR", "visitors": 180,  "visits": 195,  "bounce_rate": 62.0, "visit_duration": 82 }
    ]
  }
  ```
- **Country Code Standard**: Plausible returns **ISO 3166-1 alpha-2 uppercase** (`'US'`, `'GB'`, `'CA'`, `'AU'`).
  - Tier-1 Set: `['US', 'GB', 'CA', 'AU']`.

### 2.3 Tier-1 Share Calculation

```typescript
export interface PlausibleCountryStats {
  country: string; // 'US', 'GB', 'CA', 'AU', etc.
  visitors: number;
  visits: number;
  bounceRate: number;    // Percentage (0-100)
  visitDuration: number; // Seconds
}

export interface PlausibleEngagementSummary {
  totalVisitors: number;
  tier1Visitors: number;
  tier1Share: number; // (tier1Visitors / totalVisitors) * 100
  breakdown: Record<'US' | 'UK' | 'CA' | 'AU' | 'OTHER', {
    visitors: number;
    share: number;
    bounceRate: number;
    avgDurationSec: number;
  }>;
}
```

### 2.4 Offline Resilience

When `PLAUSIBLE_API_KEY` is not present in `process.env`:
- Logs informative notice `[plausible] PLAUSIBLE_API_KEY unset; loading analytics snapshot or deterministic engagement synthetic`.
- Merges engagement numbers from `content/analytics/snapshot.json`.

---

## 3. Protected Dashboard Route (`app/dashboard/page.tsx`)

### 3.1 Next.js 16 App Router Server Component & Auth Gate

The dashboard displays proprietary search rankings, CTRs, and competitor query angles. It must remain strictly confidential and completely hidden from search engine crawlers and automated vulnerability scanners.

#### Architectural Rules:
1. **Server Component by Default**: `app/dashboard/page.tsx` runs entirely on the server. Zero client-side JavaScript is shipped to render charts or tables.
2. **Next.js 16 Async `searchParams` Contract**: In Next.js 16, page properties receive `searchParams` as a `Promise`:
   ```typescript
   export interface DashboardPageProps {
     searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
   }
   ```
3. **Secret Token Authentication**:
   - Checked against `process.env.DASHBOARD_SECRET`.
   - Accessible via URL query parameter: `https://<domain>/dashboard?token=<DASHBOARD_SECRET>`.
4. **404 Fail-Closed Pattern**:
   - If `process.env.DASHBOARD_SECRET` is unset, or if `token !== process.env.DASHBOARD_SECRET`, the page calls `notFound()` from `next/navigation`.
   - Calling `notFound()` renders Next.js's standard 404 page, preventing attackers or scrapers from discovering whether the `/dashboard` route even exists.
5. **No Robots Indexing**:
   - The route exports `generateMetadata()` specifying `robots: { index: false, follow: false }`.

```typescript
// app/dashboard/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics & Compounding Dashboard | Private',
  robots: { index: false, follow: false },
};

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === 'string' ? searchParams.token : undefined;
  const secret = process.env.DASHBOARD_SECRET;

  if (!secret || token !== secret) {
    notFound();
  }

  // Render Server Component dashboard
  ...
}
```

### 3.2 Visual UI Architecture (Tailwind CSS, Zero Client JS)

The dashboard layout is designed with Tailwind CSS, utilizing clean semantic markup, cards, and responsive tables:

```
+--------------------------------------------------------------------------------------------------+
|  TierOne AutoBlog - Growth & Compounding Dashboard                    [Mode: Live API / Snapshot] |
+--------------------------------------------------------------------------------------------------+
|  CARD 1: Tier-1 Search & Traffic Share      |  CARD 2: Google Indexation Ratio                   |
|  86.4%                                      |  81.8%  [HEALTHY >=70%]                            |
|  US: 58.2% | UK: 17.5% | CA: 6.5% | AU: 4.2%|  9 / 11 Published URLs Indexed                     |
+---------------------------------------------+----------------------------------------------------+
|  CARD 3: Publishing Velocity Governor       |  CARD 4: Content Health & Refresh Queue            |
|  Throttled (4x/week)                        |  4 Actionable Items in Queue                       |
|  Domain Age: 38 / 60 days (22 days to gate) |  3 Striking-Distance Queries | 1 Content Decay     |
+--------------------------------------------------------------------------------------------------+
|  TABLE: Striking-Distance Opportunities (Positions 5.0 - 20.0 with >= 50 Impressions)            |
|  Query                       | Target Page               | Avg Pos | 28d Impr | 28d Clicks | Action |
+------------------------------+---------------------------+---------+----------+------------+--------+
|  TABLE: Content Decay Radar (>= 90 Days Old, >= 25% Traffic Loss)                               |
|  Post Slug                   | Silo         | 30d Impr  | Prev 30d | Drop %   | Action Required    |
+--------------------------------------------------------------------------------------------------+
|  TABLE: Active 301 Permanent Redirects (content/redirects.json)                                   |
|  Source Path                 | Destination               | Reason               | Retired Date   |
+--------------------------------------------------------------------------------------------------+
```

---

## 4. Striking-Distance & Content Decay Detection Engine

### 4.1 Striking-Distance Math & Heuristics

Striking-distance keywords represent search queries where Google has already recognized topical relevance (ranking on page 2 or bottom of page 1), but the article has not yet claimed a top-3 ranking. A small infusion of relevance (FAQ addition, heading expansion, updated date) often pushes these into top positions.

- **Lookback Window**: Last 28 days (`endDate = yesterday`, `startDate = 28 days ago`).
- **Eligibility Criteria**:
  1. Average position between 5.0 and 20.0:
     $$5.0 \le \text{position} \le 20.0$$
  2. Substantial search demand threshold:
     $$\text{impressions} \ge 50$$
- **Opportunity Score Formula**:
  $$\text{OpportunityScore} = \text{impressions} \times (21.0 - \text{position})$$
  *(Queries at position 5.1 with 200 impressions score higher than queries at position 18.0 with 50 impressions).*

### 4.2 Content Decay Math & Detection

Content decay occurs when older evergreen posts gradually lose search impressions or clicks due to competitor freshness updates or changing search intent.

- **Lookback Windows**:
  - Period A (Current): Last 30 days ($T_{-30}$ to $T_0$).
  - Period B (Prior Baseline): Preceding 30 days ($T_{-60}$ to $T_{-30}$).
- **Eligibility Criteria**:
  1. Operating Age: Post published at least 90 days ago:
     $$\text{Age} = \text{now} - \text{publishedAt} \ge 90\text{ days}$$
  2. Baseline Traffic Threshold:
     $$\text{Impressions}_B \ge 100$$
     *(Prevents false positives on low-volume posts).*
  3. Decay Percentage Threshold:
     $$\Delta_{\text{impr}} = \frac{\text{Impressions}_B - \text{Impressions}_A}{\text{Impressions}_B} \ge 0.25 \quad (25\%\text{ loss})$$
     OR
     $$\Delta_{\text{clicks}} = \frac{\text{Clicks}_B - \text{Clicks}_A}{\text{Clicks}_B} \ge 0.25 \quad (25\%\text{ loss})$$

### 4.3 Refresh Queue Storage Format (`content/keywords/refresh-queue.json`)

Items identified by the detection engine are serialized into `content/keywords/refresh-queue.json`:

```typescript
export type RefreshActionType =
  | 'bump-date-modified'
  | 'inject-faq'
  | 'repair-links'
  | 'consolidate-301';

export interface RefreshQueueItem {
  id: string; // Unique deterministic ID e.g. "refresh-chatgpt-vs-claude-2026-10"
  slug: string;
  silo: SiloSlug;
  type: 'striking-distance' | 'content-decay';
  priority: number; // 1 to 10 (10 being highest priority)
  detectedAt: string; // ISO datetime
  status: 'pending' | 'applied' | 'quarantined';
  appliedAt?: string;
  diagnostics: {
    currentImpressions: number;
    priorImpressions?: number;
    impressionsDropPct?: number;
    queries?: Array<{
      query: string;
      position: number;
      impressions: number;
      clicks: number;
    }>;
    brokenLinks?: string[];
  };
  suggestedActions: Array<{
    action: RefreshActionType;
    faqItem?: { q: string; a: string };
    targetDestination?: string;
    details?: string;
  }>;
}

export interface RefreshQueueFile {
  version: 1;
  updatedAt: string;
  items: RefreshQueueItem[];
}
```

### 4.4 Autonomous Refresh Execution & Frontmatter Constraints

When the refresh runner (`scripts/run-content-refresh.ts`) executes, it applies safe, non-destructive updates to eligible articles in `content/posts/{slug}.mdx`:

1. **Date Modified Bump**:
   - Updates `updatedAt` in frontmatter to `new Date().toISOString()`.
   - Note: In `lib/pipeline/draft-schema.ts`, the field is named `updatedAt`. In `lib/seo/jsonld.ts`, this is mapped to Schema.org `dateModified`.
2. **FAQ Injection with Strict Boundary Adherence**:
   - `draftSchema` in `lib/pipeline/draft-schema.ts` strictly enforces:
     ```typescript
     faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(3).max(5)
     ```
   - **Boundary Guard**: If a post already has 5 FAQ items, the engine MUST NOT append a 6th item (which would violate schema and break the build). Instead, it either:
     - Replaces the least relevant FAQ item with the newly synthesized striking-distance FAQ, or
     - Retains the existing 5 and records the suggestion in diagnostics.
3. **Broken Outbound Link Repair**:
   - Scans markdown links in the post body.
   - Any external link returning 404/5xx is either updated to an authoritative homepage or removed as an active hyperlink while keeping the text intact.
4. **Atomic Write & Git History**:
   - Rewrites MDX file atomically.
   - Marks the queue item as `'applied'`.

---

## 5. Data-Driven 301 Redirect Consolidation & Next.js Integration

### 5.1 Redirect Registry Specification (`content/redirects.json`)

When two articles cannibalize each other's search rankings, or when a weaker post is folded into a cornerstone pillar guide, the system consolidates them via a permanent HTTP 301 redirect.

- **File Path**: `content/redirects.json`
- **Schema**:
  ```typescript
  export interface RedirectEntry {
    source: string;       // e.g. "/blog/chatgpt-prompts-old"
    destination: string;  // e.g. "/blog/ai-writing-complete-guide"
    permanent: boolean;   // true for 301 Permanent Redirect
    reason?: string;      // e.g. "Consolidation into pillar hub cornerstone"
    retiredAt?: string;   // ISO datetime
  }
  ```
- **Example `content/redirects.json`**:
  ```json
  [
    {
      "source": "/blog/jasper-vs-copy-ai-draft",
      "destination": "/blog/best-ai-writing-tools-2026",
      "permanent": true,
      "reason": "Cannibalized by best-ai-writing-tools-2026",
      "retiredAt": "2026-10-18T14:00:00.000Z"
    }
  ]
  ```

### 5.2 Next.js App Router Integration in `next.config.mjs`

Next.js App Router supports declarative server-side redirects via `async redirects()` in `next.config.mjs`.

- **Implementation in `next.config.mjs`**:
  ```javascript
  import { readFileSync, existsSync } from 'node:fs';
  import { resolve } from 'node:path';

  function loadJsonRedirects() {
    try {
      const redirectsFile = resolve('content/redirects.json');
      if (!existsSync(redirectsFile)) return [];
      const raw = readFileSync(redirectsFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({
        source: item.source,
        destination: item.destination,
        permanent: item.permanent ?? true,
      }));
    } catch (err) {
      console.warn('[next.config.mjs] Failed to load content/redirects.json:', err);
      return [];
    }
  }

  const nextConfig = {
    ...
    async redirects() {
      return loadJsonRedirects();
    },
  };
  ```

### 5.3 Physical Post Retirement & Quarantine Integration

Redirecting a URL is only half the battle. If the old `.mdx` file remains in `content/posts/`, `@content-collections` will continue to compile it into the build, generate a static HTML page, and include it in `sitemap.xml`, resulting in duplicate content and crawl confusion.

To properly retire a post:
1. **Physical File Isolation**:
   - The `.mdx` file is removed from `content/posts/{slug}.mdx` and relocated to `content/quarantine/{slug}.mdx` using `quarantineDraft()` from `lib/pipeline/qa/quarantine.ts`.
2. **Registry Stage Transition**:
   - The keyword entry in `content/keywords/{silo}/registry.json` is transitioned from `'published'` to `'quarantined'`:
   - `lib/pipeline/registry.ts` already permits this exact transition:
     ```typescript
     if (to === 'quarantined') {
       if (from !== 'drafted' && from !== 'published') {
         fail(`invalid stage transition '${from}' -> 'quarantined'`);
       }
       return;
     }
     ```
   - Sets `quarantine.failedRule = '301-consolidated'` and `quarantine.reportPath = 'content/redirects.json'`.
3. **Sitemap Removal**:
   - Because `@content-collections` only scans `content/posts/*.mdx`, moving the file automatically removes the slug from `app/sitemap.ts`, guaranteeing that search engines see the 301 redirect and update their indices.

---

## 6. Publishing Velocity Scaling Governor (`lib/pipeline/publish/governor.ts`)

### 6.1 The 4-Point Baseline Criteria

Publishing velocity starts at **4 articles per week** (Mon, Wed, Fri, Sun at 06:00 UTC) during the domain's bootstrap phase. Google penalizes brand-new domains that suddenly publish hundreds of AI-generated articles per month without established crawl history.

The velocity scaling governor acts as an automated lock. Daily publishing (7 posts/week) is barred until all four health criteria are met simultaneously:

```
+-----------------------------------------------------------------------------------------+
|                                4-POINT VELOCITY GOVERNOR GATE                           |
+-----------------------------------------------------------------------------------------+
| 1. Domain Operating Age >= 60 Days                                                      |
|    - Elapsed time between now and earliest publishedAt in any silo shard >= 60 days.     |
+-----------------------------------------------------------------------------------------+
| 2. GSC Indexation Ratio >= 70%                                                          |
|    - totalIndexed / totalSubmitted >= 0.70 across all sitemaps.                         |
+-----------------------------------------------------------------------------------------+
| 3. Operational Stability (Circuit Breaker Clean)                                        |
|    - pipeline-state.json is unpaused (paused === false).                                |
|    - Exactly 0 circuit-breaker trips in the preceding 30 days.                          |
+-----------------------------------------------------------------------------------------+
| 4. Active Corpus Floor >= 10 Live Articles                                              |
|    - At least 10 articles currently in stage 'published' with verified live indexation. |
+-----------------------------------------------------------------------------------------+
```

### 6.2 Governor Engine Interface (`lib/pipeline/publish/governor.ts`)

```typescript
export interface GovernorEvaluation {
  unlocked: boolean; // True ONLY if all 4 checks pass
  domainAgeDays: number;
  domainAgePassed: boolean;
  indexationRatio: number;
  indexationPassed: boolean;
  circuitBreakerTrips30d: number;
  stabilityPassed: boolean;
  activeCorpusCount: number;
  corpusPassed: boolean;
  reasons: string[]; // Explanations if locked
}

export interface GovernorCheckOptions {
  keywordsDir?: string;
  siteUrl?: string;
  now?: Date;
  mockGscRatio?: number;
}

export function checkVelocityGovernor(options?: GovernorCheckOptions): GovernorEvaluation {
  ...
}
```

### 6.3 Scheduled Publisher Integration (`scripts/publish-scheduled.ts`)

In Phase 5, `scripts/publish-scheduled.ts` executes whenever triggered. To enforce the 4-post vs 7-post cadence safely without requiring modifications to GitHub Actions cron syntax:

1. **GitHub Actions Schedule**: Runs daily at 06:00 UTC:
   ```yaml
   schedule:
     - cron: '0 6 * * *' # Daily at 06:00 UTC
   ```
2. **Scheduled vs Non-Scheduled Days**:
   - Baseline Scheduled Days (4x/week): Monday, Wednesday, Friday, Sunday (`[1, 3, 5, 0]` in JS `Date.getDay()`).
   - Non-Scheduled Days: Tuesday, Thursday, Saturday (`[2, 4, 6]`).
3. **Execution Guard in `scripts/publish-scheduled.ts`**:
   ```typescript
   const todayDay = new Date().getDay();
   const isBaselineDay = [0, 1, 3, 5].includes(todayDay); // Sun, Mon, Wed, Fri

   if (!isBaselineDay) {
     const governor = checkVelocityGovernor({ keywordsDir });
     if (!governor.unlocked) {
       console.log(
         `[governor] Velocity gate locked (<60d baseline): skipping non-scheduled daily publish.`
       );
       console.log(`[governor] Status: ${governor.reasons.join('; ')}`);
       process.exit(0); // Clean exit, no error, no DLQ record
     }
     console.log(`[governor] 60-day baseline criteria MET. Publishing unlocked 7 days/week.`);
   }
   ```
4. **Zero-Configuration Autonomous Graduation**:
   - While the site is young, Tuesday, Thursday, and Saturday runs cleanly exit with status 0.
   - Once all 4 criteria pass (day 61+ with good indexation and no errors), the governor automatically unlocks and allows Tuesday, Thursday, and Saturday runs to publish candidates, immediately scaling publishing to daily with zero manual code or cron updates.

---

## 7. Pillar Hub Dynamic Promotion & Automated Link Mesh

### 7.1 Silo Cluster Threshold & Dual Promotion Pattern

Topical authority compounds when individual articles (spokes) cluster around an authoritative cornerstone page (pillar).

- **Threshold**: Silo accumulates **$\ge 8$ published articles** (up to 12).
- **Dual Promotion**:
  1. **Dynamic Landing Page Promotion (`app/[silo]/page.tsx`)**:
     - Automatically transitions from a simple reverse-chronological list into a **Comprehensive Pillar Hub**.
     - Sections:
       - Authority Hero Banner with Silo Intro Prose.
       - Cornerstone Guide Feature Card.
       - Thematic Sub-Clusters (e.g. "Comparisons & Head-to-Head", "Workflow Tutorials", "Prompt Engineering").
       - Full Spoke Directory with reading times and dates.
     - Upgraded Structured Data: Emits Schema.org `CollectionPage` JSON-LD with `hasPart` linking all published spokes.
  2. **Cornerstone Guide Creation**:
     - When a silo reaches $\ge 8$ posts, if a cornerstone post does not already exist, the system queues a flagship guide in `content/keywords/{silo}/registry.json`:
       - Slug: `/blog/{silo}-complete-guide`
       - Keyword: `"best ${silo.label} tools & workflows: complete guide (2026)"`
       - Target word count: 2,500–3,500 words.

### 7.2 Automated Bidirectional Link Mesh

An orphan article has zero internal backlinks and struggles to rank. The pillar promotion engine automates a bidirectional mesh:

```
                  +-----------------------------------+
                  |      Pillar Hub (/{silo})         |
                  |  CollectionPage Schema + Overview |
                  +-----------------+-----------------+
                                    |
                        Bidirectional Link Mesh
                                    |
                  +-----------------v-----------------+
                  | Cornerstone Guide (/blog/{silo}-*) |
                  +-----------------+-----------------+
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
+---------v---------+     +---------v---------+     +---------v---------+
| Spoke Article 1   |     | Spoke Article 2   |     | Spoke Article N   |
| (/blog/chatgpt-*) |     | (/blog/claude-*)  |     | (/blog/copilot-*) |
+-------------------+     +-------------------+     +-------------------+
```

1. **Downlink**: The Pillar Hub and Cornerstone Guide explicitly link to every published spoke within the silo.
2. **Uplink**: Every spoke post includes:
   - Breadcrumb navigation pointing to the Pillar Hub: `Home / {Silo} / {Title}`.
   - Contextual body link back to the Pillar Hub or Cornerstone Guide.
   - Frontmatter `relatedPosts` prioritizing sibling spokes in the same cluster.

### 7.3 Enhanced `CollectionPage` JSON-LD Schema

In `lib/seo/jsonld.ts`, introduce `buildCollectionPageJsonLd`:

```typescript
export function buildCollectionPageJsonLd(silo: Silo, posts: Post[], canonical: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: clean(silo.landingTitle),
    description: clean(silo.metaDescription),
    url: canonical,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    hasPart: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: clean(post.title),
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
    })),
  };
}
```

---

## 8. Validation Architecture

### 8.1 Nyquist Compliance & Test Matrix

To fulfill the project's quality mandates, every requirement in Phase 6 is paired with dedicated automated tests running under Node's native test runner (`node:test` + `node:assert/strict` via `tsx`):

| Requirement | Test File | Test Case Description | Expected Result |
|---|---|---|---|
| **GROW-01** | `tests/dashboard-route.test.ts` | Unauthorized access without token | Calls `notFound()` (HTTP 404). |
| **GROW-01** | `tests/dashboard-route.test.ts` | Unauthorized access with invalid token | Calls `notFound()` (HTTP 404). |
| **GROW-01** | `tests/dashboard-route.test.ts` | Authorized access with `?token=${DASHBOARD_SECRET}` | Renders 200 OK with Tier-1 headline and index ratio. |
| **GROW-01** | `tests/dashboard-route.test.ts` | Offline fallback resilience (no GSC/Plausible keys) | Loads `content/analytics/snapshot.json` or synthetic data cleanly. |
| **GROW-02** | `tests/refresh-decay.test.ts` | Striking-distance detection (pos 5.0–20.0, impr $\ge 50$) | Identifies eligible queries, computes opportunity scores. |
| **GROW-02** | `tests/refresh-decay.test.ts` | Content decay detection ($\ge 90$d age, $\ge 25\%$ drop) | Flags decaying posts when current 30d < 75% of prior 30d. |
| **GROW-02** | `tests/refresh-decay.test.ts` | Refresh queue file read/write (`refresh-queue.json`) | Validates persistence, prioritization, and status transitions. |
| **GROW-02** | `tests/refresh-decay.test.ts` | Frontmatter update & FAQ constraint gate | Bumps `updatedAt`, injects FAQ without exceeding max 5 items. |
| **GROW-02** | `tests/redirects-consolidation.test.ts`| `content/redirects.json` integration in Next.js config | Formats 301 redirects array safely with fallback. |
| **GROW-02** | `tests/redirects-consolidation.test.ts`| Post retirement & quarantine | Relocates MDX to quarantine and marks registry `'quarantined'`. |
| **GROW-03** | `tests/velocity-governor.test.ts` | 4-point governor lock checks (<60d, <70% ratio, CB trips) | Returns `unlocked: false` with specific reason strings. |
| **GROW-03** | `tests/velocity-governor.test.ts` | 4-point governor unlock check (all 4 criteria met) | Returns `unlocked: true`. |
| **GROW-03** | `tests/velocity-governor.test.ts` | Scheduled publisher integration on non-scheduled day | Exits with code 0 when locked; publishes when unlocked. |
| **GROW-03** | `tests/pillar-hub.test.ts` | Silo landing page below cluster threshold (<8 posts) | Renders standard reverse-chronological list. |
| **GROW-03** | `tests/pillar-hub.test.ts` | Silo landing page at/above threshold ($\ge 8$ posts) | Upgrades to Pillar Hub layout with `CollectionPage` schema. |
| **GROW-03** | `tests/pillar-hub.test.ts` | Cornerstone guide auto-queuing & link mesh | Queues `{silo}-complete-guide` and verifies bidirectional links. |

### 8.2 CLI Verification & Execution Commands

```powershell
# 1. Run all unit and integration tests for Phase 6
npm test -- tests/dashboard-route.test.ts
npm test -- tests/refresh-decay.test.ts
npm test -- tests/redirects-consolidation.test.ts
npm test -- tests/velocity-governor.test.ts
npm test -- tests/pillar-hub.test.ts

# 2. Run the full test suite
npm test

# 3. Test content refresh engine dry run
npx tsx scripts/run-content-refresh.ts --dry-run

# 4. Verify Next.js build with redirects and dashboard route
npm run build
```

---

## 9. Implementation Roadmap & Plan Breakdown

Phase 6 decomposes naturally into four focused plans:

1. **Plan 06-01: Analytics Data Ingestion & Protected Dashboard Route (`GROW-01`)**
   - Implement GSC Search Analytics API query client with country code normalization.
   - Implement Plausible Stats API breakdown client.
   - Implement deterministic snapshot/synthetic data fallback.
   - Build protected `app/dashboard/page.tsx` Server Component with secret token gate, Tier-1 headline card, and indexation gauge.
2. **Plan 06-02: Striking-Distance, Content Decay & Autonomous Refresh Queue (`GROW-02`)**
   - Implement striking-distance detection (positions 5.0–20.0, impressions $\ge 50$).
   - Implement content decay detection ($\ge 90$d, $\ge 25\%$ drop).
   - Implement `content/keywords/refresh-queue.json` schema and IO.
   - Implement refresh execution: bumping `updatedAt`, injecting FAQs (3–5 max guard), and repairing broken links.
3. **Plan 06-03: Data-Driven 301 Redirect Consolidation & Post Retirement (`GROW-02`)**
   - Establish `content/redirects.json` registry.
   - Wire dynamic redirects into `next.config.mjs`.
   - Implement post retirement script: moving retired MDX files to `content/quarantine/` and advancing registry entry to `'quarantined'`.
4. **Plan 06-04: Publishing Velocity Scaling Governor & Dynamic Pillar Hubs (`GROW-03`)**
   - Implement `lib/pipeline/publish/governor.ts` with 4-point 60-day baseline check.
   - Integrate velocity governor into `scripts/publish-scheduled.ts` for non-scheduled day gating.
   - Upgrade `app/[silo]/page.tsx` into dynamic Pillar Hub when $\ge 8$ posts exist, adding `CollectionPage` JSON-LD schema.
   - Implement cornerstone guide queuing and bidirectional link mesh validation.
