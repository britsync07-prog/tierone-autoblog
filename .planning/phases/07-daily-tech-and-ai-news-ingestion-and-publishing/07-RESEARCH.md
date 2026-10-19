# Phase 7: Daily Tech & AI News Ingestion & Publishing - Technical Research & Architecture

**Created:** 2026-10-19  
**Status:** Complete & Validated  
**Target Architecture:** Next.js 16 App Router (React 19, Server Components), Zero-Paid News Aggregation, Schema.org `NewsArticle`, GitHub Actions Automated Publisher  
**Primary Output Target:** `D:/myapps/blogs/.planning/phases/07-daily-tech-and-ai-news-ingestion-and-publishing/07-RESEARCH.md`

---

## Executive Summary

Phase 7 establishes the **continuous daily publishing engine** for TierOne AutoBlog. While Phases 1–6 engineered a resilient foundation for static evergreen keyword clusters (comparisons, reviews, how-to guides), an authoritative technology publication requires an endless stream of real-time, high-demand content. Breaking news in Artificial Intelligence and developer technology captures high organic search velocity, accelerates domain crawl frequency, and compounds topical authority.

Operating strictly under the project's **fully-free platform mandate** (zero paid APIs, no third-party news subscription APIs, no paid indexing tools), Phase 7 transforms the blog into an automated, daily-publishing news desk:

1. **Multi-Feed Daily News Aggregation (100% Free Public Sources)**:
   - Aggregates top breaking stories from the **Hacker News Firebase REST API**, **Google News RSS**, **TechCrunch AI RSS**, and **The Verge Tech RSS**.
   - Implements a robust XML/RSS/Atom parser with zero heavy external dependencies.
   - Normalizes raw feeds into a unified `RawNewsItem` schema with a strict **24-hour freshness gate**.
   - Prevents duplicate coverage via multi-tiered de-duplication: URL normalization, canonical path matching, and 3-word shingle Jaccard similarity against `content/news/covered.json`.

2. **Journalistic News Synthesis & EEAT Strict Frontmatter**:
   - Synthesizes breaking news using the existing free-tier OpenAI-compatible adapter (`lib/pipeline/llm.ts`).
   - Generates structured, Pulitzer-grade tech journalism:
     - Active H1 headline (50–60 characters).
     - Meta description (150–160 characters).
     - Frontmatter TL;DR takeaway box in $\le 100$ words.
     - Detailed MDX body: "The Breakdown: What Happened", "Why It Matters for Tech & Developers", "Industry Impact & Market Context", and "Sources & Official Verification".
     - 3–4 search-intent FAQs adhering to schema constraints.
   - Strictly conforms to `draftSchema` in `lib/pipeline/draft-schema.ts` and Content Collections validation.

3. **Silo & Frontend Integration (`ai-news`)**:
   - Registers `'ai-news'` ("AI & Tech News") in `lib/silos.ts` as the 6th canonical silo.
   - Dynamic landing page at `/ai-news` via `app/[silo]/page.tsx` rendering reverse-chronological news archive with `CollectionPage` JSON-LD schema.
   - Upgrades `lib/seo/jsonld.ts` and `app/blog/[slug]/page.tsx` to emit Google-compliant Schema.org `NewsArticle` structured data for news posts.
   - Prominently surfaces "AI News" in `components/site-header.tsx`.

4. **Autonomous Daily Publishing Engine & GitHub Actions**:
   - Standalone CLI runner `scripts/publish-daily-news.ts` supporting `--dry-run`, `--force`, and `--feed=<source>`.
   - Complete autonomous lifecycle: Ingest $\rightarrow$ Freshness Gate $\rightarrow$ Shingle De-dup $\rightarrow$ Story Scoring $\rightarrow$ LLM Synthesis $\rightarrow$ Frontmatter Validation $\rightarrow$ MDX Write $\rightarrow$ Registry Update $\rightarrow$ Git Push $\rightarrow$ Dual-Track Indexing (IndexNow + Google Search Console API).
   - Fully automated daily GitHub Actions cron running at `0 6 * * *` (06:00 UTC daily).

