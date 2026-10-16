# Requirements: TierOne AutoBlog

**Defined:** 2026-10-16
**Core Value:** Tier-1 readers find our articles on Google page 1 and stay to read — organic sessions from US/UK/CA/AU grow every week.

## v1 Requirements

### Site Foundation

- [ ] **SITE-01**: Visitor can load any page with LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile (Lighthouse 90+)
- [ ] **SITE-02**: Visitor can read articles with TL;DR box, TOC, tables, callouts, code blocks on a CWV-budgeted template
- [ ] **SITE-03**: Visitor can verify publisher trust via real author page, About, editorial-process, Contact, Privacy/Terms pages
- [ ] **SITE-04**: Visitor can share any post with correct OG/Twitter programmatic image and title

### SEO Architecture

- [ ] **SEO-01**: Crawler can discover all posts via split XML sitemaps (posts only = canonical 200-status, diff-gated lastmod) + robots.ts
- [ ] **SEO-02**: Post page emits valid Article + BreadcrumbList JSON-LD (FAQPage as hygiene) with single-source builders
- [ ] **SEO-03**: Post URL is flat `/blog/{slug}` with self-referencing canonical; hierarchy via breadcrumbs + silo landings
- [ ] **SEO-04**: Site enforces crawl efficiency: archives/tags/pagination noindexed, CI crawl-consistency suite green
- [ ] **SEO-05**: Visitor can navigate 4–8 silo landing pages with hub-and-spoke cluster links (flat URLs, soft silos)

### Content Pipeline

- [ ] **PIPE-01**: System maintains keyword registry (per-geo US/UK/CA/AU, KD < 20, volume 500–5k, anti-cannibalization SERP-overlap check)
- [ ] **PIPE-02**: System generates competitor gap brief + outline per keyword, structure-linted before draft spend
- [ ] **PIPE-03**: System drafts 1,500–2,500 word posts section-wise (dual LLM provider) in the strict template (H1 50–60 chars, meta 150–160, TL;DR ≤100 words, H2/H3, tables/lists, 3–5 PAA-derived FAQs, conclusion + CTA)
- [ ] **PIPE-04**: System renders comparison-table component and related-post block (same-silo, zero orphans, mandatory pillar up-link)
- [ ] **PIPE-05**: System processes post images (hero/OG/in-article, AVIF/WebP, LCP preload, alt text enforced)

### Quality Gates (EEAT + Anti-Spam)

- [ ] **QA-01**: System blocks publishing on any critical QA fail (originality, information-gain vs top-3, thin-content floor, banned-phrase, link-validity, schema-validity) — quarantine, never fail-open
- [ ] **QA-02**: System verifies factual claims against live sources (unverifiable claims cut) with source-dated stats and as-of dates
- [ ] **QA-03**: System enforces topic blocklist (no tax/banking/credit/health/finance-advice in v1) and real-publisher byline (no fabricated authors, AI-process disclosure)
- [ ] **QA-04**: System auto-pauses publishing after K consecutive failures with owner alert + readable quarantine queue

### Autonomous Publish + Indexing

- [ ] **AUTO-01**: System publishes on schedule via single-owner cron (Vercel Cron primary, idempotent claim-by-hash, run log + DLQ), starting 3–4 posts/week
- [ ] **AUTO-02**: System runs post-publish live-URL verifier (status/schema/links/placeholders); fail triggers auto-unpublish + alert
- [ ] **AUTO-03**: System dispatches dual-track indexing per post (IndexNow for Bing et al. + sitemap/GSC-API track for Google)
- [ ] **AUTO-04**: System pins a 20-query eval set guarding prompt/model changes from ranking regressions

### Geo-Targeting (v1 = single-locale launch)

- [ ] **GEO-01**: US visitor gets en-US canonical (+ x-default) with USD pricing, US providers, imperial+metric where natural
- [ ] **GEO-02**: Site serves from edge (Vercel + Cloudflare CDN front, correct Googlebot cache-bypass, US origin) with HTTPS everywhere
- [ ] **GEO-03**: Site ships hreflang-capable plumbing validated by CI, launched single-locale (multi-locale deferred to trigger)

