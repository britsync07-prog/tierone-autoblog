# Architecture Research

**Domain:** Automated programmatic-SEO blog (Tier-1, Next.js + MDX, fully autonomous publishing)
**Researched:** 2026-10-16
**Confidence:** MEDIUM (Next.js official docs + multiple SEO/architecture sources agree; no Context7 available; pipeline-orchestration specifics are community-pattern consensus, not single-vendor canon)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTENT PIPELINE (offline / scheduled)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐ │
│  │ Keyword  │→ │Competitor│→ │ Outline  │→ │ Draft  │→ │ QA Gates │ │
│  │ Research │  │ Gap      │  │ Builder  │  │ (LLM)  │  │ (block)  │ │
│  │ DataFor  │  │ SERP/top │  │ intent+  │  │ strict │  │ EEAT/orig│ │
│  │ SEO API  │  │ -3 brief │  │ H1/H2/FAQ│  │ struct │  │ /thin    │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  └─────┬────┘ │
│       │             │             │            │             │       │
│       └─────────────┴── Keyword/Cluster Registry ───────────┘       │
│                        (DB or repo JSON: status, KD, silo)          │
├─────────────────────────────────────────────────────────────────────┤
│                    PUBLISH LAYER (git/API → content store)           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MDX Compiler: frontmatter → slug, meta, FAQ, links, images   │  │
│  │  Internal-Link Graph Builder → inject related links at render │  │
│  │  Schema Builder → Article+FAQPage+BreadcrumbList JSON-LD      │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
├──────────────────────────────────┴──────────────────────────────────┤
│                    RENDER / SERVE (Next.js App Router, edge)        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │ Homepage │  │ Silo /   │  │ Cluster  │  │ Post /blog/[slug]│     │
│  │ topical  │  │ Category │  │ Pillar   │  │ MDX + TL;DR+FAQ  │     │
│  │ hubs     │  │ landing  │  │ pages    │  │ +TOC+related     │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  SEO primitives: sitemap.ts · robots.ts · RSS · hreflang ·    │  │
│  │  canonical · OG images · Image pipeline (next/image, AVIF)   │  │
│  └──────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    INDEX + MONITOR LOOP (post-publish)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ IndexNow +   │→ │ GSC API      │→ │ Refresh queue (decay,    │  │
│  │ sitemap ping │  │ perf/coverage│  │ cannibalization, update) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    ORCHESTRATION + STATE                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │
│  │ Cron     │  │ Run log  │  │ Asset    │  │ Analytics store  │      │
│  │ (Vercel/ │  │ + DLQ    │  │ store    │  │ (country-split)  │      │
│  │ Actions) │  │ idempot. │  │ OG/hero  │  │ GSC+behavioral   │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Keyword Research | Pull volume/KD/SERP per geo (en-us/gb/ca/au); filter KD<20, vol 500–5k; assign silo + intent | DataForSEO API (Keywords + SERP endpoints); nightly batch into Keyword Registry |
| Competitor Gap | Fetch top-3 ranking pages per keyword; extract H2s, word count, FAQs (PAA), missing angles → brief | SERP API + HTML fetch + LLM summarizer; store brief JSON alongside keyword row |
| Outline Builder | Enforce post contract: H1 50–60ch, meta 150–160ch, TL;DR ≤100 words, H2/H3 plan, 3–5 FAQs, tables/lists slots | Deterministic template + LLM fill; validates lengths before draft stage |
| Draft (LLM) | Write 1,500–2,500 words to outline; native Tier-1 phrasing; no AI clichés; citations placeholders resolved | Single-model draft + optional second pass for tone/fact density; section-wise generation for length control |
| QA Gates (blocking) | EEAT score, originality/plagiarism, thin-content/word-count, structure-lint, fact/citation check; fail → regenerate or quarantine (never publish) | Composite scorer (see Patterns); hard threshold; quarantine queue + run log |
| MDX Compiler / Publisher | Slugify, write `.mdx` + frontmatter, commit via git (or CMS API), trigger build/revalidate | GitHub commit via API/Action, or Vercel deploy hook; ISR revalidate on publish |
| Internal-Link Graph Builder | Maintain cluster registry; inject 3–7 contextual links (pillar↔cluster, sibling) + related-post block; zero orphans | Build-time graph from frontmatter tags/silo; link-suggestion pass (embeddings or keyword overlap) with guardrails (same-silo preference) |
| Schema Builder | Emit Article/BlogPosting + FAQPage (from FAQ frontmatter) + BreadcrumbList + Organization/WebSite sitewide | `schema-dts`-typed builders; `<script type="application/ld+json">` in Server Components (see Patterns) |
| Image Pipeline | Hero + OG + in-article images; AVIF/WebP, responsive sizes, lazy-below-fold, LCP-preload hero | `next/image`, route-level `opengraph-image.tsx`, build-time OG generator script |
| Cron Orchestrator | One run/day (daily post); serialized stages with idempotency keys; retries + dead-letter queue | Vercel Cron (`vercel.json` → `/api/cron`) or GitHub Actions schedule; never both as primary (see Patterns) |
| Indexing Dispatcher | On publish: IndexNow POST + sitemap refresh; Google via sitemap + Indexing API-eligible/RequestIndexing only for urgent recrawl | `lib/indexnow.ts` fire-and-forget after revalidate; sitemap ping; GSC sitemap submit once |
| Monitor / Refresh | GSC perf (queries, CTR, position), coverage/inspect, engagement (bounce, dwell); schedule updates, consolidation, internal-link repair | Weekly job: striking-distance report (pos 5–20), decay detector (>90d traffic drop), thin-page detector |