---

## 1. Multi-Feed Daily News Aggregation (Zero Paid APIs)

### 1.1 Free Public Endpoints & Feeds

To guarantee zero operational cost, the news ingestion engine consumes publicly accessible, unmetered endpoints:

| Feed Source | Format | Endpoint URL | Polling Characteristics & Filters |
|-------------|--------|--------------|-----------------------------------|
| **Hacker News (Y Combinator)** | JSON (Firebase REST) | `https://hacker-news.firebaseio.com/v0/topstories.json`<br>`https://hacker-news.firebaseio.com/v0/item/{id}.json` | REST API. Fetch top 30-50 story IDs. Filter for `score >= 80`, item age $< 24$ hours, and title matching AI/developer keywords. |
| **Google News Tech/AI** | RSS 2.0 (XML) | `https://news.google.com/rss/search?q=Artificial+Intelligence+OR+Tech&hl=en-US&gl=US&ceid=US:en` | XML RSS 2.0. Broadest aggregator coverage, real-time breaking events, high diversity of Tier-1 publications. |
| **TechCrunch AI** | RSS 2.0 (XML) | `https://techcrunch.com/category/artificial-intelligence/feed/` | XML RSS 2.0. Dedicated startup, funding, foundation model releases, enterprise product launches. |
| **The Verge Tech** | Atom 1.0 (XML) | `https://www.theverge.com/rss/index.xml` | Atom feed. Cultural, architectural, consumer tech, and developer platform news. |
| **Ars Technica** (Fallback) | RSS 2.0 (XML) | `https://feeds.arstechnica.com/arstechnica/technology-lab` | Deep technical analysis, security, open-source, and hardware infrastructure. |

### 1.2 Hacker News Firebase REST Ingestion Mechanics

The Hacker News Firebase REST API requires no authentication and imposes no aggressive rate limits when queried politely:

1. **Top Stories Query**:
   `GET https://hacker-news.firebaseio.com/v0/topstories.json` returns an array of up to 500 item IDs (e.g., `[41882103, 41881954, ...]`).
2. **Batch Item Resolution**:
   Take the first 40 IDs and resolve items via `https://hacker-news.firebaseio.com/v0/item/{id}.json` in chunks of 10 using `Promise.allSettled`.
3. **Filtering Heuristic**:
   ```typescript
   const AI_TECH_REGEX = /\b(ai|llm|gpt|claude|gemini|anthropic|openai|deepseek|mistral|meta|nvidia|gpu|chips?|agent|coding|developer|software|model|prompt|open-source|compiler|vector|neural)\b/i;

   function isHnCandidate(item: HnItem): boolean {
     if (item.type !== 'story' || !item.url || !item.title) return false;
     if ((item.score ?? 0) < 80) return false;
     const ageHours = (Date.now() / 1000 - item.time) / 3600;
     if (ageHours > 24) return false;
     return AI_TECH_REGEX.test(item.title);
   }
   ```

### 1.3 XML/RSS and Atom Parser Architecture

News feeds arrive in two standard XML formats:
- **RSS 2.0** (`<rss><channel><item>...`): Google News, TechCrunch, Ars Technica.
- **Atom 1.0** (`<feed><entry>...`): The Verge.

To avoid heavy dependency trees and C++ binary addons, the parser implementation uses either `fast-xml-parser` (a lightweight, zero-dependency pure JS npm package) or a specialized regular-expression streaming parser. 

#### Recommended Parser: `fast-xml-parser`
`fast-xml-parser` has no native compilation requirements, parses both RSS and Atom cleanly into plain JavaScript objects, handles CDATA sections automatically, and is safe against XXE (XML External Entity) injection when external entities are disabled.

```typescript
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '__cdata',
  trimValues: true,
});
```

#### Zero-Dependency Fallback Parser (Pure Node.js Regex/String Extraction)
If no new package installation is desired, RSS 2.0 and Atom feeds can be parsed deterministically with a focused extractor:

