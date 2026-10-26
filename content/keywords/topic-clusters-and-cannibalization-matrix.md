# TierOne AutoBlog — Topic Clusters, Keyword Ownership & Cannibalization Prevention Matrix

## 1. Executive Strategy & Market Alignment
- **Domain Focus**: AI & Digital Engineering Tools
- **Audience**: Tier-1 Organic Search Traffic (United States, United Kingdom, Canada, Australia)
- **Quality Floor**: Zero thin content, strict anti-slop verification, empirical benchmark tables, and verified author attribution.

---

## 2. Topic Cluster Architecture & Keyword Ownership (Blocker: Zero-Cannibalization Rule)

To prevent internal keyword cannibalization, each silo strictly owns its designated semantic territory. No satellite or spoke page may use the primary head keyword owned by its pillar hub in its title tag or H1.

| Silo Slug | Pillar Hub URL | Primary Cluster Intent | Designated Scope & Boundary | Forbidden Overlap Terms |
|-----------|----------------|------------------------|-----------------------------|-------------------------|
| `ai-writing` | `/ai-writing` | AI Writing & Copy Generation | Long-form drafting, copywriting, tone analysis, grammar models | Do not cover code generation or image prompting |
| `ai-coding` | `/ai-coding` | AI Coding & Software Engineering | IDE plugins, repo reasoning, code review, agentic coding | Do not cover marketing copy or meeting summaries |
| `ai-image` | `/ai-image` | Generative Diffusion & Imagery | Text-to-image models, photorealism, vector generation, upscaling | Do not cover audio/video generation or text editing |
| `ai-productivity` | `/ai-productivity` | Workflow & Automation Systems | AI calendars, meeting note taking, workflow automation, knowledge bases | Do not cover software coding IDEs or generic writing |
| `ai-guides` | `/ai-guides` | Systematic Technique & Prompting | RCCF prompt engineering, context optimization, reasoning distillation | Do not publish raw product comparisons without technique |
| `ai-news` | `/ai-news` | Breaking Engineering Dispatches | Fast-turnaround model launches, lab announcements, benchmark updates | Do not publish evergreen software roundups |

---

## 3. Playbook Mapping (Programmatic SEO)

| Silo | Playbook | Implemented Pattern | Example Live Asset |
|------|----------|---------------------|--------------------|
| `ai-writing` | Curation / Best Of | "Best [Category] (Year)" | `/blog/seed-01-best-ai-writing-assistants-2026` |
| `ai-coding` | Head-to-Head Comparison | "[Tool A] vs [Tool B] for [Task]" | `/blog/seed-02-chatgpt-vs-claude-coding` |
| `ai-image` | Freemium Curation | "Best Free [Category] in [Year]" | `/blog/seed-03-best-free-ai-image-generators` |
| `ai-productivity` | Value-Driven Roundup | "[N] [Category] That Save Time" | `/blog/seed-04-ai-productivity-tools-roundup` |
| `ai-guides` | Procedural Framework | "How to [Task]: [Framework]" | `/blog/seed-05-how-to-write-better-ai-prompts` |
| `ai-news` | Breaking Synthesis | "[Entity] [Model] [Event]: Breakdown" | `/blog/anthropic-claude-3-7-sonnet-hybrid-reasoning-release` |

---

## 4. Generative Engine Optimization (GEO) & AI Search Standards

Every generated article must comply with the Princeton GEO research findings:
1. **Answer Extraction Passage**: First 100 words must directly answer the core query in a self-contained 40-60 word block.
2. **Empirical Statistics (+37% citation boost)**: Every claim must cite specific numbers (latency in ms, pricing in USD, benchmark scores like HumanEval, SWE-bench, or MMLU).
3. **Structured Comparison Table**: Head-to-head evaluation across at least 4 criteria (Model, Speed, Cost, Best For, Verdict).
4. **FAQ Section (3-5 items)**: Target People Also Ask (PAA) and conversational queries with concise answers.
5. **Freshness & Provenance**: Last modified timestamp, named author byline, and explicit review date.

---

## 5. WebMCP (Agentic Search) Task Flows

| Task Flow | Discovery Mechanism | Execution Method | Status |
|-----------|----------------------|------------------|--------|
| Discover Site Capabilities | `<link rel="mcp-actions">` → `/mcp-actions.json` | JSON Schema Endpoint | ✅ Live |
| Read Machine-Readable Context | `<link rel="alternate" type="text/markdown">` → `/llms.txt` | Raw Markdown | ✅ Live |
| Ingest Full Knowledge Corpus | `/llms-full.txt` | Structured Index | ✅ Live |
| Verify Commercial / Pricing Terms | `/pricing.md` | Free Open Access Specification | ✅ Live |
| Submit Editorial Inquiry / Feedback | Contact Page `data-mcp-action="send-editorial-inquiry"` | Declarative WebMCP | ✅ Live |