## Recommended Project Structure

```
/
├── app/
│   ├── page.tsx                  # Homepage: silo hubs + fresh posts
│   ├── layout.tsx                # Sitewide schema (Organization, WebSite), hreflang, analytics
│   ├── sitemap.ts                # Dynamic sitemap from content store
│   ├── robots.ts                 # Sitemap ref + crawl rules
│   ├── feed.xml/route.ts         # RSS (IndexNow bulk + readers)
│   ├── blog/
│   │   ├── page.tsx              # Archive
│   │   └── [slug]/page.tsx       # Post renderer: MDX + schema + related + breadcrumbs
│   ├── [silo]/page.tsx           # Silo landing (pillar): unique prose + links to clusters
│   ├── authors/[slug]/page.tsx   # Author entity pages (EEAT)
│   ├── api/cron/route.ts         # Daily pipeline entry (guard: CRON_SECRET)
│   ├── api/revalidate/route.ts   # On-demand revalidate after publish
│   └── opengraph-image.tsx       # Default OG fallback
├── content/posts/*.mdx           # One file per post (frontmatter = source of truth)
├── lib/
│   ├── pipeline/                 # keyword.ts, gap.ts, outline.ts, draft.ts, qa.ts, publish.ts
│   ├── seo/schema.ts             # Typed JSON-LD builders (Article/FAQ/Breadcrumb)
│   ├── seo/links.ts              # Internal-link graph builder + suggester
│   ├── seo/indexnow.ts           # IndexNow submit util
│   └── content/registry.ts       # Keyword/cluster registry access (DB or JSON)
├── scripts/                      # bulk-indexnow.ts, audit-links.ts, refresh-report.ts
├── public/{key}.txt              # IndexNow key file
├── mdx-components.tsx            # Global MDX components (callouts, tables, FAQ accordion)
├── vercel.json                   # Cron schedule (daily)
└── next.config.mjs               # @next/mdx, image formats
```

### Structure Rationale

- **`content/posts/` flat files:** One `.mdx` = one post; frontmatter carries all SEO metadata. Git history = audit trail for autonomous publishing; trivial rollback. (Matches Next.js MDX file-pipeline convention.)
- **`lib/pipeline/` stage isolation:** Each stage (keyword→gap→outline→draft→qa→publish) is independently testable and re-runnable; QA is a separate module so gates can't be accidentally bypassed by draft code.
- **`lib/seo/` separate from pipeline:** Schema/link/indexing logic serves the *site*, not a single run — reused by refresh jobs and audits.
- **`app/[silo]/` route mirrors taxonomy:** URL hierarchy follows site IA so breadcrumbs, sitemap, and BreadcrumbList stay consistent by construction.
- **`scripts/` for loop-closing jobs:** Refresh/audit/bulk-submit are operationally distinct from the daily publish cron (different cadence, different failure handling).

## Architectural Patterns

### Pattern 1: Serial gated pipeline (keyword → publish), fail-closed QA

**What:** Linear stage chain; each stage writes its artifact (keyword row → brief → outline → draft → QA score → MDX) to the registry before the next runs. QA is the only gate that can *block* publishing — failure quarantines, never publishes.
**When to use:** Always for autonomous publishing; this project's "zero human gate" constraint makes the automated gate load-bearing.
**Trade-offs:** Slower than parallel generation, but debuggability (which stage failed?) and idempotent resume (re-run from last good artifact) outweigh speed at 1 post/day.