```typescript
function cleanCdataAndEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '') // strip any residual HTML
    .trim();
}

export function parseRssItems(xml: string, sourceName: string): RawNewsItem[] {
  const items: RawNewsItem[] = [];
  // Match RSS 2.0 <item>
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const block = match[1];
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const descMatch = block.match(/<(?:description|content:encoded)>([\s\S]*?)<\/(?:description|content:encoded)>/i);

    const title = titleMatch ? cleanCdataAndEntities(titleMatch[1]) : '';
    const link = linkMatch ? cleanCdataAndEntities(linkMatch[1]) : '';
    const pubDate = pubDateMatch ? cleanCdataAndEntities(pubDateMatch[1]) : '';
    const summary = descMatch ? cleanCdataAndEntities(descMatch[1]) : '';

    if (title && link) {
      items.push({
        id: createHash('sha256').update(link).digest('hex').slice(0, 16),
        title,
        link,
        pubDate: new Date(pubDate).toISOString(),
        source: sourceName,
        summary: summary.slice(0, 500),
      });
    }
  }
  return items;
}
```

### 1.4 Normalized `RawNewsItem` Interface

All incoming stories are converted into an immutable, unified representation:

```typescript
export interface RawNewsItem {
  id: string;              // Deterministic SHA-256 hash of canonical URL
  title: string;           // Unescaped plain text title
  link: string;            // Direct destination URL (unwrapped from redirects where possible)
  pubDate: string;         // ISO 8601 UTC date string
  source: string;          // 'Hacker News' | 'Google News' | 'TechCrunch' | 'The Verge' | 'Ars Technica'
  summary: string;         // Clean text summary or lead excerpt (max 500 chars)
  score?: number;          // Hacker News points or upvotes (if applicable)
  author?: string;         // Original reporting journalist or publication
}
```

### 1.5 The 24-Hour Freshness Gate

Breaking news looses viral search interest rapidly. The ingestion pipeline rejects any item published older than 24 hours:

```typescript
export const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isWithinFreshnessWindow(pubDateIso: string, now: Date = new Date()): boolean {
  const itemTime = Date.parse(pubDateIso);
  if (Number.isNaN(itemTime)) return false;
  const ageMs = now.getTime() - itemTime;
  return ageMs >= 0 && ageMs <= FRESHNESS_WINDOW_MS;
}
```

### 1.6 De-Duplication & Shingling Engine (`content/news/covered.json`)

To prevent the autonomous publisher from writing two articles about the same breaking launch (e.g. "Anthropic Launches Claude 3.7" reported by both TechCrunch and The Verge), the engine maintains a persistent ledger at `content/news/covered.json`.

#### Ledger Structure:
```json
{
  "version": 1,
  "updatedAt": "2026-10-19T06:00:00.000Z",
  "events": [
    {
      "id": "e4f8b91012a3",
      "title": "Anthropic releases Claude 3.7 Sonnet with hybrid reasoning architecture",
      "normalizedTitle": "anthropic releases claude sonnet hybrid reasoning architecture",
      "sourceUrl": "https://techcrunch.com/2026/10/18/anthropic-claude-3-7",
      "canonicalDomain": "techcrunch.com",
      "publishedDate": "2026-10-18T18:30:00.000Z",
      "coveredAt": "2026-10-19T06:01:23.000Z",
      "postSlug": "anthropic-claude-3-7-sonnet-hybrid-reasoning-release",
      "keywords": ["anthropic", "claude", "reasoning", "sonnet"]
    }
  ]
}
```

