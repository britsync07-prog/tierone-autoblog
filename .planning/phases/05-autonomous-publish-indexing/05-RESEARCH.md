# Phase 5: Autonomous Publish + Indexing - Technical Research & Architecture

**Created:** 2026-10-18  
**Status:** Complete & Validated  
**Target Architecture:** Next.js 16 App Router (React 19, Server Components), GitHub Actions, IndexNow Protocol, Google Search Console API, Node 22+ Test Runner  
**Primary Output Target:** `D:/myapps/blogs/.planning/phases/05-autonomous-publish-indexing/05-RESEARCH.md`

---

## Executive Summary

Phase 5 transitions TierOne AutoBlog from an offline, quality-gated content generator into a fully autonomous, self-distributing publication system. Operating under the strict **fully-free platform constraint** (no paid indexing or SEO API subscriptions), this phase establishes:
1. **Autonomous Scheduled Publishing Engine**: Driven by GitHub Actions (`.github/workflows/publish.yml`) on a 4x/week cadence (Mon, Wed, Fri, Sun at 06:00 UTC) with idempotent claim-by-hash locking and a Dead Letter Queue (DLQ).
2. **Dual-Track Search Engine Indexing**:
   - *IndexNow Track*: Real-time instant notification to Bing, Yandex, Seznam, Naver, and Yep via standard HTTP POST, verified using a dedicated Next.js key route and static fallbacks.
   - *Google Track*: Automated sitemap submission to Google Search Console via official `googleapis` (service account), featuring graceful `'skipped-no-creds'` degradation when service account keys are not yet configured.
3. **Live Production Verifier & Git Rollback**: Zero-human-intervention post-deploy polling with exponential backoff, performing strict HTML parsing (Article and Breadcrumb JSON-LD, placeholder scans, internal link 200 OK checks), automatically executing git unpublish commits to `master` upon failure.
4. **Pinned 20-Query Evaluation Benchmark**: Fixed 20-query suite spanning all 5 silos (`ai-writing`, `ai-coding`, `ai-image`, `ai-productivity`, `ai-guides`) that gates prompt and model changes in CI against Information Gain ($\ge 3.0 / 4.0$) and structural regressions.

---

## 1. IndexNow API Protocol & Key Route

### 1.1 Protocol Specifications & Request Payload

The IndexNow protocol allows publishers to instantly inform participating search engines (Microsoft Bing, Yandex, Seznam.cz, Naver, Yep) of new, updated, or deleted URLs.

> [!IMPORTANT]
> Google does **not** participate in IndexNow. IndexNow covers Bing, Yandex, Seznam, Naver, and Yep (~3.5+ billion URLs/day). Google is handled via the separate Google Search Console sitemap track (§2).

- **Global Submission Endpoint**: `https://api.indexnow.org/indexnow`
- **HTTP Method**: `POST`
- **Headers**:
  ```http
  Content-Type: application/json; charset=utf-8
  Host: api.indexnow.org
  ```
- **JSON Payload Schema**:
  ```json
  {
    "host": "tieroneautoblog.com",
    "key": "4a2b9e6f8c1d3a5e7b9c2d4f6a8e0b2d",
    "keyLocation": "https://tieroneautoblog.com/4a2b9e6f8c1d3a5e7b9c2d4f6a8e0b2d.txt",
    "urlList": [
      "https://tieroneautoblog.com/blog/chatgpt-vs-claude-coding-2026",
      "https://tieroneautoblog.com/sitemap/0.xml"
    ]
  }
  ```
- **Batch Limits**: Up to 10,000 URLs per request.
- **Key Specifications**:
  - Key length: 8 to 128 hexadecimal characters (recommended: 32 or 64 hex characters, e.g. `crypto.randomBytes(16).toString('hex')`).
  - Key characters: `[a-f0-9]` or `[A-Za-z0-9-]`.

### 1.2 Response Status Code Semantics