**Example:**
```typescript
// lib/pipeline/run.ts — idempotent daily run
type Stage = 'keyword' | 'gap' | 'outline' | 'draft' | 'qa' | 'publish';
async function runDaily(runId: string) {
  const kw = await pickNextKeyword();          // status=queued → claimed (idempotency)
  const brief = await buildGapBrief(kw);       // cached by keyword hash
  const outline = await buildOutline(kw, brief);
  assertStructure(outline);                    // H1/meta/FAQ counts — throw before LLM spend
  const draft = await draftSections(outline);  // section-wise, length-controlled
  const verdict = await qaGate(draft);         // composite score
  if (!verdict.pass) return quarantine(runId, draft, verdict); // NEVER publish
  const slug = await publishMDX(draft);        // git commit → revalidate → index
  await dispatchIndexing(slug);
}
```

### Pattern 2: Hub-and-spoke site IA with soft-silo linking

**What:** Homepage → 4–8 silo landings (Tech/AI & Digital Tools sub-topics) → pillar page per silo → cluster posts. Every cluster links up to its pillar in the first 1–2 paragraphs; pillar links down to all clusters; siblings link where genuinely relevant. Links are *soft* (editorial/graph-driven), not hard-coded in URLs.
**When to use:** From day one — retrofitting 200 flat posts into silos is the canonical programmatic-SEO rewrite.
**Trade-offs:** Requires a cluster registry and link-suggestion step (more build logic) vs. random "related posts." Pays back in crawl efficiency, zero orphans, and topical-authority signaling.

**Example:**
```typescript
// lib/seo/links.ts — same-silo preference, cap count
function suggestLinks(post: Post, graph: ClusterGraph, max = 5) {
  const pillar = graph.pillarOf(post.silo);                       // mandatory up-link
  const siblings = rankByOverlap(post, graph.postsIn(post.silo))  // keyword/entity overlap
    .filter(p => p.slug !== post.slug).slice(0, max - 1);
  return [pillar, ...siblings]; // pillar anchor uses silo head-term
}
```

### Pattern 3: Flat post URLs + hierarchical navigation (not hierarchical URLs)

**What:** Post URLs stay flat (`/blog/{slug}`) with NO category segment; hierarchy is expressed through breadcrumbs, BreadcrumbList schema, silo landing pages, and internal links. Google's own guidance (Search Central) notes URL depth doesn't confer rank; flat post URLs allow moving posts between silos without redirects.
**When to use:** This project — single expanding niche where posts may migrate silos as topical authority grows (e.g., budgeting-app posts moving to a future finance silo).
**Trade-offs:** Slightly less "readable" URL vs. `/ai-tools/vpn/best-vpn-2026`; vastly easier taxonomy evolution. BreadcrumbList schema + visible breadcrumbs carry the hierarchy signal instead.

### Pattern 4: Schema injection points (layout vs. page)

**What:** Follow the Next.js official JSON-LD pattern — native `<script type="application/ld+json">` with `dangerouslySetInnerHTML` in Server Components (server-rendered → Google sees it in initial HTML, no JS delay):
- `app/layout.tsx` → sitewide `Organization` + `WebSite` (once, inherited everywhere).
- `app/blog/[slug]/page.tsx` → per-post `BlogPosting`/`Article` + `FAQPage` (built from FAQ frontmatter) + `BreadcrumbList` (mirrors visible breadcrumbs).
- Sanitize with `.replace(/</g, '\u003c')` or `serialize-javascript`; type with `schema-dts`.
**When to use:** Always; FAQPage only where visible FAQ content exists (Google restricts FAQ rich results — keep visible accordion + schema in sync or drop FAQ schema).

**Example:**
```typescript
// app/blog/[slug]/page.tsx
import type { WithContext, BlogPosting, FAQPage, BreadcrumbList } from 'schema-dts';
export default function PostPage({ post }: { post: Post }) {
  const article: WithContext<BlogPosting> = { '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: post.title, description: post.meta, image: post.hero,
    datePublished: post.publishedAt, dateModified: post.updatedAt,
    author: { '@type': 'Person', name: post.author.name, url: `${SITE}/${post.author.slug}` } };
  const faq: WithContext<FAQPage> = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: post.faq.map(f => ({ '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const crumb: WithContext<BreadcrumbList> = { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: post.silo, item: `${SITE}/${post.silo}` },
      { '@type': 'ListItem', position: 3, name: post.title }] };
  return (<article>
    {[article, faq, crumb].map((s, i) => (
      <script key={i} type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />))}
    {/* ...MDX body, visible FAQ accordion, visible breadcrumbs... */}
  </article>);
}
```