#### Multi-Tier Deduplication Algorithm:
1. **Canonical URL Match**: Strip UTM parameters (`utm_source`, `utm_medium`, `fbclid`, etc.), protocol, and trailing slash. If normalized URL exists in `covered.json`, reject immediately.
2. **Canonical Domain & Path**: Matches existing covered source URLs.
3. **3-Word Shingle Jaccard Similarity**:
   - Tokenize the candidate title: lowercase, strip punctuation, remove stop words (`a`, `the`, `is`, `in`, `and`, `to`, `for`, `of`, etc.).
   - Extract contiguous 3-word shingles:
     `"anthropic releases claude sonnet hybrid reasoning"` $\rightarrow$
     `{"anthropic releases claude", "releases claude sonnet", "claude sonnet hybrid", "sonnet hybrid reasoning"}`.
   - Compute Jaccard coefficient against all events covered within the past 14 days:
     $$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
   - **Threshold**: If $J(A, B) \ge 0.40$, or if overlapping key entity tokens (e.g. `[anthropic, claude, 3.7]`) match $\ge 3$ terms, the story is flagged as already covered.

### 1.7 Story Scoring & Priority Selection

When multiple fresh, uncovered stories are available, the pipeline ranks them to choose the #1 highest-value story for daily publication:

$$\text{StoryScore} = (S_{\text{HN}} \times 1.5) + (N_{\text{mentions}} \times 40) + \text{EntityBonus} + \text{RecencyBonus}$$

- $S_{\text{HN}}$: Hacker News points (e.g. 250 points = 375).
- $N_{\text{mentions}}$: Number of independent feeds covering the same story topic (+40 per cross-mention).
- $\text{EntityBonus}$: +50 bonus if the headline features high-demand Tier-1 entities (OpenAI, Anthropic, Google Gemini, Claude, Cursor, GitHub Copilot, Nvidia, DeepSeek, Meta AI).
- $\text{RecencyBonus}$: $\max(0, 24 - \text{ageHours}) \times 3$ (prioritizing breaking stories published 1–4 hours ago).

---

## 2. News Article Structure & LLM Synthesis

### 2.1 Journalistic Standards & Google EEAT Requirements

Unlike generic aggregator summaries or thin AI rewrites, Google's Helpful Content and News guidelines mandate high information gain, original synthesis, and authoritative framing:

1. **Active Journalistic Headline (H1)**: 50–60 characters. Must announce the news with an active verb (e.g., *"OpenAI Launches Realtime Voice API for Enterprise Apps"*).
2. **Meta Description**: 150–160 characters. Provides a concise, factual summary answering the core query.
3. **TL;DR Executive Takeaway**: Frontmatter `tldr` field ($\le 100$ words). Appears at the very top of the page in the `<Tldr>` component for instant user value.
4. **The Breakdown: What Happened (H2)**: 300–500 words. Factual, detailed account of the announcement, product specifications, benchmark claims, or corporate moves.
5. **Why It Matters for Tech & Developers (H2)**: 300–500 words. Critical analysis of workflow impacts, architectural trade-offs, developer tooling implications, API pricing shifts, and adoption considerations.
6. **Industry Impact & Market Context (H2)**: 200–400 words. How this affects competitors (e.g. OpenAI vs Anthropic vs Google), open-source vs proprietary dynamics, and ecosystem ripple effects.
7. **Frequently Asked Questions (H2 & Frontmatter `faq`)**: 3–4 practical FAQs answering exact high-intent queries readers type into Google search.
8. **Sources & Official Verification (H2)**: Direct outbound citation linking to the primary press release, GitHub repository, research paper, or official blog post.

### 2.2 LLM Synthesis Pipeline via `lib/pipeline/llm.ts`

The news synthesizer leverages `completeJson` from `lib/pipeline/llm.ts`. Because `completeJson` is wired to OpenAI-compatible free endpoints (Groq, OpenRouter `:free`, Ollama), it produces structured output with zero API expense.

#### Synthesis Prompt & Zod Contract:
```typescript
import { z } from 'zod';
import { SILO_SLUGS } from '../silos';

export const newsSynthesisSchema = z.object({
  title: z.string().min(50).max(60),
  description: z.string().min(150).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tldr: z.string().min(1).refine((v) => v.split(/\s+/).filter(Boolean).length <= 100, {
    message: 'tldr must be 100 words or fewer',
  }),
  faq: z.array(z.object({
    q: z.string().min(1),
    a: z.string().min(1),
  })).min(3).max(4),
  bodyMdx: z.string().min(1200),
});

export type NewsSynthesisResult = z.infer<typeof newsSynthesisSchema>;
```

