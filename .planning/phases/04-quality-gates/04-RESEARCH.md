# Phase 4: Quality Gates - Research & Architecture

**Document:** `.planning/phases/04-quality-gates/04-RESEARCH.md`  
**Phase:** 04-quality-gates  
**Status:** Complete  
**Date:** 2026-10-18  

---

## Executive Summary

Phase 4 introduces an autonomous, fail-closed quality gate pipeline (EEAT + Anti-Spam) positioned between draft generation (Phase 3) and scheduled publishing (Phase 5). Its single mandate: **no low-quality, unverified, plagiarized/near-duplicate, or off-topic content can ever reach publish**.

The system operates under the strict **Owner Directive (2026-10-17)**: a fully-free platform with zero paid API dependencies. All evaluations use deterministic algorithms, local regex/AST parsers, zero-cost keyless verification signals, and the project's OpenAI-compatible free LLM adapter (`lib/pipeline/llm.ts`).

Failed drafts are physically isolated from Next.js Content Collections builds by moving them to `content/quarantine/{id}.mdx` with companion `content/quarantine/{id}-report.json` audit records. A persistent circuit breaker halts all pipeline publishing if $K=3$ consecutive drafts are quarantined, alerting the publisher via terminal banners, `content/quarantine/ALERT.md`, and optional webhooks.

---

## User Constraints (from 04-CONTEXT.md)

1. **D-01: Physical Isolation** — Quarantined drafts are immediately moved out of `content/posts/` into `content/quarantine/{id}.mdx` accompanied by `content/quarantine/{id}-report.json`. Because Content Collections only compiles `content/posts/*.mdx`, quarantined files can never leak into the static build.
2. **D-02: Dedicated Registry Stage `'quarantined'`** — Add `'quarantined'` to `RegistryStage` in `lib/pipeline/types.ts`. The keyword is parked in its shard with `quarantine: { failedRule, score, reportPath, quarantinedAt }` until explicit manual owner reset.
3. **D-03: CLI & Index Inspection Tools** — Provide `npm run quarantine:list` and `npm run quarantine:view <id>`, plus an automatically maintained `content/quarantine/SUMMARY.md` index.
4. **D-04: Two-Tier Claim Handling** — Minor unverifiable claims or unsupported adjectives are automatically excised (cut) from the draft body; however, fabricated/hallucinated statistics, planted false figures, or claims directly contradicted by ground truth trigger immediate quarantine (fulfills the red-team requirement for planted false stat detection).
5. **D-05: Extraction + Cached Ground Truth & Keyless Search** — Factual and statistical claims are extracted via structured LLM task (`qa-extract-claims`); numbers, percentages, and dates are cross-checked against cached SERP top-3 and brief facts; unmatched specific stats use lightweight keyless search queries; all statistics in draft prose must explicitly cite a named authoritative source with year/as-of date.
6. **D-06: Deterministic Fast-Fail Pre-Filter** — Fast regex/keyword scanner for blocked YMYL topics (tax, banking, medical, credit repair, investment advice) + schema validation ensuring author is `musfiqur-rahman-saimon` and links `/about` and `/editorial-process`; fails instantly before any LLM passes.
7. **D-07: Algorithmic N-Gram/Jaccard Similarity Floor** — Deterministic n-gram (shingling/Jaccard) similarity calculation against all existing corpus posts and cached SERP content. Similarity > 0.70 triggers an immediate quarantine as a near-duplicate (fulfills red-team near-duplicate test).
8. **D-08: Structured 4-Point Information Gain Rubric** — Dedicated LLM evaluation task scoring: (1) unique workflow guidance, (2) structured comparison synthesis, (3) edge-case/limitation coverage, and (4) competitor gap closure. Draft must score $\ge 3/4$ to pass; failure quarantines.
9. **D-09: Deterministic Link Crawl Gate** — Pre-publish crawler verifying all internal links resolve to valid routes in the Next.js route table (broken internal link = instant quarantine); external links probed with quick HTTP HEAD (4s timeout; broken external link has anchor tag stripped to plain text with logged warning, or quarantines if central to the article).
10. **D-10: $K = 3$ Consecutive Failure Circuit-Breaker** — 3 consecutive draft quarantines immediately halts pipeline publishing to prevent quota waste, runaway retries, or systemic prompt regressions.
11. **D-11: Persistent State Lockfile + CLI Resume** — Halt state stored in `content/keywords/pipeline-state.json` (`{ paused: true, pausedAt, consecutiveFailures: 3, failureHistory, reason }`). All pipeline entrypoints fail preflight immediately when paused. Resuming requires `npm run pipeline:resume`.
12. **D-12: Multi-Channel Alerting** — High-visibility terminal alert banner + actionable `content/quarantine/ALERT.md` + optional webhook dispatch if `ALERT_WEBHOOK_URL` is configured in `.env`.