| HTTP Status | Meaning | Action / Pipeline Behavior |
|---|---|---|
| `200 OK` | URLs submitted and accepted | Mark entry as indexed in `indexing-log.json`. |
| `202 Accepted` | URLs received, key pending verification | Valid response; treated as successful dispatch. |
| `400 Bad Request` | Invalid format or payload schema | Fail indexing task; log error details for schema debugging. |
| `403 Forbidden` | Key invalid or key file not found at location | Alert operator; verify `INDEXNOW_KEY` and host reachability. |
| `422 Unprocessable Entity` | URLs do not belong to host or keyLocation mismatch | Validate `SITE_URL` matches submitted URLs. |
| `429 Too Many Requests` | Rate limit exceeded | Back off and retry with exponential delay. |

### 1.3 Serving the Key File in Next.js 16 App Router

#### The Dynamic Route Dilemma in Next.js 16
IndexNow search engines verify site ownership by requesting `https://<host>/<key>.txt`, expecting a plain-text response containing only the `<key>`.

In Next.js 16 App Router:
1. Dynamic route segments must strictly follow `[param]` syntax. If a folder is named `app/[key].txt/route.ts`, Next.js 16 treats `[key].txt` as a **literal static segment** `/[key].txt`. TypeScript validator throws:
   ```
   error TS2344: Type 'typeof import(...)' does not satisfy constraint 'RouteHandlerConfig<"/[key].txt">'.
   Type '{ params: Promise<{}>; }' is not assignable to type '{ params: Promise<{ key: string }>; }'.
   ```
2. Furthermore, `app/[silo]/page.tsx` exists at the root of `app/`. Next.js does not allow a conflicting root dynamic segment `app/[key]/route.ts` alongside `app/[silo]/page.tsx`.

#### The Dual-Resilience Solution: Next.js Rewrite + Static `public/` Sync
To guarantee high performance, zero build conflicts, and 100% compliance with search engine crawlers:

1. **Option A: Dynamic Route via Next.js Rewrite (`next.config.mjs`)**:
   Add a URL rewrite in `next.config.mjs`:
   ```javascript
   // next.config.mjs
   const nextConfig = {
     async rewrites() {
       return [
         {
           source: '/:key([a-zA-Z0-9_-]+).txt',
           destination: '/api/indexnow?key=:key',
         },
       ];
     },
   };
   ```
   Implement `app/api/indexnow/route.ts`:
   ```typescript
   // app/api/indexnow/route.ts
   import { NextRequest, NextResponse } from 'next/server';

   export const dynamic = 'force-dynamic';

   export async function GET(request: NextRequest): Promise<Response> {
     const requestedKey = request.nextUrl.searchParams.get('key');
     const configuredKey = process.env.INDEXNOW_KEY;

     if (!configuredKey || !requestedKey || requestedKey !== configuredKey) {
       return new NextResponse('Not Found', { status: 404 });
     }

     return new NextResponse(configuredKey, {
       status: 200,
       headers: {
         'Content-Type': 'text/plain; charset=utf-8',
         'Cache-Control': 'public, max-age=86400, s-maxage=86400',
       },
     });
   }
   ```

2. **Option B: Prebuild Static Sync into `public/`**:
   In `scripts/sync-indexnow-key.mjs` (run during `npm run build` or CI checkout):
   ```javascript
   // scripts/sync-indexnow-key.mjs
   import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
   import { join } from 'node:path';

   const key = process.env.INDEXNOW_KEY;
   if (key && /^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
     mkdirSync('public', { recursive: true });
     writeFileSync(join('public', `${key}.txt`), key, 'utf8');
     console.log(`IndexNow: Synced key file to public/${key}.txt`);
   }
   ```
   Static files in `public/` are served at the edge by Vercel CDN with zero compute overhead and zero App Router routing friction.

3. **Explicit `keyLocation` in Dispatch Payload**:
   Always include `"keyLocation": `${SITE_URL}/${key}.txt`` in the IndexNow POST body. Search engines that support explicit locations read this directly without guessing root formats.

