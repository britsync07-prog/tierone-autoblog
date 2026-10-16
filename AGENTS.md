<!-- GSD:project-start source:PROJECT.md -->
## Project

**TierOne AutoBlog**

TierOne AutoBlog is a fully automated blogging platform built to capture high-volume organic search traffic exclusively from Tier-1 countries (US, UK, CA, AU). A Next.js site publishes one or more long-form, SEO-structured articles daily, produced end-to-end by an autonomous AI agent (keyword research → outline → draft → optimize → publish) with zero human gating in v1. Content targets broad-appeal, high-demand topics in the Tech/AI & Digital Tools niche first, expanding to adjacent finance/software topics once topical authority is established.

**Core Value:** Tier-1 readers find our articles on Google page 1 and stay to read — organic sessions from US/UK/CA/AU grow every week.

### Constraints

- **Tech stack**: Next.js 14+ (App Router), MDX, TypeScript, Tailwind — why: speed + automation control
- **Language**: English only, en-US primary with en-GB/CA/AU variants — why: Tier-1 only
- **Automation**: Zero human gate in publishing loop (v1) — why: owner chose fully autonomous
- **Quality floor**: Every post must pass EEAT/originality/thin-content checks or it does not publish — why: Google spam-policy survival
- **Performance**: 90+ Lighthouse on mobile, fully static/edge-cached — why: rankings + ad viewability later
- **Compliance**: No scraped content, no cloaking, no doorway pages; affiliate links disclosed when added — why: manual-action avoidance
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | ^16 (16.4.x current as of Oct 2026; scaffold with `create-next-app@latest`) | Framework, routing, rendering, metadata, sitemaps | Current stable/LTS line (16.x since Oct 2025; 15.x approaching EOL). App Router is the only sensible default: native Metadata API, `sitemap.ts`/`robots.ts` conventions, `generateStaticParams`, Server Components that render JSON-LD into initial HTML for crawlers. Turbopack is the default bundler for dev and build. **Do not start on Next.js 14** — the PROJECT.md "14+" floor is satisfied by going latest. |
| React | 19.2 (bundled with Next 16) | UI runtime | Ships with Next 16; Server Components by default = zero-JS article pages, best CWV posture. No decision needed beyond accepting the bundled version. |
| TypeScript | ^5 (strict) | Type safety incl. frontmatter/content schemas | Strict TS + zod-validated frontmatter is the quality gate that keeps an autonomous pipeline from publishing malformed posts. Non-negotiable for automation. |
| Node.js | 22 LTS | Runtime (local + Vercel) | Vercel's current runtime baseline; matches what 2026 guides and tooling target. Pin `engines` in package.json. |
| Tailwind CSS | ^4 | Styling | v4 is the standard for new Next.js scaffolds (CSS-first config, smaller output). Article typography via `@tailwindcss/typography` plugin. Verify exact version `create-next-app` pins at scaffold time. |
| MDX content layer: Content Collections | `@content-collections/core` + `@content-collections/mdx` + `@content-collections/next` (latest at scaffold) | Typed MDX pipeline: file → validated, typed collections | Purpose-built Contentlayer successor: type-safe collections, zod schema validation, App Router/RSC compatible, MDX support. Proven migration path (Dub migrated Contentlayer → Content Collections). No docs-UI baggage — ideal for a blog. Replaces all hand-rolled `fs`/`gray-matter` plumbing and catches schema violations before publish. |
| zod | ^3 or ^4 (latest) | Frontmatter + pipeline payload validation | Standard-schema compatible; required by Content Collections for the post schema (title length, description length, slug format, FAQ count). The automated QA gate is only as strong as this schema. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-seo | ^7 (7.3.0 verified, Jul 2026) | JSON-LD structured-data components | Use **only** for structured data (`ArticleJsonLd`, `FAQPageJsonLd`, `BreadcrumbJsonLd`, custom via `JsonLdScript`+`processors`). Meta tags themselves come from the native Metadata API. v7 is App Router-compatible — the old "next-seo doesn't work with App Router" advice refers to pre-v7. |
| schema-dts | latest | TypeScript types for Schema.org vocabulary | Pair with hand-rolled or next-seo JSON-LD so Article/FAQPage/BreadcrumbList objects are type-checked. Referenced in Next.js SEO guides as the recommended typing lib. Use for any custom schema next-seo doesn't cover. |
| remark-gfm / rehype-slug / rehype-autolink-headings | latest | MDX rendering: tables, heading IDs, anchor links | Always — the required post structure (comparison tables, H2/H3 body) depends on GFM tables and stable heading anchors for the table of contents. |
| rehype-pretty-code (shiki) | latest | Code-block syntax highlighting | Needed from day one: Tech/AI niche posts contain code/config snippets. Server-rendered highlighting = no client JS cost. |
| @vercel/og | latest | Programmatic OG/Twitter images | Every post needs a unique social image for CTR; `opengraph-image.tsx` routes + `@vercel/og` generate them at build/request time with zero design work. |
| @anthropic-ai/sdk | latest | AI draft generation (primary) | Primary content model for long-form drafts: strongest long-form coherence for 1,500–2,500-word articles. Use structured outputs/JSON mode for outline + frontmatter so the pipeline gets parseable artifacts, not prose blobs. |
| openai (SDK) | latest | Fallback/diversity model | Use as fallback (outage/cost) and for narrow subtasks (titles, meta descriptions, FAQ generation) where a cheaper/faster model suffices. Two providers = pipeline never blocked by one outage. |
| DataForSEO API (Labs + SERP + Keywords Data, v3) | API (no npm version; REST) | Keyword research data: ideas, volume, KD, SERP analysis | The keyword-stage data source: Keyword Ideas endpoint (~$0.012 + $0.00012/keyword) for long-tail discovery, SERP API ($0.60/1k SERPs of 10 results) for competitor analysis. Pay-as-you-go, $50 minimum top-up. Only pay-per-success-style efficiency: batch aggressively, cache everything, never re-query the same keyword. |
| googleapis (google-api-nodejs-client) | latest | Search Console + URL Inspection + Indexing API calls | Server-side client for the indexing/analytics pipeline (service-account auth). One dependency covers Search Analytics queries, sitemap submission, and URL inspection. |
| Plausible script | managed snippet (Cloud) or CE self-host | Privacy-light behavioral analytics + country segmentation | Country-segmented traffic/engagement dashboards. ~1–2.5 KB script vs 45 KB+ GA4+GTM — directly protects LCP/INP. No consent banner required (no cookies/personal data), which matters with UK (UK GDPR) in the Tier-1 set. |
| @tailwindcss/typography | latest (v4-compatible) | Article prose styling | Required for readable long-form: constrains measure, styles tables/lists/callouts sanely. Every post body renders through it. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Vercel Cron (`vercel.json` `crons`) | Daily publish scheduler | Hobby plan allows 100 jobs at once-per-day cadence — exactly the v1 requirement (≥1 post/day). UTC only; timing guaranteed within the hour on Hobby. Zero infra to run. Upgrade to Pro only when cadence exceeds 1/day or minute precision matters. |
| GitHub Actions | Backup scheduler + pipeline CI | Free fallback scheduler (cron trigger → repository dispatch / API call) if Vercel Cron misfires; also runs content QA checks (schema validation, link checks) on generated-post PRs/commits. Dual-scheduler = no single point of failure for the daily publish. |
| Bing Webmaster Tools + IndexNow key file | IndexNow verification + submission monitoring | Host `{key}.txt` at domain root once; verify in Bing Webmaster Tools; monitor submission status there. One submission to `api.indexnow.org` propagates to all participating engines. |
| Google Search Console (property + API) | Google indexing + rankings/CTR source of truth | Submit sitemaps via API on publish; Search Analytics API feeds the country-segmented dashboard and the refresh-cycle ("what to update next"). URL Inspection API (2,000 QPD) verifies indexing of each new post. |
| Lighthouse CI / Vercel Speed Insights | CWV guardrail | Fail builds on LCP/INP/CLS regression. Every template change (not every post) should pass 90+ mobile before merge. |
## Installation
# Scaffold (pins current Next 16 + React 19 + Tailwind)
# Core content + validation
# SEO: structured data + OG images + markdown rendering
# Pipeline: AI + keyword data + Google APIs
# Dev dependencies
# Analytics: Plausible = one script tag in root layout (no npm package required)
# <!-- in app/layout.tsx <head>: <script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"> -->
# Self-host option: Plausible Community Edition (free, Docker) if $9+/mo Cloud is unwanted
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 App Router (Vercel) | WordPress / Ghost | Only if a non-technical team must hand-edit posts daily — rejected for v1: plugin weight, slower TTFB, harder pipeline control (already decided in PROJECT.md). |
| Content Collections | fumadocs-mdx (^15, verified active 15.4.7) | If content needs grow beyond a blog (versioned docs, full-text search, docs UI) — fumadocs-mdx is the actively maintained full-featured layer with the same zod-collection model. Heavier than needed for v1 posts. |
| Content Collections | Velite / next-mdx-remote + hand-rolled loader | Only if Content Collections proves unmaintained at scaffold time — check its repo pulse before committing; velite's maintenance status could not be verified in this research. Hand-rolled `fs`+`gray-matter` is acceptable for v1 only if kept behind a zod schema. |
| Native `sitemap.ts` / `robots.ts` | next-sitemap (4.2.3, still maintained) | next-sitemap's postbuild file generation fights the App Router model (dynamic routes need `generateStaticParams` alignment; community reports friction). Native conventions support sitemap index sharding (`sitemap.xml/0.xml`… via `generateSitemaps`) with zero config drift. Use next-sitemap only if retaining a Pages Router section. |
| next-seo v7 JSON-LD + hand types | Fully hand-rolled JSON-LD `<script>` blocks | Hand-rolled is fine and is what the official Next.js guide demonstrates — but next-seo v7 gives tested Article/FAQ/Breadcrumb components with CSP `nonce` support, so prefer it and hand-roll only exotic schema types (with schema-dts). |
| Vercel Cron (primary) + GitHub Actions (backup) | External scheduler (e.g. Trigger.dev, Inngest, self-hosted cron) | When the pipeline needs retries, queues, and observability across multi-step agent runs (research→draft→QA→publish as durable workflow). v1 daily single-post flow doesn't justify it; revisit at multi-post/day scale. |
| Plausible (+ GSC API) | GA4 | Only if ad-platform integration later demands Google's audience/payment data. GA4's weight + UK/EU consent-banner requirement actively harms the CWV and bounce goals — defer unless monetization tooling forces it. |
| DataForSEO | Semrush/Ahrefs APIs | Only if the team already pays for those suites (their APIs are gated behind ~$500/mo tiers vs DataForSEO pay-as-you-go). DataForSEO wins for automation on cost and granularity. |
| Git-committed MDX + rebuild (v1) | DB/CMS-driven content + `revalidateTag` on-demand ISR | Rebuild-per-post is simplest and free at 1–2 posts/day (Vercel Hobby: 100 deploys/day cap — comfortable headroom). Move to DB + on-demand revalidation when publishing exceeds a few posts/day or builds get slow. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Contentlayer | Effectively unmaintained since sponsor acquisition; incompatible with App Router; its own ecosystem (Fumadocs) deprecated support | Content Collections (or fumadocs-mdx) |
| `next/head`, `getStaticProps`, Pages Router patterns | Legacy model; no Metadata API, worse RSC/caching story, splits SEO logic across files | App Router `metadata` / `generateMetadata` + Server Components |
| `next-sitemap` postbuild generation for App Router | Redundant with native `sitemap.ts`; known App Router friction; one more drift source in an autonomous pipeline | Native `sitemap.ts` (+ `generateSitemaps` sharding) and `robots.ts` |
| Google sitemap "ping" endpoint (`google.com/ping?sitemap=`) | Long-deprecated/retired — requests go nowhere; pipeline step that silently does nothing | Search Console Sitemaps API submission + URL Inspection API |
| Google Indexing API for ordinary blog articles | Officially scoped to JobPosting/Livestream pages; 200/day default quota; misuse risks quota burn with zero benefit for Article pages | For Google: fresh sitemap + internal linking + URL Inspection API checks. Indexing API only if job-posting content is ever added. |
| Expecting Google to consume IndexNow | Google does NOT support IndexNow (confirmed Feb 2026; Bing/Yandex/Naver/Seznam/Yep do, ~3.5B URLs/day). Treating IndexNow as "Google instant indexing" leaves the 90%+ traffic source unaddressed | IndexNow for Bing et al. AND a separate Google track (sitemap + GSC API) in the same publish step |
| Cloudflare proxy misconfiguration (orange-cloud + Vercel without cache rules) | Double-caching / stale `/_next/static` assets and TTFB inflation; Cloudflare "Crawler Hints" is not a substitute for real IndexNow submission | Cloudflare DNS with explicit cache rules (bypass HTML, cache hashed static assets long), or DNS-only during v1; submit IndexNow from the app, not via hints |
| GA4 as the primary analytics in v1 | ~45–80 KB with GTM, consent banner required under UK GDPR, measurable LCP/TBT penalty on mid-range Android — directly fights the CWV-green requirement | Plausible (behavior) + Search Console API (rankings/CTR truth) |
| Client-side rendering for article bodies | Crawlers and CWV both punish it: delayed LCP, uncrawlable-until-hydrated content, layout shift | Static Server Components; client JS limited to islands (TOC highlight, copy buttons, FAQ accordion if needed) |
## Stack Patterns by Variant
- Use git-committed MDX + Vercel rebuild per publish (Hobby Cron once/day + on-push deploy).
- Because rebuilds are cheap and infrequent, content is atomic (post + sitemap + internal links ship together), and there is no database to operate.
- Use DB-backed posts (Neon/Supabase Postgres) + `revalidateTag`/on-demand revalidation, with `sitemap.ts` reading from the DB.
- Because per-post rebuilds waste build minutes and delay freshness; on-demand ISR keeps Tier-1 TTFB static-fast while content stays fresh without deploys.
- Use per-locale metadata + `hreflang` (`en-us`/`en-gb`/`en-ca`/`en-au` alternates in Metadata API) on the same canonical post, not duplicated posts.
- Because duplicate locale posts split ranking signals and invite thin-duplicate penalties; alternates consolidate them.
- Use the dual-provider pattern (Anthropic primary, OpenAI fallback) with per-stage model routing (cheap model for titles/meta/FAQ, strong model for body draft).
- Because a single-provider pipeline halts all publishing on one outage, and routing narrow tasks to cheaper models cuts per-post cost several-fold.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.x | react@19.2, node@≥20 (22 LTS recommended), typescript@^5 | Turbopack default for `dev` and `build`; `cacheComponents` model replaces the old PPR experimental flag — follow the 16.x caching docs, not 14/15-era ISR blog posts. |
| @content-collections/next | next@≥13 App Router (works on 16) | Requires the `postinstall`/build wiring per its docs; verify latest major at scaffold — content-layer libs rev faster than frameworks. |
| next-seo@7.x | next@≥13 App Router, react@≥18 | v7 JSON-LD components are RSC-safe; `nonce` prop available for strict CSP. Do NOT follow v6/Pages-Router tutorials. |
| rehype-pretty-code | shiki (bundled dep) | Pin together; theme CSS must be served statically to avoid CLS on code blocks. |
| DataForSEO API v3 | Any HTTP client | No SDK lock-in; key rotation via dashboard. Note July 2026 +20% price update and pay-as-you-go-only billing — budget per-post keyword cost before automating bulk discovery. |
| googleapis | Node 20+ | Service-account JSON in Vercel env vars (never in repo); one service account needs Search Console owner delegation per property. |
## Sources
- Next.js official docs — ISR guide, JSON-LD guide, sitemap/robots conventions (nextjs.org/docs, last-updated Jun 2026 / Mar 2026) — HIGH
- Next.js blog — 16.2/16.3/16.4 releases, Sept/Oct 2026 security releases — HIGH (Next.js 16.4 current, 15.5.x maintenance)
- 2026 Next.js tutorial (tech-insider.org, Aug 2026) — Next 16.3.1 stable/LTS, Turbopack default, React 19.2, Node 22 LTS — MEDIUM (single source, corroborates official blog)
- Dub blog — migrating Contentlayer → Content Collections (sponsor-acquired, unmaintained, App Router-incompatible) — MEDIUM-HIGH
- Fumadocs docs — Content Collections support; Contentlayer support deprecated; fumadocs-mdx v15 collections — HIGH for Fumadocs direction
- npm — fumadocs-mdx 15.4.7, next-sitemap 4.2.3, next-seo v7 lineage — HIGH (registry facts)
- GitHub garmeeh/next-seo releases — 7.3.0 latest (Jul 2026), CSP nonce support — HIGH
- Vercel docs — Cron usage & pricing (Jul/Sep 2026): 100 jobs all plans, Hobby once/day, UTC-only — HIGH
- Vercel + FocusReactive + Pagepro + DigitalApplied 2026 SEO guides — Metadata API, INP-over-FID, viewport export, JSON-LD-in-RSC, schema-dts — MEDIUM-HIGH (multiple agree)
- IndexNow/Bing official getstarted + pressonify.ai (Feb 2026) + crawlwp 2026 comparison — Google does NOT support IndexNow; Bing/Yandex/Naver/Seznam/Yep do; 10k URLs/batch — HIGH
- Google Developers — Search Console API limits (Aug 2025): URL Inspection 2,000 QPD / 600 QPM — HIGH
- Stackmatix + DEV/polychart 2026 guides — Indexing API officially JobPosting/Livestream-only, 200/day default quota — MEDIUM-HIGH
- DataForSEO official pricing + July 2026 pricing update + Labs keyword-ideas cost example — MEDIUM-HIGH (official source, verify at purchase)
- Plausible/GA4 comparisons (2026, multiple) — script weight, GDPR/consent posture, self-host CE option — MEDIUM (vendor-adjacent sources agree)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using edit, write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
