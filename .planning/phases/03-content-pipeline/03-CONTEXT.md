# Phase 3: Content Pipeline - Context

**Gathered:** 2026-10-17
**Status:** Ready for planning

<domain>
## Phase Boundary

System can turn a governed keyword into a structured, template-conformant draft with assets.

Scope anchor: PIPE-01 (keyword registry, per-geo US/UK/CA/AU, KD < 20 + volume 500–5k filters + SERP-overlap anti-cannibalization), PIPE-02 (competitor gap brief + outline passing structure-lint before any draft spend), PIPE-03 (1,500–2,500-word drafts in the strict template: H1 50–60 chars, meta 150–160, TL;DR ≤ 100 words, H2/H3 body, tables/lists, 3–5 PAA-derived FAQs, conclusion + CTA; dual-provider LLM), PIPE-04 (comparison-table component + related-post block, same-silo, zero orphans, mandatory pillar up-link), PIPE-05 (hero/OG/in-article images in AVIF/WebP, LCP preload, enforced alt text).

Phase 3 ends at template-conformant draft + assets. It does NOT publish (Phase 5 cron) and does NOT build the QA gate machinery (Phase 4) — but drafts landing in `content/posts/` already must pass Phase 3's own template checks. Phase 2's silo enum, single-source SEO contracts, and RelatedPosts contract are locked and carry forward — Phase 3 consumes, never retrofits.

</domain>

<decisions>
## Implementation Decisions

### Keyword acquisition + budget (PIPE-01)
- **D-01:** Keywords enter via owner-seeded topics per silo in a config file (a curated seed-topic list); the pipeline expands those topics to long-tail candidates through DataForSEO, applies filters and anti-cannibalization. Fully-automated generic-root discovery is rejected (runaway spend risk); purely manual keyword lists are rejected (slow).
- **D-02:** Spend governance = a monthly DataForSEO budget envelope (default ~$25/mo, owner-tunable) with a persisted spend ledger; remaining budget is visible in the registry data. Expansion hard-stops when the envelope is exhausted (monthly rollover). Cache-everything rule applies — a keyword's metrics are never re-billed while valid (see D-06).
- **D-03:** Phase 3 includes a one-time real backfill run: expand ~25–40 seed topics (5 silos × 5–8 topics) through DataForSEO into filtered candidates so the registry starts populated and outline/draft stages test against real data. Not placeholder-first.
- **D-04:** KD < 20 AND volume 500–5,000 are hard automated filters (PIPE-01 locked thresholds). Rejected candidates stay in the registry flagged rejected with the reason — a visible data trail, no silent discards. No per-silo value-range overrides in v1.
- **D-05:** Anti-cannibalization is deterministic SERP-overlap: if a new candidate's top-3 SERP URLs overlap ≥ 60% with an existing registry keyword's top-3, it is rejected as near-cannibal (one SERP pull per check). No LLM intent tie-breaker in v1 (nondeterminism + extra cost).
- **D-06:** Metric freshness: KD/volume/SERP top-3 are cached per registry entry with an as-of date; refresh happens only when a keyword is promoted and its metrics are older than 30 days. No scheduled whole-registry refresh.
- **D-07:** Per-geo shape is inherited from REQUIREMENTS: registry entries carry per-geo (US/UK/CA/AU) volume/KD data; drafts publish single-locale en-US per the Phase 1/2 locked decision (GEO-03, x-default self-ref).

### Registry storage + governance
- **D-08:** Registry lives as git-committed JSON in the repo under `content/keywords/` — no SQLite, no DB in v1 (matches the no-DB, rebuild-per-publish STACK posture). Layout: per-silo shards (`content/keywords/{silo}/registry.json` — 5 files, small diffs, no cross-silo clobbering) with per-keyword entry granularity inside.
- **D-09:** Promotion is automatic: the pipeline auto-advances candidates through the stage machine (expanded → filtered → briefed → outlined → drafted) whenever budget and slot rules allow. The owner seeded the topics once (D-01); after that it runs hands-off — consistent with the zero-human-gate v1 posture.