---

## Standard Stack & Recommended Libraries

### Core Technology Choices
| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Shingling & Jaccard Engine** | Custom Zero-Dep TypeScript (`lib/pipeline/qa/shingle.ts`) | Algorithmic N-gram tokenizer & Set Jaccard calculation requires fewer than 80 lines of pure TS. Zero external dependencies, deterministic, sub-millisecond execution. |
| **Claim Extraction & Info Gain** | `completeJson` via `lib/pipeline/llm.ts` | Uses project's existing OpenAI-compatible free LLM adapter. Free, supports JSON schema parsing, respects TPM rate limits. |
| **Deterministic Link Crawler** | Node.js native `fetch` with `AbortSignal.timeout(4000)` + Static Route Manifest | Fast HTTP HEAD checks for external links with 4s timeout. Internal routes resolved against Next.js static pages (`/`, `/about`, `/editorial-process`, `/terms`, `/privacy`) and `content/posts/*.mdx` slugs. |
| **Pre-Filter Topic Blocklist** | Pre-compiled regex scanner (`lib/pipeline/qa/blocklist.ts`) | Instant CPU-bound regex check before any network or LLM expenditure. Detects YMYL violations in microseconds. |
| **Quarantine & State Management** | Node.js `node:fs` atomic write (`writeFileSync` + `renameSync`) | Idempotent, safe on crash, preserves git audit trail. |

---

## Architecture Patterns & Stage Machine Design

### 1. Gate Execution Order
To minimize LLM token usage and execution time, gates execute in strict order of computational cost and fail-closed certainty:

```
Draft Landed in content/posts/
              │
              ▼
    [1. Preflight Lock Check] ──(paused == true)─────────► Halt Pipeline
              │ (passes)
              ▼
    [2. Deterministic Pre-Filters] ──(YMYL / Byline fail)──► Quarantine + Trip Circuit Breaker
              │ (passes)
              ▼
    [3. Deterministic Link Crawler] ──(Broken internal)─────► Quarantine + Trip Circuit Breaker
              │ (passes)
              ▼
    [4. N-Gram Shingler / Jaccard] ──(Similarity > 0.70)───► Quarantine + Trip Circuit Breaker
              │ (passes)
              ▼
    [5. Fact-Checking / Claim Gate] ──(Planted False Stat)──► Quarantine + Trip Circuit Breaker
              │ (minor unsourced fluff auto-cut)
              ▼
    [6. Information Gain Evaluator] ──(Score < 3/4)────────► Quarantine + Trip Circuit Breaker
              │ (passes: score >= 3/4)
              ▼
    [7. Promotion to Verified Draft]
         - Post stays in content/posts/{slug}.mdx
         - Entry records qa: { passedAt, infoGainScore, claimsChecked }
         - consecutiveFailures reset to 0 in pipeline-state.json
```

### 2. Physical File Quarantine Mechanics (D-01)
Next.js Content Collections compiles every `.mdx` file located in `content/posts/`. Leaving a rejected or quarantined draft in `content/posts/` with a frontmatter status flag (e.g. `status: 'quarantined'`) risks build errors if invalid MDX syntax exists or leaking pages into static builds.
- **Action on Quarantine:**
  ```ts
  const quarantineFile = join('content/quarantine', `${entry.id}.mdx`);
  const reportFile = join('content/quarantine', `${entry.id}-report.json`);
  renameSync(sourcePostPath, quarantineFile);
  writeFileSync(reportFile, JSON.stringify(auditReport, null, 2), 'utf8');
  updateQuarantineSummary();
  ```
