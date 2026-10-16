# Project Research Summary

**Project:** TierOne AutoBlog (automated Tier-1 SEO blog, Tech/AI niche, traffic-first)
**Domain:** Fully autonomous programmatic-SEO blog — Next.js App Router + MDX, daily AI publishing, US/UK/CA/AU targeting
**Researched:** 2026-10-16
**Confidence:** HIGH on stack/policy direction; MEDIUM on operational thresholds and third-party costs

## Executive Summary

TierOne AutoBlog is a fully autonomous daily-publishing SEO blog in the Tech/AI & Digital Tools niche, built to compound Tier-1 (US/UK/CA/AU) organic traffic on a new domain through a 3–6 month sandbox. Experts build this class of product as four coupled systems, not a website: a serial gated content pipeline (keyword → gap brief → outline → draft → fail-closed QA → publish), a static-first Next.js render layer with machine-enforced post template and schema, a hub-and-spoke silo IA with automated internal linking, and a post-publish index-plus-monitor loop (IndexNow for Bing, sitemaps + GSC API for Google, decay-driven refresh). The unanimous research conclusion is an ordering invariant: **render → indexability → structure → proven QA gates → autonomy → distribution → optimization — autonomous publishing must never precede proven QA.**

The recommended approach is opinionated and differs from PROJECT.md in three corrected decisions (recorded below): scaffold on **Next.js 16.x latest** (not 14; App Router + Turbopack + React 19.2 + Node 22 LTS + Tailwind v4), use **Content Collections** as the typed MDX layer (Contentlayer is dead), and — most consequentially — **launch single-locale en-US (+ x-default) first**, deferring en-GB/en-CA/en-AU variants until the US base ranks. Four-locale day-one publishing creates a ~98%-identical near-duplicate cluster that invites doorway/duplicate handling on a zero-authority domain. Similarly, visible FAQs stay (PAA/long-tail/AI-citation value) but **FAQPage schema is hygiene, not a traffic lever** — Google restricted FAQ rich results (Aug 2023) and fully removed them (May 2026).

The existential risk is Google's **scaled-content-abuse** classification: a zero-human-gate daily loop is structurally indistinguishable from the abuse pattern unless automated QA gates act as the substitute human. Mitigation is the load-bearing wall of the roadmap — originality + information-gain + fact-verification gates, publish-or-quarantine (never fail-open), post-publish live-URL verifier with auto-pause, one real verifiable publisher identity (no fabricated authors), cluster-governed long-tail-first queue (KD<20), index-ratio-gated velocity (start 3–4/week, daily only after 60+ days of baselines), and noindex-by-default archives. Every pitfall compounds per published post, so platform correctness and gates must precede public volume.

## Key Findings

### Recommended Stack

Next.js 16 App Router on Vercel is the only sensible default: native Metadata API, `sitemap.ts`/`robots.ts` conventions, `generateStaticParams`, and Server Components that render JSON-LD into initial HTML for crawlers — with Turbopack as default bundler. Strict TypeScript + zod-validated frontmatter is the quality contract that keeps an autonomous pipeline from publishing malformed posts. The content layer is Content Collections (`core` + `mdx` + `next`), the purpose-built Contentlayer successor with zod schemas and App Router/RSC compatibility (proven Dub migration path). Dual-scheduler pattern is Vercel Cron primary (Hobby: 100 jobs, once/day, UTC-only — exactly the v1 need) with GitHub Actions as documented-but-disabled fallback, never both live. Analytics is Plausible (behavior, ~1–2.5 KB, no UK-GDPR consent banner) + Search Console API (rankings/CTR truth, country-segmented); GA4 is deferred. Keyword data is DataForSEO pay-as-you-go (Labs keyword ideas + SERP API, batch + cache everything). See `STACK.md` for install commands, version matrix, and full alternatives table.

