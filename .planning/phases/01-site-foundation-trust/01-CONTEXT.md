# Phase 1: Site Foundation + Trust - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Visitors can load fast, readable, trustworthy article pages served from the edge.
Scope anchor: SITE-01 (CWV/Lighthouse 90+), SITE-02 (article template), SITE-03
(trust pages), SITE-04 (OG/Twitter images), GEO-02 (Vercel + Cloudflare edge,
US origin, HTTPS). SEO architecture (sitemaps, JSON-LD builders, canonicals,
silo landings) belongs to Phase 2 — Phase 1 template must simply not block it.
</domain>

<decisions>
## Implementation Decisions

### Site branding & visual identity
- **D-01:** Brand direction is OpenCode's discretion — propose 2-3 concrete
  keyword-descriptive names (Tech/AI niche clarity) for owner approval.
- **D-02:** Logo is a minimal inline SVG mark + wordmark (no custom logo set,
  no image weight).
- **D-03:** Visual personality is clean editorial light (white bg, dark text,
  one restrained accent). No dark mode, no theme toggle in v1.
- **D-04:** Production domain is `exclusivesources.online` (owner-supplied).
  Vercel + Cloudflare CDN front, US origin, HTTPS everywhere, correct
  Googlebot cache-bypass behavior.

### Article template & reading feel
- **D-05:** Article layout is a classic narrow measure (~65ch) with a sticky
  TOC sidebar on desktop collapsing inline on mobile.
- **D-06:** TL;DR answer-box prominence is OpenCode's discretion (box in first
  100 words is mandatory per pipeline template; visual weight flexible).
- **D-07:** Component treatment is rich structured: short paragraphs, bold
  takeaways, tinted callout boxes, striped comparison tables, Shiki
  server-rendered code highlighting, GFM tables, stable heading anchors.
- **D-08:** Interactivity is static-plus-touches only: reading-progress bar,
  code copy buttons, heading anchors. No FAQ accordions, no share widgets,
  near-zero client JS on article pages.
- **D-09:** Homepage shape is OpenCode's discretion (simple latest-posts index
  recommended — no silo assumptions before Phase 2).
- **D-10:** Typography uses the system font stack. No webfonts in v1 (LCP
  protection).
- **D-11:** Invisible fixed-dimension ad slots are reserved in the v1 template
  now (monetization deferred per spec; zero layout shift on later activation).

### Trust pages & publisher identity
- **D-12:** Publisher is a real individual byline: **Musfiqur Rahman Saimon**,
  Full-Stack Product Engineer (Bangladesh). No fabricated authors, no AI
  headshots — ever. See Specifics for bio facts and profile links.
- **D-13:** Contact page is email-link only: `saimon@ascentraconsulting.co.uk`
  displayed as-is (owner confirmed; cross-domain address accepted for v1).
  No contact form, no backend.
- **D-14:** Separate About page AND dedicated editorial-process page (not a
  single folded page). Process page carries the AI-assistance disclosure.
- **D-15:** Privacy/Terms are generator-based pages adapted to the site now;
  counsel review deferred until revenue justifies it.
- **D-16:** Every post carries a visible AI-assistance badge/note linking to
  the editorial-process page (per-post disclosure, not process-page-only).
- **D-17:** Author photo is a real owner-supplied headshot with an initials
  monogram fallback if the file is missing at build time.

### Seed posts & social images
- **D-18:** Phase 1 ships **5 seed posts**.
- **D-19:** Seed topics are OpenCode's discretion (AI-tools focus recommended —
  highest Tier-1 volume and matches publisher's AI-tooling background).
- **D-20:** Seeds are full template-conformant posts (H1 50-60 chars, meta
  150-160, TL;DR ≤100 words, H2/H3 body, tables/lists, 3-5 FAQs, conclusion +
  CTA) — they become the Phase 3 pipeline reference, not throwaway content.
- **D-21:** OG/Twitter images use a brand-style title card: post title +
  brand mark on the light editorial background, generated programmatically
  per post (`opengraph-image.tsx` + `@vercel/og`).

### OpenCode's Discretion
- Brand name proposals (D-01): 2-3 concrete names for owner approval.
- TL;DR visual prominence (D-06) within the mandatory first-100-words box.
- Homepage shape (D-09): simple latest-posts index recommended.
- Seed topic selection (D-19): AI-tools focus recommended.
- Locked stack (no discretion): Next.js 16.x App Router, React 19.2,
  TypeScript strict, Tailwind v4, Content Collections + zod, single-locale
  en-US launch — per research corrected decisions.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — vision, active requirements, constraints (Tier-1
  only, autonomous publishing, quality floor, CWV 90+, compliance).
- `.planning/REQUIREMENTS.md` — SITE-01..04 + GEO-02 acceptance criteria
  (this phase); out-of-scope list (no monetization, single-locale, no
  comments, no faceted nav, no fabricated authors).
- `.planning/ROADMAP.md` — Phase 1 goal, dependencies (none — first phase),
  success criteria, ordering invariant (no auto-publish before proven QA).

### Research (stack + architecture authority)
- `.planning/research/STACK.md` — locked stack: Next.js 16.x, Content
  Collections, next-seo v7 JSON-LD-only, @vercel/og, Plausible; install
  commands and version matrix. Supersedes PROJECT.md "Next.js 14+" floor.
- `.planning/research/SUMMARY.md` — corrected decisions (16.x not 14,
  Content Collections not Contentlayer, single-locale launch, FAQPage
  hygiene), post-template-as-code spec, trust floor, pitfall mitigations.
- `.planning/research/ARCHITECTURE.md` — system context (pipeline, render
  layer, SEO primitives); Phase 1 builds the render-layer foundation only.
- `.planning/research/PITFALLS.md` — fabricated-E-E-A-T ban, scaled-abuse
  shape avoidance, index-bloat guards relevant to template choices.
- `.planning/research/FEATURES.md` — post-template element spec, trust-floor
  checklist, deferred items (newsletter, comments, monetization).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repository. No `src/`, no `app/`, no components. Only
  `AGENTS.md` (repo root) and `.planning/` exist. Phase 1 scaffolds from zero.

### Established Patterns
- None yet. Planner establishes: App Router Server Components, static-first
  article rendering, Tailwind v4 + `@tailwindcss/typography`, Content
  Collections + zod frontmatter schema, system font stack.

### Integration Points
- Domain `exclusivesources.online` → Vercel project + Cloudflare CDN front
  (GEO-02). Planner wires DNS/cache rules (bypass HTML, long-cache hashed
  static assets) and HTTPS.
- Forward-compat with Phase 2: flat `/blog/{slug}` URLs, breadcrumb-ready
  hierarchy, single-source SEO string rule (no SEO text in two places).
</code_context>

<specifics>
## Specific Ideas

- Publisher: **Musfiqur Rahman Saimon** — Full-Stack Product Engineer,
  Bangladesh. Focus: "Shipping complete, production-grade products."
  Philosophy: "Paper-trade it, test it, then deploy it." Currently building:
  AI-powered tooling & agent integrations (MCP).
- Contact email: `saimon@ascentraconsulting.co.uk` (display as-is).
- LinkedIn: `https://www.linkedin.com/in/musfiqur-rahman-saimon-a5994b3aa`
- GitHub: `https://github.com/britsync07-prog`
- Author page links out to both profiles; location stated factually.
- Production domain: `https://exclusivesources.online/`
- Owner keywords during discussion: none beyond the facts above — open to
  standard approaches everywhere marked "You decide".
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 1-Site Foundation + Trust*
*Context gathered: 2026-10-16*