- **Companion Audit Report (`{id}-report.json`):**
  Contains:
  - `id`: Keyword/slug ID
  - `failedGate`: Name of failing gate (`blocklist`, `byline`, `link-crawler`, `originality`, `fact-check`, `information-gain`)
  - `score`: Numeric metric (e.g., Jaccard similarity `0.82`, Info Gain `2/4`)
  - `details`: Human-readable evidence (e.g., "Planted false stat detected: '78% of all code was written by AI in 1994' contradicts historical timeline")
  - `timestamp`: ISO-8601 UTC timestamp
  - `suggestedRemediation`: Actionable fix steps for the publisher

### 3. Circuit-Breaker State Machine ($K=3$) (D-10, D-11, D-12)
The circuit-breaker protects against runaway prompt drift or model degradation:
- State file: `content/keywords/pipeline-state.json`
- Default state: `{ "paused": false, "consecutiveFailures": 0, "failureHistory": [] }`
- On each QA pass: `consecutiveFailures` is reset to `0`.
- On each QA fail: `consecutiveFailures` increments by `1`.
- When `consecutiveFailures >= 3`:
  - `paused` becomes `true`.
  - `pausedAt` is recorded.
  - Generates `content/quarantine/ALERT.md` with headline, failure history, and triage instructions.
  - Emits loud red ANSI terminal banner on stderr.
  - Sends webhook POST if `process.env.ALERT_WEBHOOK_URL` is configured.
  - Any future pipeline invocation (`npm run pipeline` or `npm run pipeline -- --stage <stage>`) aborts during preflight before touching registry shards or LLMs.
- Manual Reset:
  - `npm run pipeline:resume` validates quarantine state, resets `paused` to `false`, sets `consecutiveFailures` to `0`, cleans `ALERT.md`, and persists `pipeline-state.json`.

---

## Technical Details: The 5 Quality Gates

### Gate 1: Deterministic Pre-Filters (Topic Blocklist & Byline/EEAT)
1. **Topic Blocklist (`lib/pipeline/qa/blocklist.ts`):**
   - Scans title, description, keywords, and body against pre-compiled regex word boundaries:
     - `\b(tax (return|deduction|credit|bracket)|irs filing|write off expenses)\b`
     - `\b(bank account|checking account|wire transfer|swift code|routing number)\b`
     - `\b(credit score|repair credit|fix credit|fico score|credit bureau)\b`
     - `\b(medical diagnosis|prescription dosage|cure disease|treat symptom|fda approved)\b`
     - `\b(stock pick|buy stock|investment advice|guaranteed return|cryptocurrency signal)\b`
   - Instant failure $\rightarrow$ immediate quarantine.
2. **Author Byline & EEAT Transparency:**
   - Author must be `musfiqur-rahman-saimon`.
   - Body must include links to `/about` and `/editorial-process`.
   - Frontmatter must contain valid dates (`publishedAt`, `updatedAt`).

### Gate 2: Deterministic Link Crawler (`lib/pipeline/qa/link-crawler.ts`)
1. **Internal Links:**
   - Extract all markdown links matching `^/(?!/)`.
   - Validate against known static routes (`/`, `/about`, `/editorial-process`, `/terms`, `/privacy`) and all current post slugs (`/posts/${slug}`).
   - Broken internal link $\rightarrow$ Immediate quarantine (broken internal navigation directly degrades UX and crawl equity).
2. **External Links:**
   - Extract all external links (`https://...`).
   - Probe each with HTTP `HEAD` request with 4-second timeout (`AbortSignal.timeout(4000)`).
   - If server returns 405 Method Not Allowed, fallback to HTTP `GET` with stream abort after headers.
   - If external link is dead (404, DNS NXDOMAIN, connection refused):
     - If non-critical inline mention: automatically strip the `[text](url)` link markup to plain `text` and log a warning.
     - If primary source citation in comparison table: mark as QA warning or quarantine if central.