### Pipeline shape + destinations (PIPE-02/PIPE-03)
- **D-10:** Invocation = one orchestrator command (e.g. `npm run pipeline`) chaining stages seed → brief → outline → draft → assets, resumable per stage from registry status; each stage is also independently runnable for retries/debugging. Phase 3 has no scheduler — runs are manual/pre-cron (Vercel Cron arrives in Phase 5).
- **D-11:** Briefs and outlines land as git-committed Markdown under `content/briefs/{silo}/{keyword-slug}.md` (LLM artifacts stay inspectable and diffable, not buried in JSON). Finished drafts land directly in `content/posts/` as normal MDX only when the Phase 3 template checks pass — no separate drafts collection/staging mechanism (Phase 4's QA gates layer on top).
- **D-12:** Structure-lint placement follows the ROADMAP invariant: the outline must pass structure-lint before any draft spend. Every gate executable by a zero-dep check script (like `check:seeds`) is enforced that way.

### Image sourcing (PIPE-05)
- **D-13:** Hero/OG/in-article images are AI-generated per post at draft time (owned output, no licensing ambiguity, compatible with zero-human gating). Alt text is enforced by template checks; per-post budget: 1 LCP hero (16:9, doubles as OG variant) + up to 2 in-article images where the outline flags value. AVIF/WebP conversion + hero preload per PIPE-05.
- **D-14:** Comparison-table content = structured rows in post frontmatter, zod-validated through Content Collections (malformed rows fail the build — same gate philosophy as the silo enum); the body renders them via a shared `<ComparisonTable>` component. Inline-JSX table data (escaping validation) is rejected. Seed retrofit: seed-01's existing tool-comparison table converts to this frontmatter + component pattern as live proof of the render path (`check:seeds` lint updated accordingly); the other 4 seeds keep their GFM tables.

### the agent's Discretion
- **DataForSEO mechanics:** endpoint selection (Labs keyword-ideas, SERP API), task batching/polling, caching implementation, ledger file format — planner/researcher discretion within D-02 cache-everything + stop-on-envelope rules.
- **LLM stage engineering:** specific model IDs per stage, structured-output (JSON mode) shapes for outline/frontmatter payloads, prompt templates, retry/backoff policy per stage — researcher discretion within the STACK locked dual-provider split (Anthropic primary long-form; OpenAI fallback + cheap narrow subtasks).
- **Registry entry schema:** exact field names, status enum vocabulary, and per-geo fields beyond the approved shape (metrics + as-of + status + rejection reason) — planner discretion.
- **Brief/outline Markdown structure:** section layout of the gap brief and the outline lint rules (what `check:*` asserts) — planner discretion within PIPE-02 acceptance and criteria #2.
- **Images:** provider/model selection + quality tier + prompt approach (OpenAI Images default per STACK), and `<ComparisonTable>` internal prop design within D-14.
- **FaQ/PAA sourcing mechanics:** where PAA questions come from (SERP API features vs existing audit data) within criterion #3.

</decisions>

<specifics>
## Specific Ideas

- The registry is a "visible data trail, no invisible discards" system — rejected keywords must be auditable later (D-04).
- Image budget is deliberately lean: quality-over-quantity for CWV (hero for LCP relevance, in-article only where the outline says it earns its bytes).
- Every Phase 3 check follows the established zero-dep script idiom: exit code + "N passed" output + part of the `check:*` family enforced in CI (proven by `check:seeds` and `check:crawl`).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — vision; zero-human-gate v1; Tier-1 geo-targeting (single-locale en-US + x-default launch); Next.js 16.x stack decision.
- `.planning/REQUIREMENTS.md` — PIPE-01..05 acceptance criteria (this phase); what is explicitly out of scope for v1.
- `.planning/ROADMAP.md` — Phase 3 goal, 5 success criteria, ordering invariant (no auto-publish before proven QA), Phase 4 dependency.

### Research (architecture authority)
- `.planning/research/STACK.md` — locked stack: dual-provider LLM split + per-stage model routing, DataForSEO pay-as-you-go (cached, batched), Content Collections + zod, next-seo v7, `@vercel/og`, what-NOT-to-use list, env-var hygiene on Vercel.
- `.planning/research/ARCHITECTURE.md` — pipeline architecture patterns (agent pipeline shape, where the pipeline writes, Content Collections as the outward edge).
- `.planning/research/SUMMARY.md` — corrected decisions (single-locale, Google track via sitemaps/GSC API, FAQPage hygiene), keyword-registry + SERP-overlap ground rules.
- `.planning/research/FEATURES.md` — strict post-template spec (H1/meta/TL;DR/FAQ/CTA/token/tables) that drafts must conform to; deferred ideas list.
- `.planning/research/PITFALLS.md` — hallucinated-data and scaled-abuse pitfalls the pipeline must avoid (invented stats, thin-content shapes).

### Prior phase bindings (locked contracts Phase 3 consumes)
- `.planning/phases/02-seo-architecture-silo-ia/02-CONTEXT.md` — locked silo enum (5 values), enrich-to-silo expectations for drafts, single-source SEO rule, RelatedPosts contract note (D-11/D-14).
- `.planning/phases/02-seo-architecture-silo-ia/02-01-SUMMARY.md` — exact builder contracts drafts inherit: `lib/silos.ts` (SILOS/getSilo/siloUrl), `lib/seo/canonical.ts` (en-US + x-default), `lib/seo/jsonld.ts` (Article/Breadcrumb/FAQ builders + FAQ-visibility hygiene rule).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/check-seeds.mjs` — zero-dep frontmatter parser + template lint + exit-code gate idiom; extend this family for structure-lint (outlines) and the draft template check.
- `scripts/check-crawl.mjs` — CI-enforced check-suite idiom (npm `check:*` scripts + GitHub Actions gating), including the pattern of parsing source modules as text to avoid import-order coupling.
- `content-collections.ts` — zod collection schema with build-fail gate; new frontmatter table schema slots in beside the silo enum gate.
- `components/related-posts.tsx` — contract `{currentSlug, silo}` unchanged; pipeline drafts gain related blocks automatically by joining the collection.
- `app/[silo]/page.tsx` + `app/page.tsx` hubs — pick up pipeline drafts automatically from the collection (newest-first).
- `lib/seo/*` + `lib/silos.ts` — canonical/hreflang/JSON-LD single-source builders drafts must consume, never re-derive.

### Established Patterns
- Zero-dep Node ESM scripts with "N passed" output + exit codes; no runtime dependency from the site on pipeline internals.
- Build-fail schema validation at the Content Collections boundary before anything renders.
- Single-source rule for SEO strings (domain literal grep-gated to `lib/site.ts`).
- Newest-first ordering everywhere; `publishedAt`/`updatedAt` ISO timestamps.

### Integration Points
- `content/posts/` collection — draft MDX lands here after template checks; homepage/landings/related/sitemaps consume it automatically.
- `content/briefs/` — new committed-Markdown directory for gap briefs + outlines (plain docs, not a content collection).
- `content/keywords/{silo}/registry.json` — read by pipeline scripts; never imported by the Next app runtime (keeps the site's zero-DB posture).
- `package.json` + env vars — new SDK deps (DataForSEO REST client, `@anthropic-ai/sdk`, `openai`) and keys live in env, never in repo (STACK rule).
- `check:*` npm scripts + CI workflows — new gates extend the existing suite and enforce in GitHub Actions like `check:crawl`.

</code_context>

<deferred>
## Deferred Ideas

- LLM intent tie-breaker for borderline (40–60%) SERP overlaps — revisit only if the deterministic threshold produces false rejection pain in practice.
- Monthly full-registry metric refresh — rejected for now (on-promotion refresh only, D-06).
- Per-silo filter overrides (relaxed volume ranges for specific silos) — revisit if a silo starves.
- Contextual in-body internal-link suggestions — not in Phase 3 ROADMAP scope (criterion 4 covers the Related block + pillar up-link); plausible Phase 4/6 extension alongside QA gates.
- Vercel Cron scheduling of the pipeline — Phase 5 (Phase 3 stays manually invoked).
- QA gate machinery (originality/thin-content/link-validity/schema-validity blocking) — Phase 4 entirely.

</deferred>

---

*Phase: 03-content-pipeline*
*Context gathered: 2026-10-17*