#### System Prompt Directives:
```text
You are a senior tech editor and investigative AI journalist writing for an authoritative publication (exclusivesources.online).
You are covering a breaking tech/AI event based on verified feed inputs.

STRICT EDITORIAL RULES:
1. Title must be exactly 50-60 characters, in active voice, naming the specific model, company, or tool.
2. Description must be exactly 150-160 characters, providing a complete informative summary.
3. Slug must be lowercase kebab-case (e.g. 'anthropic-claude-3-7-sonnet-hybrid-reasoning').
4. TL;DR must be under 100 words, highlighting the 3 most crucial takeaways.
5. Body must be valid MDX containing exactly these H2 sections:
   - ## The Breakdown: What Happened (detailed factual analysis, 350-450 words)
   - ## Why It Matters for Developers & Engineers (practical workflow & technical impact, 350-450 words)
   - ## Industry Impact & Ecosystem Context (market dynamics & competitive landscape, 250-350 words)
   - ## Verified Sources & Primary Documentation (markdown bullet list with verified link to original source)
6. Write with objective, analytical rigor. NO AI fluff, NO filler, NO buzzwords ('game-changer', 'revolutionize', 'dive into').
```

### 2.3 Conformance to `draftSchema`

The generated frontmatter and body are assembled into a complete MDX document that strictly satisfies `draftSchema` in `lib/pipeline/draft-schema.ts`:

```typescript
import { draftSchema, type DraftFrontmatter } from '../lib/pipeline/draft-schema';

export function assembleNewsMdx(synthesized: NewsSynthesisResult, sourceUrl: string): string {
  const now = new Date().toISOString();
  
  const frontmatter: DraftFrontmatter = {
    title: synthesized.title,
    description: synthesized.description,
    slug: synthesized.slug,
    publishedAt: now,
    updatedAt: now,
    faq: synthesized.faq,
    silo: 'ai-news',
    tldr: synthesized.tldr,
  };

  // Strict fail-closed frontmatter validation
  draftSchema.parse(frontmatter);

  return `---
title: "${frontmatter.title.replace(/"/g, '\\"')}"
description: "${frontmatter.description.replace(/"/g, '\\"')}"
slug: "${frontmatter.slug}"
publishedAt: "${frontmatter.publishedAt}"
updatedAt: "${frontmatter.updatedAt}"
silo: "${frontmatter.silo}"
tldr: "${frontmatter.tldr.replace(/"/g, '\\"')}"
faq:
${frontmatter.faq.map(f => `  - q: "${f.q.replace(/"/g, '\\"')}"\n    a: "${f.a.replace(/"/g, '\\"')}"`).join('\n')}
---

${synthesized.bodyMdx}
`;
}
```

---

## 3. Silo & Frontend Integration

### 3.1 Adding `'ai-news'` to `lib/silos.ts`

`lib/silos.ts` serves as the single source of truth for all taxonomy slugs, human labels, and landing metadata across the site. Phase 7 expands `SILO_SLUGS` from 5 to 6:

```typescript
export const SILO_SLUGS = [
  'ai-writing',
  'ai-coding',
  'ai-image',
  'ai-productivity',
  'ai-guides',
  'ai-news',
] as const;

export type SiloSlug = (typeof SILO_SLUGS)[number];
```