---

## 2. Google Search Console API (Sitemaps Submission)

### 2.1 Package & Authentication Architecture

- **Dependency**: `googleapis` (official Google APIs client library for Node.js).
- **Authentication**: Google Service Account with Search Console delegation.
- **Required OAuth Scope**: `https://www.googleapis.com/auth/webmasters`

#### Environment Variable Strategy
To support both local development, GitHub Actions secrets, and Vercel environment variables without requiring disk-based JSON files:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The client email (e.g. `autoblog-service@project-id.iam.gserviceaccount.com`).
- `GOOGLE_PRIVATE_KEY`: The PEM private key string.
  > [!TIP]
  > Environment variables in CI/CD often encode newlines as literal `\n`. Always sanitize with:
  > `process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')`.
- `GOOGLE_APPLICATION_CREDENTIALS`: Optional fallback path to a service account JSON file on disk.

### 2.2 Calling the Search Console Sitemaps API

In Next.js App Router, our sitemap is sharded into two endpoints via `generateSitemaps()`:
- `${SITE_URL}/sitemap/0.xml` (all blog posts, diff-gated `updatedAt`)
- `${SITE_URL}/sitemap/1.xml` (homepage, silo landings, trust pages)

The Google Search Console Sitemaps endpoint is `searchconsole('v1').sitemaps.submit`:

```typescript
// lib/pipeline/indexing/google-search-console.ts
import { google } from 'googleapis';

export interface GscSubmitOptions {
  siteUrl: string;
  sitemapUrl: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface GscSubmitResult {
  status: 'submitted' | 'skipped-no-creds' | 'error';
  siteUrl: string;
  sitemapUrl: string;
  message?: string;
}

export async function submitGscSitemap(options: GscSubmitOptions): Promise<GscSubmitResult> {
  const clientEmail = options.clientEmail ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = options.privateKey ?? process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !rawPrivateKey) {
    return {
      status: 'skipped-no-creds',
      siteUrl: options.siteUrl,
      sitemapUrl: options.sitemapUrl,
      message: 'Google Search Console credentials not provisioned (skipped-no-creds).',
    };
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/webmasters'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // siteUrl is typically formatted as URL-prefix 'https://tieroneautoblog.com/'
    // or domain property 'sc-domain:tieroneautoblog.com'.
    // feedpath is the fully qualified URL of the sitemap.
    await searchconsole.sitemaps.submit({
      siteUrl: options.siteUrl.endsWith('/') ? options.siteUrl : `${options.siteUrl}/`,
      feedpath: options.sitemapUrl,
    });

    return {
      status: 'submitted',
      siteUrl: options.siteUrl,
      sitemapUrl: options.sitemapUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      siteUrl: options.siteUrl,
      sitemapUrl: options.sitemapUrl,
      message,
    };
  }
}
```

### 2.3 Graceful Degradation Contract (D-09)
The publishing workflow must **never crash or halt** if Google credentials are unset or invalid:
1. When credentials are missing, log an honest informative notice: `[indexing] GSC: credentials not configured — recording skipped-no-creds`.
2. Record the outcome in `content/keywords/indexing-log.json`:
   ```json
   {
     "timestamp": "2026-10-18T06:01:15.000Z",
     "slug": "chatgpt-vs-claude-coding-2026",
     "indexnow": { "status": "submitted", "httpStatus": 200 },
     "gsc": { "status": "skipped-no-creds", "reason": "No service account configured" }
   }
   ```
3. Allow the IndexNow dispatch to proceed unhindered.

---

## 3. GitHub Actions Scheduled Publishing Workflow

### 3.1 Trigger & Runner Architecture