**Core technologies:**
- Next.js 16.x App Router (React 19.2, Node 22 LTS, Tailwind v4): framework/rendering/metadata/sitemaps — current stable line; do not start on 14
- TypeScript ^5 strict + zod ^3/^4: frontmatter and pipeline payload validation — the automated QA gate is only as strong as this schema
- Content Collections (`core` + `mdx` + `next`): typed MDX pipeline — Contentlayer successor, App Router-compatible, catches schema violations pre-publish
- next-seo ^7 (7.3.0): JSON-LD components ONLY (`ArticleJsonLd`, `FAQPageJsonLd`, `BreadcrumbJsonLd`) — meta tags come from the native Metadata API; v7 is RSC-safe with CSP nonce
- schema-dts + remark-gfm / rehype-slug / rehype-autolink-headings + rehype-pretty-code (shiki): typed Schema.org vocabulary; tables, anchors, TOC; server-rendered code highlighting
- @vercel/og: programmatic per-post OG/Twitter images — zero-design CTR asset
- @anthropic-ai/sdk (primary long-form draft) + openai SDK (fallback + cheap subtasks: titles/meta/FAQ): dual-provider so one outage never halts publishing
- DataForSEO API v3 (Labs + SERP + Keywords Data): keyword ideas (~$0.012 + $0.00012/kw), SERP ($0.60/1k) — budget per-post cost before bulk automation
- googleapis (Node client): Search Console + URL Inspection (2,000 QPD) + sitemap submission — one dep covers the Google track
- Plausible + @tailwindcss/typography: light behavioral analytics with country segmentation; readable long-form prose styling

### Expected Features

The post template is code, not guidance: H1 50–60 chars, meta 150–160, clean slug, TL;DR answer box in first 100 words, H2/H3 body, comparison tables, 3–5 real-question FAQs, conclusion + CTA — every element machine-checkable in QA. Authority comes from topic-cluster silos (flexible hub-and-spoke with contextual cross-links, not rigid silo purity), automated contextual internal links (2–3+/post, keyword-rich anchors, mandatory pillar up-link, zero orphans), same-silo related blocks, and category archives with tags noindexed. Trust floor is real-entity author pages + About/Contact/legal + editorial-process disclosure + HTTPS. Crawlability floor is split sitemaps + self-referencing canonicals + the dual-track indexing pipeline. Country-segmented analytics (country × page × query) is non-negotiable — it proves the Core Value and gates refresh and locale decisions. See `FEATURES.md` for the full prioritization matrix and competitor analysis.

**Must have (table stakes):**
- Post template as code + blocking QA gates — without this, autonomous publishing is a spam risk
- Topic-cluster silos + internal-linking engine + related posts + TOC/callouts — the authority and retention architecture
- Comparison-table component (non-monetized, affiliate-ready) — niche's highest-intent content shape
- Author/entity pages + About/editorial-policy/Contact/legal + HTTPS — EEAT + trust floor (real identity only)
- Article + BreadcrumbList JSON-LD (FAQPage as parser hygiene) + sitemaps/canonicals + indexing pipeline — crawlability floor
- Country-segmented analytics + CWV-green static/edge rendering + refresh/update cycle scaffolding — measurement and durability
- Comments CLOSED by explicit policy in v1 — deliberate stance, not an omission

**Should have (competitive):**
- Pillar hub pages per silo — trigger: 8–12 cluster posts per silo
- Programmatic best-X/vs comparison engine — biggest v1.x traffic lever after core template; needs originality guardrails
- Content-decay radar + auto-refresh prioritization — refresh what loses money, not randomly
- Hands-on-experience signals (scripted trials, screenshots, mini-benchmarks) — the EEAT moat AI farms can't fake; highest cost, phase in
- Breadcrumb nav + reading-progress UI — cheap engagement lift; breadcrumbs mirror BreadcrumbList schema

**Defer (v2+):**
- Newsletter capture (inline → exit-intent), gated comments on high-traffic pillars, monetization activation (affiliate/ads) — PROJECT.md already defers; slots designed-in but inactive
- Original data/micro-surveys, multi-locale variants (en-GB/CA/AU), finance-adjacent YMYL silos — needs authority, budget, or stricter sourcing rules first
- Anti-features to actively avoid: faceted/filtered nav, aggressive popups, volume-without-gates (10/day), multi-niche launch, manual review UI in v1, native app/forum

