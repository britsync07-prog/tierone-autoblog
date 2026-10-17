# Phase 2: SEO Architecture + Silo IA - Context

**Gathered:** 2026-10-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Crawlers can discover, understand, and efficiently crawl every post inside a topical silo structure.

Scope anchor: SEO-01 (split sitemaps + robots.ts), SEO-02 (Article + BreadcrumbList JSON-LD, FAQPage hygiene, single-source builders), SEO-03 (flat `/blog/{slug}` + self-referencing canonical; hierarchy via breadcrumbs + landings), SEO-04 (archives/tags/pagination noindexed + CI crawl-consistency suite), SEO-05 (4–8 silo landings, hub-and-spoke), GEO-01/GEO-03 (en-US canonical + x-default, hreflang-capable plumbing, single-locale launch). Phase 1 flat URLs, single-source `lib/site.ts` rule, and single-locale decision are locked and carry forward — Phase 2 extends, never retrofits.
</domain>

<decisions>
## Implementation Decisions

### Silo inventory & landing shape
- **D-01:** Keep the 5 seed silos as the landing set: `ai-writing`, `ai-coding`, `ai-image`, `ai-productivity`, `ai-guides` — satisfies the 4–8 landing requirement with 1 post each at start.
- **D-02:** Silo landings live at root `/{silo}` (e.g. `/ai-writing` → `app/[silo]/page.tsx` per ARCHITECTURE.md structure). Flat `/blog/{slug}` posts are untouched — **Reversibility:** one-way — URL namespace is a published crawl contract; changing it later needs redirects for every landing.
- **D-03:** Landing depth is curated intro + list: unique intro prose + cluster list + link context. Not auto-list-only (thin-page risk on 1-post silos), not full pillar-FAQ stub (Phase 6 pillar depth).
- **D-04:** Homepage keeps latest-posts index and adds a silo hubs section on top linking to the 5 landings. No silo-first redesign in Phase 2.
- **D-05:** URL slugs stay machine-style (`ai-writing`); display labels are agent's discretion, defined once in code and reused in UI/breadcrumbs/landing headers.
- **D-06:** Post breadcrumb switches from Home / Blog / Title to Home / {Silo} / Title where {Silo} links to the landing. BreadcrumbList JSON-LD must mirror this visible crumb (single-source rule).
- **D-07:** Ship all 5 landings immediately at 1 post each. No gating by post count — landings fill as the pipeline publishes.
- **D-08:** Silo intro copy lives as hand-written static definitions in the repo (title, intro, description per silo). Not registry-driven in Phase 2 — versioned, no pipeline dependency.

### Hub-and-spoke link rules
- **D-09:** Mandatory pillar up-link is satisfied by silo crumb + Related-block landing link. No in-body link injection in Phase 2.
- **D-10:** Strict same-silo Related policy: RelatedPosts shows same-silo only; cross-silo links only via homepage hubs. No flexible cross-silo exception in v1.
- **D-11:** RelatedPosts gets a minor upgrade (not a rewrite): add silo-landing header link + empty-state link to the silo landing when no siblings exist. Current deterministic newest-first same-silo up-to-3 logic stays; Phase 3 engine upgrades without changing this contract.
- **D-12:** Zero-orphan rule counts landing-list membership: landing list + homepage hubs + crumb satisfy reachability. No strict post-to-post in-link requirement for 1-post silos.
- **D-13:** Anchor text is title + silo name (post titles for siblings, silo display name for pillar). No keyword-rich head-term stuffing.
- **D-14:** Minimal link budget in Phase 2: up to 3 Related + crumb + landing list. No in-body contextual suggestions yet.
- **D-15:** Two-hop hub-and-spoke: homepage hubs link to silo landings only (not directly to posts); landings link to posts. Homepage retains its existing latest-posts list below the hubs.
- **D-16:** Ordering is newest-first everywhere (landing lists, Related, homepage). No per-silo curated ordering in Phase 2.

### the agent's Discretion
- Silo display labels (D-05): propose human labels (e.g. "AI Writing") once, reuse everywhere.
- Silo intro prose drafts (D-03/D-08): write concise unique intros per silo; keep thin-content-safe at 1 post each.
- Crawl surface + sitemaps (SEO-01/SEO-04 — not discussed, stays in phase): split-sitemap shape, diff-gated lastmod, robots.ts strictness, tag/archive/pagination existence vs noindex, and CI crawl-consistency suite design are planner/researcher discretion within success criteria #1 and #4.
- Canonical + hreflang + schema builders (SEO-02/SEO-03/GEO-01/GEO-03 — not discussed, stays in phase): en-US canonical + x-default self-ref shape, hreflang plumbing CI, and `lib/seo/` single-source Article/BreadcrumbList builders (+ FAQPage hygiene, conditional on visible FAQs) are planner discretion per STACK.md (next-seo v7 JSON-LD-only + schema-dts) and single-source rule.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — vision, Tier-1-only + autonomous + quality-floor + CWV constraints; niche Tech/AI Tools.
- `.planning/REQUIREMENTS.md` — SEO-01..05 + GEO-01/GEO-03 acceptance criteria (this phase); out-of-scope list (no 4-locale launch, no faceted nav, no comments, no fabricated authors).
- `.planning/ROADMAP.md` — Phase 2 goal, dependencies (Phase 1), 5 success criteria, ordering invariant (no auto-publish before proven QA).