The automated publishing engine executes via GitHub Actions:
- **Workflow Path**: `.github/workflows/publish.yml`
- **Schedule**: `cron: '0 6 * * 1,3,5,0'` (Monday, Wednesday, Friday, Sunday at 06:00 UTC).
- **Manual Trigger**: `workflow_dispatch` with optional parameters (`force_candidate_id`, `dry_run`).
- **Permissions**: `contents: write` (mandatory to commit and push published posts and registry state back to `master`).

```yaml
name: publish

on:
  schedule:
    - cron: '0 6 * * 1,3,5,0'
  workflow_dispatch:
    inputs:
      force_candidate_id:
        description: 'Candidate ID to publish immediately'
        required: false
        type: string
      dry_run:
        description: 'Dry run without committing or indexing'
        required: false
        type: boolean
        default: false

permissions:
  contents: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Node.js 22 LTS
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Configure Git Author
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Run Publish & Live Verification
        env:
          INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}
          GOOGLE_SERVICE_ACCOUNT_EMAIL: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_EMAIL }}
          GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          PROD_SITE_URL: ${{ secrets.PROD_SITE_URL }}
        run: |
          npx tsx scripts/publish-scheduled.ts ${{ github.event.inputs.force_candidate_id }}

      - name: Commit & Push Changes
        if: success()
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            git add content/
            git commit -m "publish: automated release [skip ci]"
            git push origin master
          else
            echo "No changes to commit."
          fi
```

### 3.2 Idempotent Claim-by-Hash Locking (D-02)

To prevent race conditions, double-publishing, or redundant processing if overlapping runs occur:
1. **Candidate Selection**:
   The publisher scans `content/keywords/*/registry.json` for candidates where `stage === 'drafted'` and `qa?.passedAt` is truthy, sorted by `qa.passedAt` ascending (FIFO).
2. **Hash Derivation**:
   Compute SHA-256 fingerprint:
   $$\text{claimHash} = \text{SHA-256}(\text{candidate.id} + ":" + \text{candidate.updatedAt})$$
3. **Lock Verification in `content/keywords/pipeline-state.json`**:
   ```typescript
   export interface PipelineState {
     paused: boolean;
     pausedAt?: string;
     consecutiveFailures: number;
     failureHistory: FailureRecord[];
     reason?: string;
     activeClaim?: {
       hash: string;
       entryId: string;
       claimedAt: string;
     };
   }
   ```
4. **Acquiring Lock**:
   - If `activeClaim` exists, check if `activeClaim.hash === claimHash` and elapsed time $< 30$ minutes. If so, abort with `Status: Already claimed by active worker`.
   - If lock is stale ($> 30$ minutes), overwrite lock and proceed.
   - On completion of publishing or rollback, clear `activeClaim`.

### 3.3 Dead Letter Queue (DLQ) Architecture (D-03)

If an entry fails during the publish execution (e.g. file IO corruption, transient network crash, repeated formatting anomaly):
- State file: `content/keywords/dlq.json`
- Schema:
  ```typescript
  export interface DlqEntry {
    entryId: string;
    silo: string;
    attempts: number;
    firstFailedAt: string;
    lastAttemptAt: string;
    lastError: string;
  }

  export interface DlqRegistry {
    entries: Record<string, DlqEntry>;
  }
  ```
- **3-Strike Exhaustion Rule**:
  1. Failures increment `attempts`.
  2. If `attempts >= 3`, the entry is considered dead:
     - Invoke `quarantineDraft` with rule `'publish_dlq_exhausted'`.
     - Set registry stage to `'quarantined'`.
     - Remove entry from active publishing rotation.
     - Append warning notice to `content/quarantine/ALERT.md`.

---

## 4. Post-Publish Live Verification & Automated Rollback

### 4.1 Production Polling with Exponential Backoff (D-04)

Pushing the new post to GitHub `master` immediately triggers Vercel static build and edge deployment. The live verification script must poll the live URL until Vercel completes deployment and serves the fresh static page.

```typescript
// scripts/verify-live-url.ts polling schedule
const POLLING_INTERVALS_MS = [15000, 20000, 30000, 30000, 40000, 45000]; // Max ~3 minutes
```