### Observe + Compound

- [ ] **GROW-01**: Owner can view country-segmented dashboard (GSC country × page × query + Plausible engagement; Tier-1 share headline, indexed-vs-submitted ratio ≥70%)
- [ ] **GROW-02**: System produces striking-distance (positions 5–20) and decay (>90d drop) reports feeding a refresh queue (dateModified bumps, merge-with-301, link repair)
- [ ] **GROW-03**: System scales velocity to daily only after 60+ days of healthy baselines; pillar hubs built at 8–12 clusters per silo

## v2 Requirements

### Locales + Owned Channel

- **LOCL-01**: UK/CA/AU visitors get substantively localized variants (pricing/providers, not spelling swaps) with valid hreflang
- **NEWS-01**: Repeat visitor can subscribe via inline then exit-intent newsletter capture
- **SOC-01**: High-traffic pillar readers can comment under gated moderation

### Monetization (deferred, slots pre-designed)

- **MON-01**: Owner can activate affiliate blocks with rel="sponsored" + disclosures without layout shift (slots pre-reserved)
- **MON-02**: Owner can activate display ads (AdSense → Mediavine path) within CWV budgets

### Authority Moats

- **MOAT-01**: Posts include hands-on testing signals (scripted trials, screenshots, mini-benchmarks)
- **MOAT-02**: Site publishes original data/micro-surveys per silo
- **MOAT-03**: System runs programmatic best-X/vs comparison engine with distinct criteria per page

## Out of Scope

| Feature | Reason |
|---------|--------|
| Day-one monetization (ads/affiliates active) | Owner deferred; v1 = visitors only, slots inactive but dimensioned |
| 4-locale launch (en-GB/CA/AU variants day one) | ~98% near-duplicate cluster risks doorway handling on zero-authority domain; single-locale first per research |
| Multi-niche launch (finance/health/home) | Dilutes topical authority; finance/health are YMYL minefields for AI content |
| Comments open in v1 | Spam + UGC risk on zero-gate AI blog with no moderation; closed-by-policy |
| Faceted/filtered archive navigation | Burns crawl budget, dilutes equity on new domain |
| 10-posts/day volume | Scaled-abuse shape; velocity ratio-gated (3–4/week → daily) |
| Fabricated author personas with AI headshots | Explicit deception per Google; real publisher identity only |
| Google Indexing API for blog posts | JobPosting/Livestream-scoped; submissions silently dropped |
| Manual review UI in v1 | Contradicts fully-autonomous directive; quarantine queue is the safety surface |
| Native mobile app / forum / community | Traffic comes from Google in v1, not owned channels |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SITE-01 | TBD | Pending |
| SITE-02 | TBD | Pending |
| SITE-03 | TBD | Pending |
| SITE-04 | TBD | Pending |
| SEO-01 | TBD | Pending |
| SEO-02 | TBD | Pending |
| SEO-03 | TBD | Pending |
| SEO-04 | TBD | Pending |
| SEO-05 | TBD | Pending |
| PIPE-01 | TBD | Pending |
| PIPE-02 | TBD | Pending |
| PIPE-03 | TBD | Pending |
| PIPE-04 | TBD | Pending |
| PIPE-05 | TBD | Pending |
| QA-01 | TBD | Pending |
| QA-02 | TBD | Pending |
| QA-03 | TBD | Pending |
| QA-04 | TBD | Pending |
| AUTO-01 | TBD | Pending |
| AUTO-02 | TBD | Pending |
| AUTO-03 | TBD | Pending |
| AUTO-04 | TBD | Pending |
| GEO-01 | TBD | Pending |
| GEO-02 | TBD | Pending |
| GEO-03 | TBD | Pending |
| GROW-01 | TBD | Pending |
| GROW-02 | TBD | Pending |
| GROW-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 0
- Unmapped: 28 ⚠️

---
*Requirements defined: 2026-10-16*
*Last updated: 2026-10-16 after initial definition*