### Architecture Approach

The system is a serial fail-closed pipeline feeding a static-first site with a measurement loop: Keyword Research (per-geo, KD<20, vol 500–5k) → Competitor Gap brief → Outline Builder (structure-lint before any LLM spend) → section-wise Draft → composite QA gate (any critical fail = quarantine, never publish) → MDX commit → revalidate → sitemap regen → IndexNow POST (Bing et al.) + GSC sitemap track (Google) → GSC/engagement monitoring → refresh queue re-entering the pipeline as updates. URLs stay flat (`/blog/{slug}`); hierarchy lives in breadcrumbs, BreadcrumbList schema, silo landings, and the link graph — so posts migrate silos without redirects. One scheduler owns the day (Vercel Cron primary), every stage is idempotent (claim-by-hash, upsert-by-slug), and QA sits at three points: cheap should-this-exist at the brief, the unskippable gate after the draft, fast tone/link/schema checks pre-publish, plus the async decay monitor. See `ARCHITECTURE.md` for the system diagram, project structure, and all seven patterns with code sketches.

**Major components:**
1. Content pipeline (`lib/pipeline/`: keyword → gap → outline → draft → qa → publish) — stage-isolated, independently testable; QA is a separate module so draft code can't bypass gates
2. Keyword/Cluster Registry (status: queued → claimed → … → published → monitoring) — the concurrency control and single source of truth for queue, idempotency, and link graph
3. Render layer (Next.js App Router: homepage hubs, `[silo]/` landings, `blog/[slug]` MDX + TL;DR + FAQ + related, author pages) — static Server Components, zero-JS content display
4. SEO primitives (`lib/seo/`: typed JSON-LD builders, link-graph builder/suggester, `indexnow.ts`) + `sitemap.ts`/`robots.ts`/RSS/hreflang/canonical/OG/`next/image` — single-source rule: no SEO string exists in two places
5. Orchestration + state (cron, run log + DLQ, asset store, analytics store) — cron enqueues, workers execute; missed/duplicate runs self-heal
6. Index + monitor loop (indexing dispatcher → GSC perf/coverage pulls → striking-distance/decay/thin/cannibalization reports → refresh queue) — ~20–30% of pipeline capacity reserved for refresh from the start

### Critical Pitfalls

Twelve pitfalls researched (all mapped to phases in `PITFALLS.md`); the top five are survival-critical and share one property — each compounds with every published post, so prevention must precede volume.

1. **Scaled-content-abuse classification (existential)** — velocity without differentiation + zero human gate reads as mass production. Avoid with automated QA as the substitute gate (originality + information-gain + template-diversity), publish-or-quarantine, quarantine-rate health metric, velocity gated on indexed-ratio (3–4/week → daily after 60+ days), and Who/How/Why disclosure.
2. **Thin, zero-originality content** — LLM averaging without grounding inputs; writing to a word count; invented FAQs. Avoid with per-post-type grounding requirements (dated prices/specs/screenshots/versions), information-gain check vs. top-3 competitors, PAA-derived FAQs only (drop the block when <3 genuine questions), and quality floors instead of length floors.
3. **Fabricated E-E-A-T** — invented authors with AI headshots are explicitly called deception by Google; discovery destroys trust permanently. Avoid with one real verifiable publisher identity, transparent AI-assisted byline, editorial-process page, per-post primary-source citations, and a ban on AI faces.
4. **Hallucinated facts/prices/stats + YMYL overreach** — models predict words, not facts; finance-adjacent errors become YMYL violations. Avoid with a claim-extraction-and-live-verification sub-stage (unverifiable claims cut, not softened), source-dated stats, code-enforced topic blocklist (no tax/banking/credit/health in v1), and as-of dates on all date-sensitive claims.
5. **Index bloat + sitemap/canonical self-sabotage + locale duplication (combined crawl-efficiency cluster)** — daily publishing on a sandboxed domain with unfiltered sitemaps, archive/tag crawl surface, and four near-duplicate locales tanks the indexed ratio and trains Google to deprioritize the domain. Avoid with indexed ÷ submitted ≥ ~70% as the gating KPI, noindex-by-default archives/tags/pagination, sitemap = canonical 200-status posts only with diff-gated lastmod, single-source canonical/sitemap derivation with CI crawl-consistency checks, and single-locale launch (see corrected decisions).