Polling loop logic:
1. Dispatch `GET` request to `https://tieroneautoblog.com/blog/<slug>` with header `User-Agent: TierOne-LiveVerifier/1.0`.
2. If response is HTTP 404 (still building) or 503:
   - Sleep for current interval.
   - Advance to next interval.
3. If timeout expires without HTTP 200:
   - Trigger **Deployment Timeout Rollback**.

### 4.2 Multi-Point Verification Suite (D-05)

Once HTTP 200 with `content-type: text/html` is received, the verifier performs a zero-browser DOM analysis using standard Node streaming / regex parsing:

#### Check 1: Article & Breadcrumb JSON-LD Validation
The HTML must contain `<script type="application/ld+json">` tags rendering valid schema:
- **Article Schema**:
  - Root `@type` is `"Article"` or contains `"Article"` in `@graph`.
  - Headline exists and length $\ge 10$ chars.
  - Author `@type === "Person"` and name equals `"Musfiqur Rahman Saimon"`.
  - Date published and date modified exist and are valid ISO strings.
- **Breadcrumb Schema**:
  - `@type === "BreadcrumbList"`.
  - `itemListElement` array has at least 3 items (Home $\to$ Silo $\to$ Post).

#### Check 2: Banned Placeholder & Hallucination Scan
The body text (stripping scripts and styles) must not contain unfinished template markers or model leaks:
```typescript
const BANNED_PATTERNS = [
  /\[TODO\]/i,
  /\[Insert\s+[^\]]+\]/i,
  /\[TBD\]/i,
  /lorem\s+ipsum/i,
  /\bundefined\b/,
  /\bNaN\b/,
  /<!--\s*TODO\s*-->/i,
  /\b(?:FIXME|PLACEHOLDER)\b/i,
];
```

#### Check 3: Live Internal Link Health
All internal `<a href="...">` anchor tags on the rendered page:
1. Extract all URLs matching `/blog/*`, `/<silo>`, `/about`, `/editorial-process`, `/contact`, `/privacy`, `/terms`, `/authors/*`.
2. Probe each unique link with `fetch(url, { method: 'HEAD' })`.
3. Assert all return HTTP 200 (no broken redirects or 404 dead links).

### 4.3 Automated Rollback Engine (D-06)

If **any** check in the multi-point verification suite fails:
1. **Immediate Quarantine**: Move `content/posts/<slug>.mdx` to `content/quarantine/<id>.mdx` via `quarantineDraft`.
2. **Incident Report**: Generate `content/quarantine/<id>-live-fail-report.json` with exact error diagnostics, failing HTML snippets, and timestamp.
3. **Registry Transition**: Transition registry entry to `stage: 'quarantined'`, rule: `'live_verification_failed'`.
4. **Circuit Breaker Trip**: Invoke `recordQaFailure({ id, failedRule: 'live_verification_failed' })`. If consecutive failures hit $K=3$, pause the pipeline.
5. **Git Auto-Unpublish Commit & Push**:
   ```bash
   git add content/posts content/quarantine content/keywords
   git commit -m "[auto-unpublish] <slug>: live verification failed [skip ci]"
   git push origin master
   ```
6. **Vercel Rebuild Trigger**: Vercel detects the commit on `master`, immediately triggers a production build, and deploys edge assets without the quarantined post. The broken page disappears from production in under 2 minutes.

---

## 5. Pinned 20-Query Evaluation Benchmark (AUTO-04)

### 5.1 Dataset Distribution Across Silos

To guard against model prompt degradation, template breakages, or hallucination regressions, 20 canonical queries are pinned across the 5 verified codebase silos (`lib/silos.ts`).

File: `tests/fixtures/eval-queries.json`

