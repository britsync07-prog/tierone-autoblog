# Phase 7 Plan 02: Journalistic News Article Synthesizer & Schema Compliance Summary

**Executed Date:** 2026-10-19  
**Plan:** `07-02-PLAN.md`  
**Status:** Completed & Validated  
**Requirement Addressed:** NEWS-02  

---

## Executive Summary

Plan 07-02 established the Journalistic News Article Synthesizer & Schema Compliance engine (NEWS-02) for TierOne AutoBlog.

The synthesis pipeline transforms raw/scored breaking news candidate events into publication-ready, long-form journalistic analyses. It integrates with the platform's free-tier OpenAI-compatible LLM adapter (`lib/pipeline/llm.ts`), enforces strict Zod schema constraints on character counts and structural components, mandates 4 exact H2 journalistic sections, automatically detects and sanitizes AI clichés and buzzwords (`BANNED_EDITORIAL_PHRASES`), and validates frontmatter against `draftSchema` (`lib/pipeline/draft-schema.ts`) to ensure 100% build compatibility with Content Collections and Next.js.

---

## Delivered Components

### 1. Zod Contracts & Section Validation (`lib/pipeline/news/synthesis-schema.ts`, `lib/pipeline/news/schema.ts`)
- `newsSynthesisSchema`:
  - `title`: Enforces 50–60 characters in active journalistic voice.
  - `description`: Enforces 150–160 characters of informative context.
  - `slug`: Enforces 15–70 characters in lowercase kebab-case (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`).
  - `tldr`: Executive takeaway constrained to $\le 100$ words.
  - `faq` / `faqs`: Enforces 3–4 high-intent FAQs with full answers.
  - `bodyMdx` / sections (`whatHappened`, `whyItMatters`, `industryImpact`, `primarySources`): Validates minimum 1,200 character body.
- `BANNED_EDITORIAL_PHRASES`:
  - Prohibits low-information AI buzzwords: "game-changer", "revolutionize", "revolutionary", "dive into", "delve into", "delve", "in today's fast-paced", "fast-paced world", "beacon of hope", "tapestry", "testament to", "only time will tell", "at the end of the day", "seamlessly integrates", "groundbreaking paradigm".
- `BANNED_PHRASE_REPLACEMENTS`:
  - Maps banned phrases to objective alternatives (e.g. "significant release", "transform", "analyze", "network").
- `validateNewsBodySections`:
  - Validates presence of the 4 mandatory journalistic H2 headings:
    1. `## The Breakdown: What Happened`
    2. `## Why It Matters for Developers & Engineers`
    3. `## Industry Impact & Ecosystem Context`
    4. `## Verified Sources & Primary Documentation`
- `checkBannedPhrases` & `sanitizeBannedPhrases`:
  - Scans and deterministically sanitizes buzzwords across all synthesized fields.
- `buildBodyMdxFromSections`:
  - Assembles structured sections into complete MDX format with `<Tldr>`, source citations, and EEAT disclosure links.

### 2. Editorial Prompts (`lib/pipeline/news/prompts.ts`)
- `NEWS_SYSTEM_PROMPT`:
  - Instructs model as a senior tech editor and investigative AI journalist writing for `exclusivesources.online`.
  - Enforces active voice, verified numbers, real entity names, character limits, and section structure.
  - Prohibits marketing fluff and AI clichés.
- `buildNewsSynthesisPrompt` (and alias `buildNewsPrompt`):
  - Prepares structured system and user prompts from `RawNewsItem` or `ScoredNewsCandidate`.
  - Mandates markdown link to the verified primary source: `[${candidate.source}: ${candidate.title}](${candidate.link})`.
  - Instructs inclusion of `/about` and `/editorial-process` transparency links.

### 3. Frontmatter Assembler & Validator (`lib/pipeline/news/assembler.ts`)
- `assembleNewsPostMdx`:
  - Prepares typed frontmatter with `publishedAt`, `updatedAt`, `silo: 'ai-news'`, `tldr`, `title`, `description`, `slug`, and `faq`.
  - Executes fail-closed validation through `draftSchema.parse(frontmatter)`.
  - Appends verified primary source link and EEAT links (`/about`, `/editorial-process`).
  - Serializes safe YAML frontmatter with escaped double quotes and returns both `frontmatter` and `mdxContent`.

### 4. News Synthesizer Runner (`lib/pipeline/news/synthesizer.ts`)
- `synthesizeNewsArticle`:
  - Coordinates `completeJson` calls with fallback to deterministic mock when no LLM credentials are set or `mock: true` is passed.
  - Runs automatic anti-buzzword detection and sanitization.
  - Verifies and repairs missing H2 sections.
  - Produces complete `NewsSynthesisOutput` containing typed `post`, `frontmatter`, `rawJson`, and `mdxContent`.

### 5. Deterministic Mock Fixture (`tests/fixtures/news/mock-synthesis.json`)
- Pre-validated synthetic article matching all editorial and schema criteria:
  - Title: 58 characters (`"Anthropic Launches Claude 3.7 Sonnet With Hybrid Reasoning"`)
  - Description: 152 characters (`"Anthropic has released Claude 3.7 Sonnet, introducing hybrid reasoning architecture for developers and enterprise software engineering teams worldwide."`)
  - Slug: 52 characters (`"anthropic-claude-3-7-sonnet-hybrid-reasoning-release"`)
  - TL;DR: 46 words
  - 3 complete FAQs
  - MDX body > 2,300 characters with all 4 required H2 headers, citation link, and EEAT disclosures.

### 6. Automated Test Suite (`tests/news-synthesis.test.ts`)
- 11 comprehensive automated tests covering:
  - Mock fixture schema validation.
  - Exact boundary conditions for `title` (49 fails, 55 passes, 61 fails).
  - Exact boundary conditions for `description` (149 fails, 152 passes, 161 fails).
  - Word count limit for `tldr` (90 words passes, 101 words fails).
  - Heading presence checks via `validateNewsBodySections`.
  - Cliché detection via `checkBannedPhrases`.
  - Deterministic buzzword replacement via `sanitizeBannedPhrases`.
  - Frontmatter compliance and YAML serialization via `assembleNewsPostMdx` and `draftSchema.parse()`.
  - EEAT author and link checks via `checkAuthorByline`.
  - Prompt builder structure verification.
  - End-to-end synthesizer run in mock and custom fixture modes.
- Full test suite passes: 138/138 tests passing across the repository.

---

## Verification Results

```text
✔ mock-synthesis.json strictly validates against newsSynthesisSchema (14.4781ms)
✔ title boundary enforcement (50-60 chars) (3.8156ms)
✔ description boundary enforcement (150-160 chars) (1.424ms)
✔ tldr boundary enforcement (<= 100 words) (2.1058ms)
✔ validateNewsBodySections verifies mandatory journalistic H2 headers (0.4376ms)
✔ checkBannedPhrases flags prohibited AI buzzwords and cliches (1.7222ms)
✔ sanitizeBannedPhrases replaces cliches with analytical phrasing (1.2908ms)
✔ assembleNewsPostMdx produces valid frontmatter and satisfies draftSchema (7.7985ms)
✔ buildNewsSynthesisPrompt generates structured editorial instructions (0.9253ms)
✔ synthesizeNewsArticle executes deterministic mock synthesis matching constraints (2.4705ms)
✔ synthesizeNewsArticle handles custom jsonFixture deterministic mode (3.3444ms)
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

Entire repo test suite (`npm test`):
```text
ℹ tests 138
ℹ suites 0
ℹ pass 138
ℹ fail 0
```

---

## Commits
1. `feat(07-02): implement news synthesis Zod schema, prompt builder, and anti-buzzword filter` (`8a83035`)
2. `feat(07-02): implement news article synthesizer, MDX assembler, and frontmatter validator` (`109bce3`)