### Research (architecture authority)
- `.planning/research/ARCHITECTURE.md` — Patterns 2/3/4 (hub-and-spoke soft silos, flat URLs + hierarchical nav, schema injection points), `app/[silo]/page.tsx` structure, single-source rule, anti-patterns 2/3 (no category-in-URL, schema mirrors visible content).
- `.planning/research/SUMMARY.md` — corrected decisions (single-locale en-US + x-default first, FAQPage hygiene not lever, Google track = sitemaps + GSC API), silo + link-graph + crawlability floor.
- `.planning/research/STACK.md` — locked stack (Next.js 16.x, Content Collections + zod, next-seo v7 JSON-LD-only, schema-dts); native `sitemap.ts`/`robots.ts` + `generateSitemaps` sharding; what NOT to use (ping endpoint, Indexing API for posts, next-sitemap for App Router).
- `.planning/research/FEATURES.md` — post-template spec, silo/related/breadcrumb expectations, deferred items.
- `.planning/research/PITFALLS.md` — index-bloat + sitemap/canonical self-sabotage + locale-duplication cluster; scaled-abuse shape avoidance.

### Prior phase (locked constraints)
- `.planning/phases/01-site-foundation-trust/01-CONTEXT.md` — D-01..D-21: flat `/blog/{slug}` from day one, single-source SEO strings via `lib/site.ts`, single-locale en-US, RelatedPosts same-silo contract, static-plus-touches, system fonts, real publisher identity.

### Code (must read before planning)
- `app/blog/[slug]/page.tsx` — current Breadcrumb (to change to silo crumb), `generateMetadata` (canonical only today — needs x-default/hreflang), missing Article/BreadcrumbList JSON-LD, `RelatedPosts` usage, `FaqSection` (FAQPage hygiene source).
- `app/page.tsx` — latest-posts index to extend with hubs section.
- `app/sitemap.ts` — Phase-1-minimal (extend to split + diff-gated lastmod in Phase 2).
- `app/robots.ts` — minimal (extend per crawl-efficiency policy).
- `app/layout.tsx` — Organization/WebSite JSON-LD + Plausible (sitewide baseline; per-post builders inject in post page).
- `content-collections.ts` — `silo: z.string()` frontmatter + `headings`/`readingMinutes` transform (silo taxonomy source of truth).
- `lib/site.ts` — single-source site constants (all SEO strings import from here).
- `components/related-posts.tsx` — deterministic same-silo up-to-3 logic to minimally upgrade.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/related-posts.tsx`: deterministic same-silo filter + newest-first + slice 3, hidden when empty — upgrade with silo header link + empty-state silo link, keep contract for Phase 3 engine.
- `app/blog/[slug]/page.tsx` `Breadcrumb`: visible nav to evolve to Home / {Silo} / Title; `FaqSection` maps 1:1 to FAQPage hygiene JSON-LD source.
- `app/sitemap.ts` + `app/robots.ts`: minimal files exist so Phase 2 extends rather than retrofits (split sitemaps, diff-gated lastmod, noindex surface).
- `content/posts/*.mdx` `silo` frontmatter: 5 values already (`ai-writing`, `ai-coding`, `ai-image`, `ai-productivity`, `ai-guides`) — landing inventory derives from this enum.
- `lib/site.ts`: single-source rule enforcement point — silo display-name map belongs here or alongside it.

### Established Patterns
- Flat `/blog/{slug}` URLs + `generateStaticParams` + self-referencing canonical in `generateMetadata`; hierarchy via UI/links, never URL depth.
- App Router Server Components, static-first rendering, Tailwind v4 + typography, Content Collections + zod build-fail gate (malformed post never publishes silently).
- Newest-first sorting (`publishedAt` desc) in sitemap + homepage + Related; system font stack; near-zero client JS (ReadingProgress island only).
- Single-source SEO strings: no SEO text in two places — visible FAQ/breadcrumbs and JSON-LD render from the same frontmatter map.

### Integration Points
- New route `app/[silo]/page.tsx` (+ `generateStaticParams` from silo enum) connects to: Content Collections query by silo, shared silo definition file, homepage hubs section links, post crumb links, sitemap extension, BreadcrumbList builder.
- `app/page.tsx` hubs section links to 5 landings; landings link to posts (two-hop); crumbs link post → landing → home (up-link triangle).
- `lib/seo/` (new in Phase 2): typed JSON-LD builders (Article/BreadcrumbList/conditional FAQPage) + sitemap/canonical derivation + CI crawl-consistency suite (no non-200/noindexed/non-canonical URLs, no chains, diff-gated lastmod).
</code_context>

<specifics>
## Specific Ideas

- Silo slugs (locked): `ai-writing`, `ai-coding`, `ai-image`, `ai-productivity`, `ai-guides`.
- Landing URL shape (locked): `/ai-writing` (root `[silo]`), not `/topics/{silo}` or `/blog/{silo}`.
- Breadcrumb target (locked): Home (`/`) / {Silo Display} (`/{silo}`) / Title (current page).
- Homepage pattern (locked): hubs-on-top (5 silo cards → landings) + existing latest-posts list below.
- Owner keywords during discussion: none beyond the selections above — open to standard approaches everywhere marked agent discretion.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Crawl surface/sitemaps and canonical/hreflang/schema were explicitly left as planner discretion inside Phase 2 (not deferred to future phases).
</deferred>

---

*Phase: 2-SEO Architecture + Silo IA*
*Context gathered: 2026-10-17*