#### Silo Definition:
```typescript
'ai-news': {
  slug: 'ai-news',
  label: 'AI & Tech News',
  landingTitle: 'Breaking AI & Tech News: Daily Analysis & Industry Updates',
  metaDescription:
    'Get daily breaking AI and tech news analyzed for developers, engineers, and creators. Real architectural insights, zero fluff, updated every morning.',
  intro:
    'The artificial intelligence and software landscape moves too quickly for shallow recaps and marketing press releases. Our daily news desk tracks the breakthroughs, foundation model releases, developer tooling updates, and regulatory shifts that genuinely affect technical workflows. Every morning, our automated intelligence engine ingests reports across engineering communities, filters out hype, and delivers deep architectural analysis: what actually launched, how it works under the hood, benchmark verifications, and what it means for engineers building in production. Rather than summarizing rumors, every report links to primary sources, documentation, and code repositories. Start with today’s breaking coverage below, or explore our categorized guides to see how emerging models compare to existing industry standards.',
}
```

### 3.2 Landing Route Handling (`app/[silo]/page.tsx`)

`app/[silo]/page.tsx` automatically maps all silos via `generateStaticParams()`:
```typescript
export function generateStaticParams() {
  return SILO_SLUGS.map((silo) => ({ silo }));
}
```
When `silo === 'ai-news'`:
- Displays the reverse-chronological archive view showing all published news posts sorted by `publishedAt` descending.
- Emits breadcrumbs: `Home / AI & Tech News`.
- If news articles accumulate to $\ge 8$ posts, the page dynamically elevates to a rich Pillar Hub with sub-clusters and `CollectionPage` JSON-LD schema linking all news spokes via `hasPart`.

### 3.3 Google News Structured Data (`NewsArticle` Schema)

Google Search provides specialized rich features for timely news content in Google News, Top Stories carousels, and Discover feeds when pages implement Schema.org `NewsArticle`.

In `lib/seo/jsonld.ts` and `app/blog/[slug]/page.tsx`:
```typescript
// app/blog/[slug]/page.tsx
const isNews = post.silo === 'ai-news';
const schemaType = isNews ? 'NewsArticle' : 'BlogPosting';

<ArticleJsonLd type={schemaType} {...buildArticleJsonLd(post, canonical)} />
```

`next-seo`'s `ArticleJsonLd` natively supports `type="NewsArticle"`, injecting:
```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "Anthropic Launches Claude 3.7 Sonnet with Reasoning",
  "description": "Anthropic has released Claude 3.7 Sonnet, introducing hybrid reasoning...",
  "datePublished": "2026-10-19T06:00:00.000Z",
  "dateModified": "2026-10-19T06:00:00.000Z",
  "author": {
    "@type": "Person",
    "name": "Editorial Staff",
    "url": "https://exclusivesources.online/authors/editorial-staff"
  },
  "publisher": {
    "@type": "Organization",
    "name": "TierOne AutoBlog",
    "url": "https://exclusivesources.online"
  },
  "image": "https://exclusivesources.online/blog/.../opengraph-image",
  "mainEntityOfPage": "https://exclusivesources.online/blog/..."
}
```

### 3.4 Header Navigation Enhancement

To make breaking news immediately discoverable by both human visitors and crawlers, update `components/site-header.tsx`:

```typescript
const NAV = [
  { label: 'AI News', href: '/ai-news' },
  { label: 'About', href: '/about' },
  { label: 'Editorial process', href: '/editorial-process' },
  { label: 'Contact', href: '/contact' },
];
```

### 3.5 Crawl-Consistency Guard Updates (`scripts/check-crawl.mjs`)

`scripts/check-crawl.mjs` enforces build-time crawl consistency. When `'ai-news'` is added to `SILO_SLUGS`:
1. `SILO_SLUGS.length` changes from 5 to 6.
2. In `scripts/check-crawl.mjs`, update the assertion:
   ```javascript
   check(
     'silo-parity',
     SILO_SLUGS.length === 6,
     `SILO_SLUGS has ${SILO_SLUGS.length} entries (D-07 ships all 6)`,
   );
   ```
3. `distinctSilos` matches `SILO_SLUGS`: ensure an initial seed news article (or test fixture) exists in `content/posts/` so `distinctSilos` contains `ai-news` and the assertion `posts.filter(p => p.silo === silo).length >= 1` passes.
4. Add the initial shard `content/keywords/ai-news.json` with valid metadata.

