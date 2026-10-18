# Phase 5: Autonomous Publish + Indexing - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers autonomous, scheduled publishing, post-publish live-URL verification with automated rollback on failure, dual-track search engine indexing dispatch (IndexNow for Bing/Yandex/Seznam + Search Console API for Google), and a 20-query evaluation benchmark guarding against prompt and model ranking regressions. It bridges the verified quality-gate pipeline (Phase 4) with zero-human-touch live distribution.

</domain>

<decisions>
## Implementation Decisions

### Scheduling & Trigger Architecture (AUTO-01)
- **D-01:** GitHub Actions Execution Engine — GitHub Actions scheduled workflow (`.github/workflows/publish.yml`) acts as the primary execution engine, running on a 3–4 posts/week schedule (Mon, Wed, Fri, Sun at 06:00 UTC). When a draft is ready and passes all QA gates, the workflow commits the new post directly to `master`, pushing to GitHub, which triggers Vercel's automated static edge deployment. Optional Vercel Cron (`vercel.json`) pings GitHub `repository_dispatch` as a redundancy trigger.
- **D-02:** Idempotent Claim-by-Hash Lock — Publishing candidates are selected from passing QA entries. A SHA-256 hash derived from `candidateId + candidateUpdatedAt` is written to `content/keywords/pipeline-state.json` under `activeClaim: { hash, entryId, claimedAt }`. Concurrent or repeated executions detect matching claims and exit cleanly without duplicate publishing.
- **D-03:** Dead Letter Queue (DLQ) — Unsuccessful publish attempts log failure state to `content/keywords/dlq.json` (`{ entryId, error, attempts, firstFailedAt, lastAttemptAt }`). After 3 failed attempts, the entry is automatically moved to quarantine with rule `'publish_dlq_exhausted'` and removed from active publishing rotation.

### Post-Publish Live-URL Verification & Rollback (AUTO-02)
- **D-04:** Post-Deploy Polling with Exponential Backoff — After git push triggers Vercel deployment, the workflow polls the live production URL (`https://.../blog/{slug}`) with exponential backoff (up to 3 minutes timeout) until HTTP status changes from building to live.
- **D-05:** Multi-Point Verification Suite — The live-URL verifier asserts:
  1. HTTP 200 OK and `content-type: text/html`.
  2. Article JSON-LD (`ArticleJsonLd`) and Breadcrumb JSON-LD (`BreadcrumbJsonLd`) parse validly from the rendered HTML.
  3. Zero placeholder/hallucination markers (`[TODO]`, `[Insert]`, `lorem ipsum`, `TBD`, undefined variables).
  4. All internal links on the live page return HTTP 200.
- **D-06:** Automated Git Revert Rollback — If live-URL verification fails any check:
  1. The post is physically moved to `content/quarantine/{slug}.mdx` with an incident report `{slug}-live-fail-report.json`.
  2. Registry entry is transitioned to `'quarantined'`.
  3. The workflow immediately creates an automated git commit (`[auto-unpublish] {slug}: live verification failed`) and pushes to `master`, triggering an instant Vercel redeploy that removes the broken page from production.
  4. An alert banner is appended to `content/quarantine/ALERT.md` and the circuit breaker records a failure.