### Gate 3: Algorithmic N-Gram Shingler & Jaccard Originality Floor (`lib/pipeline/qa/shingle.ts`)
1. **Algorithm:**
   - Text Normalization: Lowercase, remove markdown formatting, punctuation, code blocks, and stop-words.
   - $N$-gram Generation: Generate 5-grams (overlapping sequences of 5 consecutive tokens).
   - Shingle Sets: Construct `Set<string>` of 5-grams for Candidate Draft ($D$) and Reference Document ($R$).
   - Jaccard Similarity:
     $$J(D, R) = \frac{|S_D \cap S_R|}{|S_D \cup S_R|}$$
2. **Corpus Comparison:**
   - Compares candidate draft against:
     1. All published posts in `content/posts/*.mdx`
     2. Seed posts
     3. Cached SERP top-3 snippets from `serpTop3` in `content/keywords/{silo}/registry.json`
3. **Threshold:**
   - Any $J(D, R) > 0.70$ triggers immediate quarantine as a near-duplicate.

### Gate 4: Fact-Checking & Claim Verification Engine (`lib/pipeline/qa/fact-check.ts`)
1. **Claim Extraction Task (`qa-extract-claims`):**
   - Prompt extracts factual claims into structured JSON:
     - Numerical statistics (percentages, benchmarks, money amounts, dates)
     - Product specifications and feature availability
     - Quoted source attributions
2. **Two-Tier Verification:**
   - **Ground Truth Sources:**
     1. Cached SERP competitor data in `serpTop3`
     2. Brief facts in `content/briefs/{id}.md`
     3. Keyless public web search (e.g., DuckDuckGo instant API or Wikipedia API) for unreferenced specific stats
   - **Tier 1 (Soft Fluff / Unsupported Adjectives):**
     - Vague, unsourced claims ("This tool is widely considered 10x faster than traditional solutions") are automatically excised or sanitized in the draft text.
   - **Tier 2 (Fabricated Figures / Planted False Stats):**
     - Planted false stats (e.g. "78% of all code was written by AI in 1994") or claims directly contradicting historical facts trigger immediate quarantine.
   - **Citation Rule:**
     - All statistical claims in draft prose must carry a named source with year/date (e.g., "According to Gartner (2025)..."). Drafts with raw, unattributed floating numbers fail fact-checking.

### Gate 5: Structured 4-Point Information Gain Rubric (`lib/pipeline/qa/info-gain.ts`)
1. **Rubric Dimensions:**
   - **Dimension 1: Unique Workflow Guidance** (Does the post provide hands-on, step-by-step procedures beyond generic bullet lists?)
   - **Dimension 2: Structured Comparison Synthesis** (Does the post provide clear tradeoff analysis and structured feature/pricing evaluation?)
   - **Dimension 3: Edge-Case & Limitation Coverage** (Does the post candidly discuss when a tool fails, edge cases, and drawbacks?)
   - **Dimension 4: Competitor Gap Closure** (Does the post answer specific questions or user pain points that top-3 SERP results omitted?)
2. **Scoring:**
   - Each dimension scored 0 or 1 with concrete reasoning.
   - Passing threshold: $\ge 3 / 4$.
   - Score $\le 2$ triggers immediate quarantine.

---

## Don't Hand-Roll vs What to Hand-Roll

| Component | Recommendation | Why |
|-----------|----------------|-----|
| **N-Gram Jaccard Calculation** | Hand-roll (~50 lines TS) | Trivial math (`Set` intersection over union). Avoids unmaintained npm packages with CVEs. Fast and deterministic. |
| **HTTP HEAD Crawler** | Native Node.js `fetch` + `AbortSignal` | Built into Node 18+; no need for `axios` or `got`. Supports native timeout and redirect handling. |
| **Markdown Frontmatter & Links** | Regex + line parser | Established project idiom in `scripts/check-template.mjs` and `scripts/check-seeds.mjs`. Zero external dependencies. |
| **LLM Output Parsing** | `zod` schema parsing via `completeJson` | Already built and verified in `lib/pipeline/llm.ts`. Enforces rigid JSON typing. |

