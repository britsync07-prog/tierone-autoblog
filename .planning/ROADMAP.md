# Roadmap: TierOne AutoBlog

## Overview

Tier-1 readers find our articles on Google page 1 and stay to read. We get there in dependency order: render → indexability → structure → content-quality → autonomy → distribution → optimization. Platform correctness (Phases 1–2) and proven fail-closed QA gates (Phases 3–4) precede the first autonomous post (Phase 5); velocity scales only on measured baselines and compounding comes from observe-and-refresh (Phase 6). Stack: Next.js 16.x + Content Collections + single-locale en-US launch (per research Corrected Decisions). The load-bearing invariant throughout: **no auto-publish before proven QA gates.**

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Site Foundation + Trust** - Fast, trustworthy article site on the edge with seed posts
- [ ] **Phase 2: SEO Architecture + Silo IA** - Crawlable flat-URL site with silo link graph and single-locale plumbing
- [ ] **Phase 3: Content Pipeline** - Serial gated pipeline from keyword registry to structured draft
- [ ] **Phase 4: Quality Gates** - Fail-closed EEAT/anti-spam gates with quarantine and auto-pause
- [ ] **Phase 5: Autonomous Publish + Indexing** - Throttled cron publishing with live-URL verification and dual-track indexing
- [ ] **Phase 6: Observe, Refresh + Compound** - Country-segmented analytics driving refresh, pillars, and gated velocity scale

## Phase Details

### Phase 1: Site Foundation + Trust
**Goal**: Visitors can load fast, readable, trustworthy article pages served from the edge
**Depends on**: Nothing (first phase)
**Requirements**: SITE-01, SITE-02, SITE-03, SITE-04, GEO-02
**Success Criteria** (what must be TRUE):
  1. Visitor loads any page with LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile (Lighthouse 90+)
  2. Visitor can read a seed article with TL;DR box, TOC, tables, callouts, and code blocks on the CWV-budgeted template
  3. Visitor can verify publisher trust via real author page, About, editorial-process, Contact, and Privacy/Terms pages
  4. Visitor sharing any post sees the correct OG/Twitter programmatic image and title in the unfurl
  5. US visitor is served from the edge (Vercel + Cloudflare CDN front, US origin) over HTTPS with correct Googlebot cache behavior
**Plans**: TBD
**UI hint**: yes

### Phase 2: SEO Architecture + Silo IA
**Goal**: Crawlers can discover, understand, and efficiently crawl every post inside a topical silo structure
**Depends on**: Phase 1
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, GEO-01, GEO-03
**Success Criteria** (what must be TRUE):
  1. Crawler can discover all posts via split XML sitemaps (posts only = canonical 200-status, diff-gated lastmod) plus robots.ts
  2. Post URL returns 200 at flat `/blog/{slug}` with a self-referencing canonical; hierarchy is visible via breadcrumbs and silo landings
  3. Post page emits valid Article + BreadcrumbList JSON-LD (FAQPage as hygiene) from single-source builders
  4. Archives, tags, and pagination are noindexed and the CI crawl-consistency suite is green
  5. Visitor can navigate 4–8 silo landing pages with hub-and-spoke cluster links; US visitor gets en-US canonical (+ x-default) and hreflang plumbing passes CI single-locale
**Plans**: TBD
**UI hint**: yes

### Phase 3: Content Pipeline
**Goal**: System can turn a governed keyword into a structured, template-conformant draft with assets
**Depends on**: Phase 2
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05
**Success Criteria** (what must be TRUE):
  1. Keyword registry holds per-geo (US/UK/CA/AU) candidates filtered to KD < 20 and volume 500–5k with SERP-overlap anti-cannibalization check
  2. Every keyword gets a competitor gap brief plus an outline that passes structure-lint before any draft spend
  3. Drafts land at 1,500–2,500 words in the strict template (H1 50–60 chars, meta 150–160, TL;DR ≤100 words, H2/H3 body, tables/lists, 3–5 PAA-derived FAQs, conclusion + CTA)
  4. Posts render a comparison-table component and a related-post block (same-silo, zero orphans, mandatory pillar up-link)
  5. Post images ship as hero/OG/in-article in AVIF/WebP with LCP preload and enforced alt text
**Plans**: TBD
**UI hint**: yes

### Phase 4: Quality Gates
**Goal**: No low-quality, unverified, or off-topic content can ever reach publish
**Depends on**: Phase 3
**Requirements**: QA-01, QA-02, QA-03, QA-04
**Success Criteria** (what must be TRUE):
  1. Any critical QA fail (originality, information-gain vs top-3, thin-content floor, banned-phrase, link-validity, schema-validity) blocks publishing into quarantine — never fail-open (red-team proven: planted false stat and near-duplicate both quarantine)
  2. Unverifiable factual claims are cut, not softened; statistics carry sources with dates and date-sensitive claims carry as-of dates
  3. Blocked topics (tax/banking/credit/health/finance-advice) are rejected and every byline is the real publisher with AI-process disclosure — no fabricated authors
  4. K consecutive failures auto-pause publishing with an owner alert, and the quarantine queue is human-readable
**Plans**: TBD

### Phase 5: Autonomous Publish + Indexing
**Goal**: System publishes on schedule and gets new posts indexed without human intervention
**Depends on**: Phase 4
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04
**Success Criteria** (what must be TRUE):
  1. System publishes 3–4 posts/week on schedule via single-owner cron (idempotent claim-by-hash, run log + DLQ) with no human gate
  2. Post-publish live-URL verifier checks status, schema, links, and placeholders on the real URL; any fail triggers auto-unpublish plus alert
  3. Every post dispatches dual-track indexing (IndexNow for Bing et al. + sitemap/GSC-API track for Google)
  4. The pinned 20-query eval set runs green, guarding prompt/model changes against ranking regressions
**Plans**: TBD

### Phase 6: Observe, Refresh + Compound
**Goal**: Owner can see Tier-1 growth by country and the system compounds it via refresh and gated scale-up
**Depends on**: Phase 5
**Requirements**: GROW-01, GROW-02, GROW-03
**Success Criteria** (what must be TRUE):
  1. Owner can view a country-segmented dashboard (GSC country × page × query + Plausible engagement) with Tier-1 share as the headline and indexed-vs-submitted ratio ≥ 70%
  2. Striking-distance (positions 5–20) and decay (>90d drop) reports feed a refresh queue (dateModified bumps, merge-with-301, link repair)
  3. Publishing velocity scales to daily only after 60+ days of healthy baselines, and pillar hubs exist once silos reach 8–12 clusters
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Site Foundation + Trust | 0/TBD | Not started | - |
| 2. SEO Architecture + Silo IA | 0/TBD | Not started | - |
| 3. Content Pipeline | 0/TBD | Not started | - |
| 4. Quality Gates | 0/TBD | Not started | - |
| 5. Autonomous Publish + Indexing | 0/TBD | Not started | - |
| 6. Observe, Refresh + Compound | 0/TBD | Not started | - |