```json
[
  { "id": "eq-write-01", "silo": "ai-writing", "query": "best ai writing assistants 2026 comparison" },
  { "id": "eq-write-02", "silo": "ai-writing", "query": "jasper vs copy ai for marketing teams" },
  { "id": "eq-write-03", "silo": "ai-writing", "query": "how to use claude for long form blog drafting" },
  { "id": "eq-write-04", "silo": "ai-writing", "query": "quillbot paraphrasing alternatives and drawbacks" },

  { "id": "eq-code-01", "silo": "ai-coding", "query": "chatgpt vs claude for coding benchmarks 2026" },
  { "id": "eq-code-02", "silo": "ai-coding", "query": "github copilot vs cursor ide workflow comparison" },
  { "id": "eq-code-03", "silo": "ai-coding", "query": "how to use ai for automated code reviews" },
  { "id": "eq-code-04", "silo": "ai-coding", "query": "debugging complex typescript errors with ai" },

  { "id": "eq-image-01", "silo": "ai-image", "query": "best free ai image generators 2026 ranked" },
  { "id": "eq-image-02", "silo": "ai-image", "query": "midjourney vs dall e 3 commercial license comparison" },
  { "id": "eq-image-03", "silo": "ai-image", "query": "how to write prompts for photorealistic ai images" },
  { "id": "eq-image-04", "silo": "ai-image", "query": "stable diffusion local setup guide and requirements" },

  { "id": "eq-prod-01", "silo": "ai-productivity", "query": "best ai meeting note takers compared 2026" },
  { "id": "eq-prod-02", "silo": "ai-productivity", "query": "ai email assistant tools for inbox zero" },
  { "id": "eq-prod-03", "silo": "ai-productivity", "query": "notion ai vs obsidian for knowledge management" },
  { "id": "eq-prod-04", "silo": "ai-productivity", "query": "ai calendar scheduling assistants tested" },

  { "id": "eq-guide-01", "silo": "ai-guides", "query": "how to write better ai prompts beginner guide" },
  { "id": "eq-guide-02", "silo": "ai-guides", "query": "how to verify ai generated factual claims" },
  { "id": "eq-guide-03", "silo": "ai-guides", "query": "common prompt engineering mistakes to avoid" },
  { "id": "eq-guide-04", "silo": "ai-guides", "query": "multi step reasoning prompts for complex tasks" }
]
```

### 5.2 Fast Synthetic Evaluation Runner

- Script: `scripts/run-eval-suite.ts`
- Test: `tests/eval-20.test.ts`
- Evaluates synthesized outlines and sample drafts against 4 criteria:
  1. **Schema Conformance**: Valid Zod frontmatter contract (`draft-schema.ts`), title 50–60 chars, description 150–160 chars.
  2. **Topic & Byline Integrity**: Author matches `musfiqur-rahman-saimon`, zero forbidden blocklist triggers.
  3. **4-Point Information Gain Rubric** (`lib/pipeline/qa/info-gain.ts`):
     - Dimension 1: Workflow Guidance (step-by-step procedures)
     - Dimension 2: Structured Comparison Synthesis (tables, tradeoff matrices)
     - Dimension 3: Edge-Case & Limitation Coverage (drawbacks, when not to use)
     - Dimension 4: Competitor Gap Closure (FAQ addressing user pain points)
- **CI Acceptance Gate**:
  - $20 / 20$ queries pass schema, byline, and blocklist validation.
  - Mean Information Gain score across all 20 queries must be $\ge 3.0 / 4.0$.
  - Execution time: $< 5$ seconds in offline deterministic heuristic mode.

---

## 6. Implementation Patterns & Architecture