## Implications for Roadmap

Based on research, suggested phase structure (compresses the 9-step dependency chain in `ARCHITECTURE.md` into roadmap phases; the invariant throughout is **no auto-publish before proven gates**):

### Phase 1: Site Foundation + SEO Primitives
**Rationale:** Nothing is indexable or trustworthy without this; blocks everything render-related. Cheapest catastrophic-risk removal (fake authorship, broken canonicals, CWV-red template) happens here.
**Delivers:** Next.js 16 scaffold + post renderer (2–3 hand-written seed posts, no pipeline yet), Metadata API + `sitemap.ts`/`robots.ts`/canonical/self-referencing + base schemas (Organization/WebSite), Content Collections wiring, About + editorial-process + real author identity + legal pages, CWV-budgeted template (server-rendered tables/TOC/FAQ, reserved dimensions, font discipline, inactive-but-dimensioned ad slots) with Lighthouse CI gates, noindex architecture for archives/tags, crawler-access smoke tests.
**Addresses:** Trust floor, CWV-green rendering, schema/sitemap/canonical floor, comments-closed-by-policy.
**Avoids:** Fabricated E-E-A-T, CWV template failures, Cloudflare/edge Googlebot blocking, index-bloat architecture.

### Phase 2: Silo IA + Link Graph + SEO Correctness CI
**Rationale:** Structure must exist before volume arrives — retrofitting 200 flat posts into silos is the canonical programmatic-SEO rewrite.
**Delivers:** 4–8 silo landings + pillar stubs, flat `/blog/{slug}` URLs with soft-silo linking, link-graph builder v1 (mandatory pillar up-link, sibling suggestions, related block, orphan scan), single-source canonical/sitemap derivation with CI crawl-consistency suite (no non-200/noindexed/non-canonical URLs, no chains, diff-gated lastmod), hreflang-capable plumbing shipped single-locale.
**Addresses:** Topic-cluster silos, related posts, breadcrumbs, category archives.
**Avoids:** Cannibalization sprawl (cluster map + keyword governance starts here), sitemap/canonical self-sabotage, premature multi-locale duplication.

### Phase 3: Content Pipeline + Fail-Closed QA Gates (the load-bearing wall)
**Rationale:** Autonomy without machine-enforced quality is the scaled-abuse pattern; outlines must validate before paying for drafts, and nothing auto-publishes before this is proven on seed content.
**Delivers:** Keyword registry (per-geo, KD<20/vol 500–5k guardrails, SERP-overlap anti-cannibalization check) → gap brief → outline + structure-lint → section-wise draft (dual-provider, per-stage model routing) → composite QA scorer (EEAT/originality-vs-corpus/information-gain-vs-top-3/thin-content/structure/fact-citation/banned-phrase/link-validity/image-alt/schema-validity, per-dimension veto) → quarantine queue (readable from day one) + fact-verification sub-stage + topic blocklist + originality gate + asset-license ledger; red-team proven (planted false price/stat and near-duplicate both quarantine).
**Addresses:** Post template as code, TL;DR/FAQ/TOC/callouts, comparison-table component, grounding inputs.
**Avoids:** Scaled-content classification, thin content, hallucinations, copyright infringement, YMYL overreach.

