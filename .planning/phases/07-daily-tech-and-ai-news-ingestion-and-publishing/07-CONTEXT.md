# Phase 7: Daily Tech & AI News Ingestion & Publishing — Context & Scope

## Purpose & Business Goal
Transform the blog into an automated, daily-publishing Tech & AI news powerhouse. Instead of relying on a finite, static keyword list, the platform must automatically ingest breaking and trending Tech/AI news every single day, synthesize them into high-authority journalistic articles (with source attribution, TL;DR, impact analysis, and FAQs), pass all fail-closed EEAT quality checks, and automatically publish to Cloudflare Pages and search engines (IndexNow + Google Search Console).

## User Directives & Invariants
1. **Daily Auto-Publishing (7 days a week, endless freshness)**:
   - Must publish fresh daily news articles every day.
   - Zero human gating.
   - Triggered automatically via GitHub Actions schedule (`0 6 * * *`) and local/VPS CLI (`npm run news:publish`).
2. **Zero Paid APIs Policy (Enforced)**:
   - News ingestion uses 100% free, public feeds and APIs (Hacker News API, Google News Tech RSS, TechCrunch RSS, The Verge RSS, Ars Technica RSS).
   - LLM generation uses the existing free-tier OpenAI-compatible adapter (`lib/pipeline/llm.ts`) or local models.
   - No paid third-party news or indexing APIs.
3. **Journalistic Structure & EEAT Compliance**:
   - Every news post must include:
     - Clear H1 headline (50–60 chars).
     - Meta description (150–160 chars).
     - TL;DR / Quick Summary in the first 100 words.
     - "What Happened" factual breakdown.
     - "Why It Matters" analysis for Tier-1 readers (developers, creators, tech workers).
     - "Industry Impact & Community Reaction".
     - 3–4 FAQs addressing what readers are searching for regarding this news.
     - Verified Source Citation block linking back to original sources (e.g., official launch blog, GitHub, Reuters, TechCrunch).
4. **Site Architecture Integration**:
   - New dedicated silo: `ai-news` ("AI & Tech News") added to `lib/silos.ts`.
   - Landing page at `/ai-news` with clean reverse-chronological archive and `CollectionPage` JSON-LD schema.
   - News posts live at `/blog/{slug}` with full Article / NewsArticle schema, OG image, and breadcrumbs.
   - Included in split sitemaps (`sitemap.ts`) and indexed automatically via IndexNow + Google Search Console API.

## Requirements
- **NEWS-01**: Multi-source daily news ingestion engine (Hacker News, Google News, TechCrunch, The Verge) with 24h freshness filter and de-duplication.
- **NEWS-02**: Journalistic news article generator and strict frontmatter validation conforming to Content Collections schema.
- **NEWS-03**: Frontend `/ai-news` category silo hub, navigation link, and NewsArticle / CollectionPage JSON-LD schema.
- **NEWS-04**: Scheduled daily publishing runner (`scripts/publish-daily-news.ts`), GitHub Actions workflow, and dual-track indexing.