```
lib/pipeline/
├── indexing/
│   ├── indexnow.ts             # IndexNow HTTP POST dispatcher & error handling
│   ├── google-search-console.ts # GSC Sitemaps API client with graceful degradation
│   └── index.ts                # Unified dual-track indexing coordinator
├── publish/
│   ├── claim-lock.ts           # Idempotent SHA-256 claim lock in pipeline-state.json
│   ├── dlq.ts                  # Dead letter queue management (dlq.json)
│   ├── verifier.ts             # Live production URL HTML, JSON-LD, and link prober
│   └── rollback.ts             # Automated git unpublish & quarantine commit engine
app/
├── api/
│   └── indexnow/
│       └── route.ts            # Dynamic key route handler (rewrite target)
scripts/
├── publish-scheduled.ts        # CLI runner invoked by GitHub Actions cron
├── verify-live-url.ts          # Standalone post-publish live URL prober
├── sync-indexnow-key.mjs       # Build-time sync of INDEXNOW_KEY to public/
└── run-eval-suite.ts           # 20-Query evaluation runner
tests/
├── fixtures/
│   └── eval-queries.json       # 20 high-value queries across 5 silos
├── indexing-indexnow.test.ts   # IndexNow payload, mock server, and status tests
├── indexing-gsc.test.ts        # GSC authentication, sitemap submit, and fallback tests
├── publish-claim-dlq.test.ts   # Hash claiming and 3-strike DLQ isolation tests
├── verify-live-url.test.ts     # HTML parsing, JSON-LD, placeholder, and link checks
└── eval-20.test.ts             # 20-query regression test suite
```

---

## 7. Validation Architecture (Nyquist Framework)

To satisfy the Nyquist validation mandate and guarantee flawless autonomous operation, Phase 5 enforces automated verification at each boundary:

### 7.1 Automated Test Commands

| Test Suite | Purpose | Execution Command |
|---|---|---|
| IndexNow Protocol Suite | Verifies payload schema, key matching, batch limits, status code handling | `npx tsx --test tests/indexing-indexnow.test.ts` |
| Google Search Console Suite | Verifies GSC client auth, sitemap submission, and `'skipped-no-creds'` fallback | `npx tsx --test tests/indexing-gsc.test.ts` |
| Claim Lock & DLQ Suite | Verifies SHA-256 locking, race prevention, and 3-strike quarantine escalation | `npx tsx --test tests/publish-claim-dlq.test.ts` |
| Live URL Verifier Suite | Verifies JSON-LD parsing, banned phrase detection, and rollback triggering | `npx tsx --test tests/verify-live-url.test.ts` |
| 20-Query Eval Benchmark | Evaluates all 20 queries across 5 silos against the 3.0/4.0 Information Gain gate | `npx tsx --test tests/eval-20.test.ts` |
| Full Phase 5 Suite | Runs entire suite concurrently | `npm test` |

### 7.2 Acceptance Gates

1. **Pre-Publish Gate**:
   - Post passes all Phase 4 QA gates (`infoGainScore >= 3`, shingle originality, fact-checking, zero blocklist matches).
   - Claim lock successfully acquired in `pipeline-state.json`.
2. **Post-Publish Edge Gate**:
   - Production URL returns HTTP 200 within 180 seconds.
   - Article and Breadcrumb JSON-LD schemas parse without errors.
   - Zero placeholder markers (`[TODO]`, `[Insert]`, `undefined`).
   - 100% of internal links return HTTP 200.
3. **Indexing Dispatch Gate**:
   - IndexNow returns HTTP 200 or 202.
   - GSC returns status `'submitted'` or graceful `'skipped-no-creds'`.
   - Results recorded in `content/keywords/indexing-log.json`.
4. **CI Regression Gate**:
   - `eval-20.test.ts` scores 20/20 pass and mean Information Gain $\ge 3.0 / 4.0$.
   - Any PR modifying pipeline prompts, schemas, or models failing this gate is blocked from merging.

---

## 8. Summary of Dependencies to Add

1. `googleapis`: Required for Google Search Console API sitemap submission.
   ```bash
   npm install googleapis
   ```
2. No other dependencies are required. IndexNow uses native `fetch()`, JSON-LD and HTML parsing use native regex/string parsing, and tests use Node's built-in `node:test` and `node:assert/strict`.
