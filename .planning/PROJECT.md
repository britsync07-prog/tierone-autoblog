# TierOne AutoBlog

## What This Is

TierOne AutoBlog is a fully automated blogging platform built to capture high-volume organic search traffic exclusively from Tier-1 countries (US, UK, CA, AU). A Next.js site publishes one or more long-form, SEO-structured articles daily, produced end-to-end by an autonomous AI agent (keyword research → outline → draft → optimize → publish) with zero human gating in v1. Content targets broad-appeal, high-demand topics in the Tech/AI & Digital Tools niche first, expanding to adjacent finance/software topics once topical authority is established.

## Core Value

Tier-1 readers find our articles on Google page 1 and stay to read — organic sessions from US/UK/CA/AU grow every week.

## Requirements

### Validated

- [x] Core Web Vitals green: LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile and desktop — Validated in Phase 1: Site Foundation + Trust (01-VERIFICATION.md 5/5, LHCI median home 0.95 / post 0.93)
- [x] Programmatic SEO architecture: Article + FAQPage + BreadcrumbList schema, XML sitemaps, canonical tags, topic-cluster siloing — Validated in Phase 2: SEO Architecture + Silo IA (02-VERIFICATION.md 5/5; single-source builders, split sitemaps, 5 silo landings, hreflang plumbing, noindex CI gate)

### Active

- [ ] Daily automated publishing: scheduled pipeline publishes ≥1 formatted post/day without human intervention
- [ ] AI content agent: researches keywords, analyzes competitors, generates outlines, drafts 1,500–2,500 word articles, optimizes on-page SEO
- [ ] Strict post structure: H1 (50–60 chars), meta description (150–160 chars), clean slug, TL;DR answer box in first 100 words, H2/H3 body with tables/lists, 3–5 FAQ items, conclusion + CTA
- [ ] Programmatic SEO architecture: Article + FAQPage + BreadcrumbList schema, XML sitemaps, canonical tags, internal-link automation, topic-cluster siloing
- [ ] Core Web Vitals green: LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile and desktop
- [ ] Internal-link automation: silo up-links + Related blocks wired; contextual in-body suggestions deferred to Phase 3
- [ ] Tier-1 geo-targeting: Cloudflare CDN + US origin; single-locale en-US canonical (+ x-default hreflang) at launch per research Corrected Decisions — 4-locale variants deferred; localized spelling/currency ($/£) at content time
- [ ] Retention/CTR optimization: short paragraphs, bold takeaways, callout boxes, comparison tables, related-post CTAs to cut bounce and lift ad viewability
- [ ] EEAT + anti-spam safeguards: author entities, sourced statistics, expert framing, originality checks, thin-content detector, update/refresh cycle
- [ ] Indexing pipeline: IndexNow (Bing et al.) + sitemap submission/Search Console API Google track — sitemap "ping" endpoint retired, not used
- [ ] Analytics foundation: traffic by country, rankings, CTR, engagement — country-segmented dashboards

### Out of Scope

- Monetization (AdSense/Mediavine/affiliates) — deferred; v1 optimizes purely for Tier-1 visitor volume, ad slots designed-in but not activated — per owner decision
- Multi-niche launch (finance, health, home) — v1 is Tech/AI & Digital Tools only; topical authority first, expansion later — why: diluted authority kills rankings
- Native mobile app, newsletter platform, community/forum — why: traffic comes from Google, not owned channels, in v1
- Manual editorial workflow UI — v1 is fully autonomous; review UI is a future safety addition if spam penalties appear

## Context

- Owner directive (2026-10-16): maximize Tier-1 visitors; agent decides niche/stack; fully autonomous publishing; no monetization work in v1.
- Niche decision (agent-made): Tech/AI & Digital Tools (AI tools, VPNs, hosting, streaming, smart home, productivity software) — rationale: massive Tier-1 search volume, strong commercial/informational mix, far lower YMYL/EEAT barrier than finance/health, ideal for AI-written content to rank.
- Expansion path: finance-adjacent software topics (budgeting apps, tax software, banking reviews) → standalone finance silo once domain authority exists.
- Stack decision (agent-made): Next.js 16.x App Router + MDX content (Content Collections + zod), deployed on Vercel/Cloudflare edge — per research Corrected Decisions (supersedes the original "14+" floor). Rationale: best Core Web Vitals control, file/API-driven publishing ideal for automation, schema/sitemap fully programmable. Ghost/WordPress rejected for v1 (plugin weight, slower TTFB, harder pipeline control).
- Tone: native US/international English, authoritative + conversational, no AI clichés ("delve", "fast-paced world"), active voice, 2–3 sentence paragraphs.
- Search reality: new domain = 3–6 month sandbox; v1 wins via long-tail low-competition keywords (KD < 20, volume 500–5k) before head terms.

## Constraints

- **Tech stack**: Next.js 16.x (App Router), MDX (Content Collections), TypeScript (strict), Tailwind — why: speed + automation control
- **Language**: English only, en-US primary with en-GB/CA/AU variants — why: Tier-1 only
- **Automation**: Zero human gate in publishing loop (v1) — why: owner chose fully autonomous
- **Quality floor**: Every post must pass EEAT/originality/thin-content checks or it does not publish — why: Google spam-policy survival
- **Performance**: 90+ Lighthouse on mobile, fully static/edge-cached — why: rankings + ad viewability later
- **Compliance**: No scraped content, no cloaking, no doorway pages; affiliate links disclosed when added — why: manual-action avoidance

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1 niche: Tech/AI & Digital Tools | Max Tier-1 volume with lowest YMYL risk for AI content; high SaaS affiliate optionality later | — Pending |
| Stack: Next.js + MDX on edge | Fastest CWV, programmable SEO, API publishing; beats Ghost/WP for automation | — Pending |
| Fully autonomous publishing | Owner choice for volume; mitigated by automated QA gates | — Pending |
| Monetization deferred | Owner priority is visitors first; ad slots designed-in but inactive | — Pending |
| Long-tail-first keyword strategy | New domains cannot win head terms; KD<20 programmatic clusters compound | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-17 after Phase 2 completion (SEO-01..05 + GEO-01/03 validated; stack + hreflang lines corrected to research decisions)*