---

## 4. Autonomous Daily Publishing Engine & GitHub Actions

### 4.1 Daily Publishing Runner (`scripts/publish-daily-news.ts`)

The dedicated script `scripts/publish-daily-news.ts` provides the single execution entry point for scheduled automation and local testing.

#### Supported CLI Flags:
- `--dry-run`: Ingests, dedupes, selects the top story, and generates the draft, but writes nothing to disk and dispatches no network pings.
- `--force`: Bypasses the daily single-post guard (allows publishing more than 1 news post in a day for breaking news cycles).
- `--feed=<name>`: Constrains ingestion to a specific source (`hn`, `google`, `techcrunch`, `verge`).

#### Publishing Execution Workflow:

```mermaid
flowchart TD
    A[Start Daily News Runner] --> B{Daily Guard: Already published today?}
    B -- Yes & not --force --> C[Exit Cleanly: Code 0]
    B -- No or --force --> D[Fetch Feeds in Parallel: HN, Google, TechCrunch, The Verge]
    D --> E[Filter: 24h Freshness & AI/Tech Relevance]
    E --> F[De-duplicate: Match URL & 3-Word Shingles vs covered.json]
    F --> G{Candidates Available?}
    G -- No --> H[Log: No fresh news candidates. Exit 0]
    G -- Yes --> I[Score & Rank Candidates]
    I --> J[Select #1 Top Story]
    J --> K[LLM Synthesis via lib/pipeline/llm.ts]
    K --> L[Validate Frontmatter via draftSchema]
    L --> M[Write MDX to content/posts/slug.mdx]
    M --> N[Update content/news/covered.json]
    N --> O[Append Entry to content/keywords/ai-news.json]
    O --> P[Git Commit & Push to master]
    P --> Q[Trigger Cloudflare Pages Deployment]
    Q --> R[Dispatch Dual-Track Indexing: IndexNow + GSC Sitemap]
    R --> S[Finish: Published Successfully]
```

### 4.2 Cloudflare Pages & Dual-Track Indexing Integration

When a new news article is committed and pushed to `master`:
1. **Cloudflare Pages** automatically builds and deploys the site within 60–90 seconds via Git integration.
2. **Dual-Track Indexing** (`lib/pipeline/indexing/index.ts`) immediately submits the new URL and updated sitemap:
   - **IndexNow**: Instant notification to Bing, Yandex, Seznam, and Naver.
   - **Google Search Console**: Notifies Google of sitemap freshness via `submitGscSitemap`.
   - Result is logged in `content/keywords/indexing-log.json`.

### 4.3 GitHub Actions Workflow (`.github/workflows/daily-news.yml`)

The automated publisher runs daily at **06:00 UTC** (midnight CST / 02:00 EST), ensuring fresh daily news is indexed before US and UK morning traffic peaks.

```yaml
name: daily-news-publish

on:
  schedule:
    # Daily at 06:00 UTC (7 days a week)
    - cron: '0 6 * * *'
  workflow_dispatch:
    inputs:
      force:
        description: 'Force publish even if already published today'
        required: false
        type: boolean
        default: false
      dry_run:
        description: 'Run in dry-run mode (no file changes or indexing)'
        required: false
        type: boolean
        default: false

permissions:
  contents: write

jobs:
  daily-news:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Configure Git author
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Run Daily News Publisher
        env:
          LLM_BASE_URL: ${{ secrets.LLM_BASE_URL }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          LLM_MODEL: ${{ secrets.LLM_MODEL }}
          LLM_MODEL_CHEAP: ${{ secrets.LLM_MODEL_CHEAP }}
          INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}
          GSC_CLIENT_EMAIL: ${{ secrets.GSC_CLIENT_EMAIL }}
          GSC_PRIVATE_KEY: ${{ secrets.GSC_PRIVATE_KEY }}
          NEXT_PUBLIC_SITE_URL: ${{ vars.NEXT_PUBLIC_SITE_URL || 'https://exclusivesources.online' }}
        run: |
          FLAGS=""
          if [ "${{ github.event.inputs.force }}" = "true" ]; then FLAGS="$FLAGS --force"; fi
          if [ "${{ github.event.inputs.dry_run }}" = "true" ]; then FLAGS="$FLAGS --dry-run"; fi
          npx tsx scripts/publish-daily-news.ts $FLAGS

      - name: Commit and push published news
        run: |
          if [ -n "$(git status --porcelain content/)" ]; then
            git add content/
            git commit -m "news: daily tech & ai news release [skip ci]"
            git push origin master
          else
            echo "No news published or changes to commit."
          fi
```