### Phase 4: Autonomous Publish + Indexing Dispatcher
**Rationale:** Needs real publishes to test against, but only after Phases 1–3 are green — this is the first autonomous post, still throttled to 3–4/week.
**Delivers:** Single-owner cron (Vercel Cron primary, Actions documented-but-disabled, `CRON_SECRET`, idempotent claim/cache/upsert, run log + DLQ), MDX commit → revalidate → sitemap regen ordering (URL must 200 before pinging), post-publish live-URL verifier (status/blocks/schema/links/placeholders; fail → auto-unpublish + alert), dead-man's switch + auto-pause after K consecutive failures, pinned 20-query eval set for prompt/model changes, dual-track indexing (IndexNow fire-and-forget for Bing et al. + sitemap/GSC-API track for Google; no Indexing-API misuse, no deprecated ping endpoint), image/OG pipeline (hero/OG/in-article, AVIF/WebP, LCP preload).
**Uses:** Vercel Cron + GitHub Actions fallback, `lib/seo/indexnow.ts`, `googleapis`, `@vercel/og`, `next/image`.
**Implements:** Single-owner idempotent cron, indexing fan-out with Google realism, publish-contract validation.
**Avoids:** Autonomous loop failures compounding, premature daily velocity, Google-track neglect.

### Phase 5: Observe, Refresh & Compound
**Rationale:** Needs weeks of live data; scaffolding (tables, jobs) can ship earlier, but decisions (pillars, scaling velocity, refresh) wait for decay/rank signals.
**Delivers:** Country-segmented dashboards (GSC by country × page × query + Plausible engagement; Tier-1 share as headline metric), indexed-ratio + coverage monitoring with alert thresholds, striking-distance (pos 5–20) and decay (>90d drop) reports, refresh queue (update bumps with `dateModified`, merge-with-301 consolidation, link repair), pillar hubs once silos reach 8–12 clusters, programmatic best-X/vs engine (distinct criteria per page), velocity scale to daily only on 60-day baselines, pruning runbook (improve/merge/noindex for zero-click 6-month posts).
**Addresses:** Country analytics, refresh cycle, pillar hubs, programmatic comparisons, hands-on testing signals (phased in when rankings plateau vs. human-tested rivals).
**Avoids:** Publish-and-forget rot, cannibalization sprawl, vanity-total analytics hiding non-Tier-1 traffic.

### Phase 6 (deferred, gated): Locales, Owned Channel, Monetization
**Rationale:** Each activates on a proven trigger, not a date — authority and traffic first, per PROJECT.md deferrals.
**Delivers:** en-GB/en-CA/en-AU variants (single-method hreflang, bidirectional + self-ref + x-default + valid `en-GB` codes, CI-validated, substantively localized pricing/providers — not spelling swaps) once US base ranks; inline → exit-intent newsletter on repeat-visitor trigger; gated comments on high-traffic pillars once moderation exists; affiliate/ads activation with `rel="sponsored"`, disclosures, and pre-reserved slot dimensions.
**Avoids:** Launch-day near-duplicate cluster, premature monetization CWV/trust damage, unmoderated-UGC spam exposure.

### Phase Ordering Rationale