### Pattern 5: Single-owner cron with idempotent reconciliation

**What:** ONE scheduler owns the daily run — Vercel Cron (`vercel.json` → `/api/cron`, guard with `CRON_SECRET`, production deployments only) is the recommended primary for this stack; GitHub Actions schedule is the fallback, not a parallel trigger. Every stage is idempotent (claim keyword row, cache briefs by hash, upsert MDX by slug) and the run reconciles "work since last success" so a missed/duplicate invocation self-heals. Long LLM chains should fan out to a job runner (not block the cron's function timeout) — cron enqueues, workers execute.
**When to use:** Daily 1-post cadence; Hobby-plan note: Vercel Hobby restricts cron frequency (daily OK).
**Trade-offs:** Vercel Cron = zero infra, but function-duration limits and best-effort delivery (occasional miss/duplicate — hence idempotency). GitHub Actions = longer runtimes + full logs, but known schedule-delay unreliability at hour boundaries; offset by ~10 min.

### Pattern 6: Three-point QA gate placement (brief → draft → pre-publish)

**What:** Gates at three points, weighted by consequence (CodeWords/contentify consensus):
1. **At the brief** (cheap): should-this-exist check — keyword still valid, no cannibalization vs. existing posts (similarity check against registry), intent match.
2. **After the draft** (the gate that cannot be skipped): accuracy — every statistic cited to an openable source; citation-fidelity check (source says what text claims); dates/versions current; structure-lint (H1/meta/FAQ/TL;DR); originality vs. published corpus; thin-content floor (≥1,500 words, non-filler sections).
3. **Before publish** (fast): tone/positioning, banned-phrase scan, link validity, image alt/OG presence, schema validity.
4. **After publish** (async loop): decay/cannibalization/engagement monitors feed the refresh queue.
**Trade-offs:** More checks = higher LLM/API cost per post; acceptable at 1/day. Composite score with per-dimension veto (any critical fail = block, no averaging-away).

### Pattern 7: Indexing fan-out (IndexNow + sitemap) with Google realism

**What:** On publish, fire-and-forget `POST https://api.indexnow.org/indexnow` (covers Bing/Yandex/Naver/Seznam — important for AI-search surfaces like Copilot that draw on Bing) + regenerate sitemap + rely on sitemap for Google discovery. Google does NOT participate in IndexNow; its Indexing API is restricted to JobPosting/BroadcastEvent — don't waste quota submitting blog posts there (returns 200 but silently dropped). Reserve manual/urgent Google recrawl for genuine emergencies.
**Trade-offs:** Same-day indexing is realistic for Bing, aspirational for Google on a new domain (sandbox dominates). The loop's real value is *measurement* (GSC coverage/inspect) feeding refresh priority.

## Data Flow

### Request Flow (reader)

```
Google SERP / direct
    ↓
Edge (Cloudflare CDN → Vercel/edge origin, hreflang + canonical headers)
    ↓
app/blog/[slug]/page.tsx (SSG/ISR, fully static HTML)
    ↓ (initial HTML contains: article HTML + JSON-LD + OG/meta + hero preload)
Reader ← TL;DR answer box (≤100 words) + TOC + body + FAQ + related-post CTAs
    ↓ (behavioral signals)
Analytics store (dwell, scroll, bounce, CTA click, country segment)
```

### State Management (pipeline state — the "database" of an autonomous blog)

```
Keyword/Cluster Registry (single source of truth)
    ↓ (status transitions: queued → claimed → briefed → outlined → drafted → passed → published → monitoring)
Pipeline stages read/write stage artifacts by runId + keyword hash (idempotent resume)
    ↓ (publish event: slug, sitemap delta, IndexNow receipt)
Index/monitor loop reads registry (what to inspect, what decayed, what to refresh)
```

### Key Data Flows

1. **Daily publish flow:** Cron → claim keyword → SERP/gap brief → outline → section drafts → QA verdict → (pass) MDX commit → revalidate → sitemap regen → IndexNow POST → run log. Any throw before QA = retry; QA fail = quarantine.
2. **Link-graph flow:** On every publish AND weekly audit: rebuild cluster graph → inject/verify up-links + siblings + related block → orphan scan (every post needs ≥1 in-link) → write link report.
3. **Monitoring/refresh flow:** GSC API pull (queries, CTR, position, coverage) + analytics (country, engagement) → striking-distance list + decay list + thin/cannibalization flags → refresh queue (update/consolidate/re-link) → republish (bump `dateModified`) → re-index dispatch.
4. **Image/OG flow:** Draft specifies image slots → generator/fetch step produces hero + OG (1200×630) + in-article → `next/image` (AVIF/WebP, sizes) + `opengraph-image` route → LCP-preloaded hero, lazy rest.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 posts (v1, ~1/day for 12–18 mo) | Monolith Next.js + git-backed MDX is fine; single daily cron; JSON/file registry acceptable; ISR on publish |
| 500–5k posts / multi-post/day | Move registry to Postgres (keyword/status/link graph queries); split pipeline into queued workers (e.g., trigger.dev/Inngest or Actions matrix); `generateSitemaps` sharding (50k URLs/sitemap cap is far off but shard early); weekly link-audit becomes mandatory |
| 5k+ / multi-locale variants | Per-locale content trees (`en-us` vs `en-gb` spelling variants need distinct canonicals or consolidated hreflang — prefer ONE canonical + locale-aware phrasing until traffic justifies variants); CDN cache-tag purging; dedicated refresh pipeline rivaling publish pipeline in cost |

### Scaling Priorities

1. **First bottleneck:** LLM draft latency/cost inside the cron function (timeouts). Fix: cron enqueues, async workers draft sections; cache briefs; cap retries.
2. **Second bottleneck:** Internal-link graph rebuild cost (O(n²) similarity). Fix: incremental updates (only re-score affected silo) + precomputed embeddings stored in registry.

## Anti-Patterns

### Anti-Pattern 1: Human-gate-shaped code in an autonomous loop

**What people do:** Leave a "draft → await approval" step enabled, or fail-open QA (publish on scorer error/timeout).
**Why it's wrong:** The loop silently stalls (violates the daily-publish requirement) or ships unvetted content (spam-policy exposure).
**Do this instead:** Fail-closed QA (scorer error = quarantine, alert logged); no approval step in v1; quarantine queue reviewed asynchronously, never blocking the next day's run.

### Anti-Pattern 2: Category-in-URL hard silos

**What people do:** `/ai-tools/vpn/best-vpn-2026` baked taxonomy into slugs.
**Why it's wrong:** Moving a post between silos (or splitting a silo) requires redirects for every moved post; multi-silo posts become impossible without duplication.
**Do this instead:** Flat `/blog/{slug}` + soft silos via links/breadcrumbs/landing pages; taxonomy lives in frontmatter + registry, not in the slug.

### Anti-Pattern 3: Schema decoupled from visible content

**What people do:** FAQPage schema generated from a different source than the rendered FAQ accordion; breadcrumbs in JSON-LD that don't match on-page nav.
**Why it's wrong:** Rich-result ineligibility + manual-action risk (structured-data spam).
**Do this instead:** Single frontmatter source renders BOTH the visible component and the JSON-LD (same map function, same strings).

### Anti-Pattern 4: Dual schedulers (Vercel Cron + Actions both live)

**What people do:** Enable both "for redundancy."
**Why it's wrong:** Double-publish days, keyword double-claims, sitemap races.
**Do this instead:** One primary, one documented-but-disabled fallback; idempotency keys make an accidental double-run a no-op.

### Anti-Pattern 5: Publish-and-forget (no refresh loop)

**What people do:** Pipeline ends at IndexNow POST.
**Why it's wrong:** Content decays (versions, prices, stats), thin pages accumulate, cannibalization grows with volume — rankings rot within months.
**Do this instead:** Budget ~20–30% of pipeline capacity for the refresh queue from the start (update bumps, consolidation redirects, link repair).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| DataForSEO API | Server-side batch calls (Keywords + SERP endpoints), key in env, nightly/weekly pull | Cost per call — cache SERPs by keyword hash; respect per-geo (us/uk/ca/au) parameterization for Tier-1 targeting |
| LLM provider (draft/QA-judge) | Server-only SDK calls in pipeline stages; separate cheap model for lint/judge vs. draft | Never client-exposed keys; section-wise generation; judge-model bias guard (spot-check prompt) |
| IndexNow (`api.indexnow.org`) | `lib/seo/indexnow.ts` POST after revalidate; key file in `public/`; batch ≤10k | Fire-and-forget; log status only; no Google coverage |
| Google Search Console API | OAuth service account; weekly perf/coverage pulls; one-time sitemap submit | Data lags 2–3 days; URL Inspection quota-capped — bulk-inspect selectively (new + decayed) |
| CDN/hosting (Cloudflare + Vercel/edge) | DNS → Cloudflare; US origin; edge caching; `hreflang` headers | CWV budget enforced in CI (Lighthouse 90+ gate on template changes) |
| Analytics (privacy-light) | Server-friendly analytics with country segmentation | Country-split dashboards are a core requirement — verify geo accuracy, not just pageviews |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pipeline → Registry | Claimed-status writes, artifact upserts by keyword hash | Registry is the concurrency control (prevents double-claim across duplicate runs) |
| Publish → Render | Git commit / API write of `.mdx` + frontmatter → ISR revalidate | Content contract: frontmatter schema versioned; renderer rejects unknown versions loudly (fail build, not silent) |
| Render → SEO primitives | `generateMetadata` (title/meta/canonical/hreflang/OG) + JSON-LD components read same frontmatter | Single-source rule: no SEO string exists in two places |
| Publish → Indexing | Slug event → sitemap regen → IndexNow POST | Order matters: URL must 200 before pinging (revalidate first, then submit) |
| Monitor → Pipeline | Refresh queue entries re-enter pipeline at outline/draft stage with "update" intent | Updates bump `dateModified`, preserve slug + backlinks; consolidation uses 301 + registry merge |

## Suggested Build Order (dependencies)

```
1. Site skeleton + post renderer   (no pipeline yet; 2–3 hand-written seed posts)
     ↓ blocks everything render-related
2. SEO primitives                   (metadata, sitemap, robots, canonical, hreflang, base schemas)
     ↓ required before any publish is indexable
3. Silo IA + link-graph v1          (silo landings, pillar, related block, orphan rule)
     ↓ structure must exist before volume arrives
4. Pipeline stages 1–3              (keyword registry → gap brief → outline + structure-lint)
     ↓ outlines validated before paying for drafts
5. Draft + QA gates                 (section drafts, composite scorer, quarantine — fail-closed)
     ↓ NOTHING auto-publishes before this is proven on seed content
6. Publish + cron                   (MDX commit, revalidate, daily cron, idempotency, run log)
     ↓ first autonomous post only after 1–5 green
7. Image/OG pipeline                (hero/OG generation, next/image wiring, LCP budget)
     ↓ can lag publish by days; placeholder gradients acceptable at launch
8. Indexing dispatcher              (IndexNow + sitemap ping on publish event)
     ↓ needs real publishes to test against
9. Monitor + refresh loop           (GSC pull, striking-distance/decay reports, refresh queue)
     ↓ needs weeks of live data; scaffolding (tables, jobs) can ship earlier
```

**Dependency logic:** render → indexability → structure → content-quality → autonomy → distribution → optimization. The critical invariant: **autonomous publishing (6) must never precede proven QA (5)** — that ordering is the spam-policy survival guarantee. Image polish (7) and monitoring depth (9) are explicitly deferrable without risking the core loop.

## Sources

- Next.js official: MDX guide (`nextjs.org/docs/app/guides/mdx`), JSON-LD guide (`nextjs.org/docs/app/guides/json-ld`), `generateSitemaps` reference — HIGH confidence
- HubSpot / Moz / Search Engine Land topic-cluster + pillar/cluster internal-linking model — HIGH confidence (mutually consistent)
- Google Search Central community guidance: flat vs hierarchical URLs (hierarchy via links, not URL depth; avoid category-in-post-URL) — MEDIUM-HIGH confidence
- IndexNow protocol docs + Next.js implementation guides (`indexnowtool.com`, `next-indexnow`, `indxel.com`): POST semantics, 10k/batch, Bing/Yandex/Naver/Seznam only, key-file hosting — HIGH confidence
- Vercel Cron docs (`vercel.com/docs/cron-jobs`): `vercel.json` schedule, `CRON_SECRET` guard, production-only, best-effort delivery / idempotency requirement — HIGH confidence
- AI content QA: Contentify quality-gate pipeline, CodeWords review-gate placement, CORE-EEAT benchmark dimensions (`zhenheco/content-flywheel-skills`), Google scaled-content-abuse policy summaries — MEDIUM confidence (community consensus, policy wording paraphrased)

---
*Architecture research for: TierOne AutoBlog (automated Tier-1 SEO blog)*
*Researched: 2026-10-16*