---

## Common Pitfalls & Red-Team Attack Vectors

### Attack Vector 1: Planted False Statistics (Red-Team Test 1)
- **Vector:** The AI drafts a post containing a wildly false or ungrounded statistic: `"In 1994, 78% of enterprise software was created autonomously by AI."`
- **Pitfall:** A weak QA gate that only checks regex for numbers without validating veracity or historical plausibility will let this slip through.
- **Defense:**
  1. `qa-extract-claims` isolates `{ subject: "AI software creation", stat: "78%", date: "1994" }`.
  2. The verifier checks against historical baseline and year reasonableness. 1994 predates modern LLMs by decades; discrepancy score triggers Tier 2 quarantine.
  3. Red-team test script creates this exact fixture and asserts quarantine.

### Attack Vector 2: Near-Duplicate / Sybil Posts (Red-Team Test 2)
- **Vector:** A generator produces a post that rephrases `seed-01` or another published article with synonyms, copying the structure and 80% of sentences.
- **Pitfall:** Traditional word-count or keyword checks pass because vocabulary is rich.
- **Defense:**
  1. N-gram 5-shingling computes Jaccard similarity against all existing `.mdx` files.
  2. Near-duplicate scores $0.78 > 0.70$ threshold $\rightarrow$ Immediate quarantine.
  3. Red-team test script duplicates an existing post with superficial word swaps and asserts quarantine.

### Attack Vector 3: Broken Internal Link Hallucination (Red-Team Test 3)
- **Vector:** AI hallucinates a link: `[Read our guide on Python automation](/posts/python-automation-guide)`.
- **Pitfall:** MDX compiles without error if the link is a standard markdown `<a>` tag, leaving a 404 in production.
- **Defense:**
  1. Link crawler extracts all internal paths and tests against `content/posts/*.mdx` slugs and static routes.
  2. Unmatched path triggers immediate quarantine.
  3. Red-team test script adds a dead internal route and asserts quarantine.

### Attack Vector 4: Runaway Retries & Token Burn ($K=3$ Circuit Breaker)
- **Vector:** Prompt regression causes every generated post to fail QA consecutively.
- **Pitfall:** Pipeline keeps retrying indefinitely, burning LLM tokens and hitting TPM rate limits.
- **Defense:**
  1. Circuit breaker tracks consecutive quarantines in `content/keywords/pipeline-state.json`.
  2. On 3rd failure, pipeline pauses, locks preflight, emits `ALERT.md`, and stops.

---

## Validation Architecture & Nyquist Strategy

### Test Suites
1. **Unit Tests (`tests/qa-shingle.test.ts`):**
   - Jaccard similarity of identical texts is 1.0.
   - Jaccard similarity of completely disjoint texts is 0.0.
   - Jaccard similarity of lightly modified text correctly identifies $> 0.70$ threshold.
2. **Unit Tests (`tests/qa-blocklist.test.ts`):**
   - Detects all blocked YMYL terms across title, description, and body.
   - Allows safe tech/digital tool content without false positives.
   - Validates author byline and `/about` + `/editorial-process` links.
3. **Unit Tests (`tests/qa-link-crawler.test.ts`):**
   - Verifies internal routes against route table; flags non-existent paths.
   - Tests HTTP HEAD probing and link-stripping behavior.
4. **Integration & Red-Team Tests (`tests/qa-redteam.test.ts`):**
   - **Red-Team 1:** Planted false stat is isolated, flagged, and draft is quarantined.
   - **Red-Team 2:** Near-duplicate draft (>0.70 Jaccard) is quarantined.
   - **Red-Team 3:** Broken internal link is quarantined.
   - **Red-Team 4:** 3 consecutive failures trip `paused: true` in `pipeline-state.json` and generate `ALERT.md`.
   - **Recovery Test:** `npm run pipeline:resume` successfully unlocks pipeline.

---

## RESEARCH COMPLETE