- **Dependencies dictate the sequence:** render → indexability → structure → content-quality → autonomy → distribution → optimization (ARCHITECTURE.md §Build Order). Each phase's output is the next phase's precondition — e.g., link-graph needs the registry, QA needs validated outlines, cron needs proven gates, refresh needs live data.
- **Risk compounds per post, so prevention precedes volume:** all twelve pitfalls worsen with each published URL; platform correctness (Phase 1–2) and gates (Phase 3) must precede the first autonomous post (Phase 4), and velocity scales only on measured indexed-ratio and engagement baselines.
- **Deferral is a feature:** locales, newsletter, comments, monetization, and original-data moats are explicitly trigger-gated (Phase 6), keeping v1 scope to what a sandboxed domain can defend.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-research-phase` recommended):
- **Phase 3 (Pipeline + QA):** composite-scorer design (thresholds, per-dimension vetoes, judge-model bias guards), DataForSEO endpoint parameterization per geo, fact-verification claim-extraction approach — community-pattern consensus, no single-vendor canon.
- **Phase 5 (Observe/Refresh):** GSC API quota/lag handling (2–3 day data lag, URL Inspection 2,000 QPD budgeting), decay/thin/cannibalization detector thresholds — operational tuning with sparse authoritative docs.
- **Phase 6 (Locales):** hreflang single-method implementation + CI validator choice, substantive-localization depth per silo — high-cost mistake surface on a ranking domain.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Next.js 16 scaffold, Metadata API, `sitemap.ts`/`robots.ts`, JSON-LD-in-RSC, Content Collections wiring — official docs HIGH confidence, well-trodden.
- **Phase 2 (Silo IA):** hub-and-spoke IA, flat URLs + BreadcrumbList, related-post scoring — broad multi-source consensus.
- **Phase 4 (Publish/Cron):** Vercel Cron + `CRON_SECRET` + idempotency, IndexNow POST semantics, `next/image` + `@vercel/og` — official docs HIGH confidence.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official docs + registry facts (Next 16 line, Vercel Cron limits, next-seo 7.3.0, IndexNow non-support by Google, Indexing API scope); verify exact minors (Content Collections major, Tailwind pin) at scaffold |
| Features | MEDIUM | Websearch + official Google policy docs; no library-level verification applied; Dec-2025 traffic stats single-sourced — flag for validation |
| Architecture | MEDIUM | Official Next.js/Vercel/IndexNow docs agree; pipeline-orchestration specifics are community consensus, not canon |
| Pitfalls | HIGH | Policy pitfalls verified against current Search Central docs (spam policies, helpful content, gen-AI guidance, hreflang, traffic-drop debugging); operational thresholds (70% indexed ratio, 3–4/week ramp) are established practice, validate during implementation |

**Overall confidence:** MEDIUM-HIGH (direction is solid; numbers need implementation-time verification)

### Gaps to Address

- **Content Collections latest major + Tailwind v4 pin at scaffold:** rev faster than frameworks — check repo pulse and `create-next-app` pins during Phase 1; fallback is fumadocs-mdx, then zod-guarded hand-rolled loader.
- **Velite maintenance status unverified:** not recommended until confirmed — resolve only if Content Collections proves unmaintained.
- **Cloudflare-in-front-of-Vercel cache rules:** exact bypass/purge-by-tag configuration for sitemaps/robots/hreflang pages — resolve in Phase 1 infra work with post-deploy Googlebot-fetch verification.
- **DataForSEO pricing drift (July 2026 +20%, pay-as-you-go-only):** re-budget per-post keyword cost at purchase; enforce batch + cache-everything from the first call.
- **Dec-2025 core-update impact stats (−85–95% unedited AI, +23% authority):** single-source, training-data-adjacent — treat as directional, validate against own GSC baselines in Phase 5.
- **Plausible geo accuracy for Tier-1 segmentation:** verify country-split fidelity against GSC country dimensions before trusting Tier-1-share KPIs.

## Corrected Decisions (supersede PROJECT.md where they conflict)

Recorded here so the roadmapper plans against research, not stale assumptions:

1. **Locales: launch en-US (+ x-default) only; defer en-GB/en-CA/en-AU.** PROJECT.md's day-one 4-locale hreflang creates a near-duplicate cluster (~98% identical) that Google consolidates or reads as doorway duplication on a zero-authority domain. Phase 6 re-introduces locales when the US base ranks, with CI-validated hreflang (`en-GB` never `en-UK`, bidirectional + self-ref + x-default) and substantive localization — recorded per PITFALLS Pitfall 7.
2. **FAQPage schema is hygiene, not a lever — keep visible FAQs, drop FAQ expectations.** PROJECT.md's FAQ-schema focus predates Google's full FAQ-rich-result removal (May 2026, following Aug 2023 restriction). Visible FAQ content still wins PAA/long-tail/AI citations; markup stays as cheap parser hygiene with conditional rendering (no fake Q&A) — recorded per FEATURES nuance and ARCHITECTURE Pattern 4.
3. **Google indexing track is sitemaps + GSC API, not IndexNow or ping endpoints.** IndexNow covers Bing/Yandex/Naver/Seznam/Yep only; the `google.com/ping?sitemap=` endpoint is retired; the Indexing API is JobPosting/Livestream-scoped (blog submissions silently dropped, quota burned). Same-publish-step dual track from Phase 4 — recorded per STACK "What NOT to Use."
4. **Next.js 16.x latest (not 14); Content Collections (not Contentlayer); next-seo for JSON-LD only.** PROJECT.md's "14+" floor is satisfied by going latest (15.x nearing EOL); Contentlayer is sponsor-acquired and App Router-incompatible; meta tags belong to the native Metadata API — recorded per STACK.
5. **QA gates + quarantine + auto-pause precede the first auto-post; velocity ramps 3–4/week → daily.** PROJECT.md's zero-human-gate + ≥1/day from launch is the scaled-abuse shape without this gate-first ordering and ratio-gated ramp. The three-point gate placement, red-teamed verifier, and dead-man's switch are launch requirements, not hardening — recorded per PITFALLS 1/11 and ARCHITECTURE invariant.

## Sources

### Primary (HIGH confidence)
- Next.js official docs — App Router MDX guide, JSON-LD guide, `generateSitemaps`, ISR/caching (v16) — framework, rendering, schema, sitemap conventions
- Next.js blog — 16.2/16.3/16.4 releases, Sept/Oct 2026 + security releases — 16.x current stable line
- Vercel docs — Cron usage & pricing (Jul/Sep 2026): 100 jobs all plans, Hobby once/day, UTC-only, `CRON_SECRET`, production-only — scheduler choice
- Google Search Central — spam policies (scaled content abuse, scraping, circumvention, copyright demotion), helpful people-first content (self-assessment, fabricated authorship), gen-AI guidance (fact-check duty), traffic-drop debugging, localized-versions/hreflang — all policy pitfalls
- GitHub garmeeh/next-seo releases — 7.3.0 (Jul 2026), CSP nonce, App Router compat — structured-data library scope
- npm registry — fumadocs-mdx 15.4.7, next-sitemap 4.2.3, next-seo v7 lineage — version facts
- Fumadocs docs — Content Collections support, Contentlayer deprecation — content-layer direction
- IndexNow protocol docs + Bing Webmaster getstarted — POST semantics, 10k/batch, key file, participant engines (no Google)
- Google Developers — Search Console API limits: URL Inspection 2,000 QPD / 600 QPM

### Secondary (MEDIUM confidence)
- Dub blog — Contentlayer → Content Collections migration rationale
- Vercel + FocusReactive + Pagepro + DigitalApplied 2026 SEO guides — Metadata API, INP-over-FID, JSON-LD-in-RSC, schema-dts
- Stackmatix + DEV/polychart 2026 — Indexing API JobPosting/Livestream-only, 200/day quota
- DataForSEO official pricing + July 2026 update + Labs cost example — keyword-data costs (re-verify at purchase)
- HubSpot / Moz / Search Engine Land — topic-cluster + pillar/cluster linking model
- Semrush / SurferSEO / Keywords Everywhere 2026 EEAT guides + Quality Rater framing — authorship and experience signals
- Botify / Lumar / SEO Clarity / StudioHawk — faceted-nav crawl hazards consensus
- Contentify / CodeWords pipelines, CORE-EEAT dimensions — QA-gate placement patterns

### Tertiary (LOW confidence, needs validation)
- Razor Rank / Mangools 2026 — Dec 2025 core-update impact magnitudes (deep authority +23%, unedited AI −85–95%) — single-source stats, treat as directional
- 2026 Next.js tutorial (tech-insider.org) — 16.3.1 stable/LTS corroboration — single source
- Plausible/GA4 comparison posts 2026 — script weight, consent posture — vendor-adjacent, directionally consistent
- March 2024 core/spam update enforcement specifics (~45% unhelpful-content reduction target, autoblog deindexing waves) — widely reported, verify specifics during planning

---
*Research completed: 2026-10-16*
*Ready for roadmap: yes*