---

## 5. Validation Architecture

To adhere to the project's Nyquist test-driven validation standard, Phase 7 includes automated test fixtures, unit tests for feed extraction and de-duplication, schema assertions, and end-to-end dry-run verification.

### 5.1 Test Suites & Test Matrix

| Test Suite | File Location | Purpose & Invariants |
|------------|---------------|----------------------|
| **Feed Ingestion & Parsing** | `tests/news-ingestion.test.ts` | Validates parsing of Hacker News JSON, Google News RSS, TechCrunch RSS, and The Verge Atom feeds using static fixtures in `tests/fixtures/news/`. Asserts all items conform to `RawNewsItem`. |
| **Freshness & Deduplication** | `tests/news-dedup.test.ts` | Validates 24h freshness filter, URL stripping, and 3-word shingle Jaccard similarity. Verifies that stories exceeding 0.40 similarity with entries in `covered.json` are rejected. |
| **News Synthesis & Schema** | `tests/news-synthesis.test.ts` | Tests the synthesis engine using a deterministic LLM mock fixture. Asserts generated title (50–60 chars), description (150–160 chars), TL;DR ($\le 100$ words), FAQ (3–4 entries), and MDX sections pass `draftSchema.parse()`. |
| **Publishing Runner & Idempotency** | `tests/news-publish.test.ts` | Tests `publish-daily-news.ts` in `--dry-run` and mock mode. Verifies daily lock prevents duplicate runs, shard updates are atomic, and DLQ captures unexpected failures. |
| **Crawl & Taxonomy Consistency** | `scripts/check-crawl.mjs` | Verifies `/ai-news` is indexed in sitemap shard 1, news articles land in shard 0, robots.txt allows access, and all 6 silos have active content. |

### 5.2 Deterministic Mock Fixtures

To ensure the test suite runs fully offline in CI without flaky external network calls, mock fixtures are created in `tests/fixtures/news/`:
- `tests/fixtures/news/hn-topstories.json`: Array of story IDs.
- `tests/fixtures/news/hn-items.json`: Mock HN story objects with scores and timestamps.
- `tests/fixtures/news/google-news.xml`: Sample Google News RSS feed with 5 articles.
- `tests/fixtures/news/techcrunch.xml`: Sample TechCrunch RSS feed with 5 AI articles.
- `tests/fixtures/news/theverge.xml`: Sample The Verge Atom feed with 5 tech articles.

### 5.3 Automated Verification Commands

```powershell
# 1. Run unit test suite
npx tsx --test tests/news-ingestion.test.ts tests/news-dedup.test.ts tests/news-synthesis.test.ts tests/news-publish.test.ts

# 2. Run full repository test suite
npm test

# 3. Test daily news publisher in dry-run mode
npx tsx scripts/publish-daily-news.ts --dry-run

# 4. Verify Next.js build and crawl consistency
npm run build
npm run check:crawl
```

---

## Conclusion & Implementation Roadmap

Phase 7 provides TierOne AutoBlog with an **autonomous, self-sustaining news engine** operating at zero marginal cost. By combining multi-feed public aggregation, shingle deduplication, structured LLM journalistic synthesis, and Schema.org `NewsArticle` markup, the blog captures daily search demand in the fast-moving Tech & AI sector while strictly complying with Google's quality and EEAT guidelines.