### Dual-Track Indexing Integration (AUTO-03)
- **D-07:** IndexNow Track (Bing, Yandex, Seznam, Yep) — Dynamic Next.js route `app/[key].txt/route.ts` serves the verification token plain-text from `INDEXNOW_KEY` env var. On successful live verification, a POST request is dispatched to `https://api.indexnow.org/indexnow` submitting the new post URL and sitemap URL.
- **D-08:** Google Track via Search Console API — Sitemap submission dispatched to Google Search Console via official `googleapis` client using service account credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`).
- **D-09:** Graceful Credential Degradation — If Google credentials are not yet provisioned in the environment, the indexing module logs an honest warning, records status `'skipped-no-creds'` in `content/keywords/indexing-log.json`, and allows the IndexNow track to proceed without crashing the publishing workflow.

### Ranking Regression Guard: 20-Query Eval Benchmark (AUTO-04)
- **D-10:** Pinned 20-Query Suite Distribution — A fixed set of 20 high-value queries curated across all 5 silos (4 queries per silo: AI Writing, Dev Tools, Productivity, Cloud, Data/AI) stored in `tests/fixtures/eval-queries.json`.
- **D-11:** Fast Synthetic Evaluation Pipeline — The suite evaluates generated outlines and drafts against strict template schema, topic blocklists, byline integrity, and the 4-point Information Gain rubric.
- **D-12:** Strict CI Pass/Fail Regression Gate — 20 out of 20 queries must pass structure and template checks, and the mean Information Gain score across all 20 must remain $\ge 3.0 / 4.0$. Any drop below this threshold fails CI, blocking prompt/model merges that would cause quality or ranking regressions.

### Agent's Discretion
- Exact cron expression timing details (e.g. 06:00 UTC vs 07:00 UTC).
- Detailed exponential backoff interval parameters (e.g., 5s, 10s, 20s, 30s).
- Specific structure and layout of `content/keywords/indexing-log.json` and `content/keywords/dlq.json`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Roadmap
- `.planning/PROJECT.md` — Core value, zero human gate directive, Tier-1 focus.
- `.planning/REQUIREMENTS.md` § Autonomous Publish + Indexing (AUTO-01, AUTO-02, AUTO-03, AUTO-04) — Scheduled publish, live-URL verifier, dual-track indexing, and 20-query eval benchmark.
- `.planning/ROADMAP.md` § Phase 5: Autonomous Publish + Indexing — Success criteria and dependencies.

### Architecture & Pipeline
- `lib/pipeline/run.ts` — Stage orchestration and preflight gates.
- `lib/pipeline/types.ts` — Registry entry and stage vocabulary.
- `lib/pipeline/registry.ts` — Registry state transitions and shard persistence.
- `lib/pipeline/qa/circuit-breaker.ts` — Circuit breaker and pause lockfile.
- `app/sitemap.ts` & `app/robots.ts` — Native App Router sitemaps.
- `scripts/check-crawl.mjs` — Link crawling and route consistency checks.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/pipeline/qa/quarantine.ts`: `quarantineDraft` to move bad drafts out of `content/posts/` into `content/quarantine/`.
- `lib/pipeline/qa/circuit-breaker.ts`: `readPipelineState`, `writePipelineState`, `recordFailure`, and `ALERT.md` generation.
- `lib/pipeline/qa/info-gain.ts`: 4-point rubric evaluator for the 20-query benchmark.
- `lib/pipeline/qa/link-crawler.ts`: Route table validation and HTTP link prober.

### Established Patterns
- **Fail-Closed Isolation**: Content Collections only monitors `content/posts/`. Moving files to `content/quarantine/` guarantees they do not appear in the static site build.
- **Single-Source Schema**: Zod schemas in `lib/pipeline/draft-schema.ts` validate all frontmatter contracts.
- **Zero Paid Dependencies**: Native `fetch` for HTTP dispatches, official `googleapis` for Search Console, and keyless IndexNow protocol.

### Integration Points
- **Registry Stage**: Expand `RegistryStage` in `lib/pipeline/types.ts` to include `'published'`.
- **Workflow Automation**: `.github/workflows/publish.yml` for scheduled execution and deploy synchronization.
- **Verification CLI**: Dedicated `scripts/verify-live-url.mjs` callable by GitHub Actions or local CLI.
- **Indexing Module**: `lib/pipeline/indexing/` containing IndexNow and GSC dispatchers.
- **Evaluation Runner**: `scripts/run-eval-suite.mjs` and `tests/eval-20.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- **Live URL Verification**: Test against live DOM using lightweight streaming parser or cheerio/regex to check JSON-LD without loading a heavy headless browser in CI.
- **IndexNow Key Route**: Dynamic route `app/[key].txt/route.ts` checking `params.key === process.env.INDEXNOW_KEY` and returning `new Response(params.key, { headers: { 'content-type': 'text/plain' } })`.
- **20-Query Dataset**: Store in `tests/fixtures/eval-queries.json` with 4 topics per silo, covering beginner guides, comparison articles, and troubleshooting workflows.

</specifics>

<deferred>
## Deferred Ideas

- Country-segmented performance analytics and refresh triggers (Phase 6: Observe, Refresh + Compound).
- Striking-distance refresh queue and automated 301 redirect generation (Phase 6).

</deferred>
