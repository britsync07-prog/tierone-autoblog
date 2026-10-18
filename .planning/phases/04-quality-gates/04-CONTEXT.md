# Phase 4: Quality Gates - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers an autonomous, fail-closed quality gate pipeline (EEAT + Anti-Spam) between draft generation (Phase 3) and scheduled publishing (Phase 5). No low-quality, unverified, plagiarized/near-duplicate, or off-topic content can ever reach publish. Quarantined drafts are physically isolated from Next.js builds, audited via human-readable reports, and protected by a circuit-breaker auto-pause ($K=3$) with owner alerting.

</domain>

<decisions>
## Implementation Decisions

### Quarantine Storage & Isolation
- **D-01:** Physical Isolation — Failed drafts are immediately moved out of `content/posts/` into `content/quarantine/{id}.mdx` accompanied by a detailed `content/quarantine/{id}-report.json` audit file. Because Content Collections only compiles `content/posts/*.mdx`, quarantined files can never leak into the static build. — **Reversibility:** one-way — (Moving files out of `content/posts` is a hard architectural boundary required to isolate from Next.js Content Collections without runtime filtering).
- **D-02:** Dedicated Registry Stage `'quarantined'` — Add `'quarantined'` to `RegistryStage` in `lib/pipeline/types.ts`. The keyword is parked in its shard with `quarantine: { failedRule, score, reportPath, quarantinedAt }` until explicit manual owner reset.
- **D-03:** CLI & Index Inspection Tools — Provide `npm run quarantine:list` (summary table of quarantined posts and reasons) and `npm run quarantine:view <id>` (formatted audit inspection), plus an automatically maintained `content/quarantine/SUMMARY.md` index.

### Fact-Checking & Claim Verification
- **D-04:** Two-Tier Claim Handling — Minor unverifiable claims or unsupported adjectives are automatically excised (cut) from the draft body; however, fabricated/hallucinated statistics, planted false figures, or claims directly contradicted by ground truth trigger immediate quarantine (fulfilling the red-team requirement for planted false stat detection).
- **D-05:** Extraction + Cached Ground Truth & Keyless Search — Factual and statistical claims are extracted via structured LLM task (`qa-extract-claims`); numbers, percentages, and dates are cross-checked against cached SERP top-3 and brief facts; unmatched specific stats use lightweight keyless search queries; all statistics in draft prose must explicitly cite a named authoritative source with year/as-of date (e.g., "According to [Source] (2025/2026)").
- **D-06:** Deterministic Fast-Fail Pre-Filter — Fast regex/keyword scanner for blocked YMYL topics (tax, banking, medical, credit repair, investment advice) + schema validation ensuring author is `musfiqur-rahman-saimon` and links `/about` and `/editorial-process`; fails instantly before any LLM passes.

### Information Gain & Originality Scoring
- **D-07:** Algorithmic N-Gram/Jaccard Similarity Floor — Deterministic n-gram (shingling/Jaccard) similarity calculation against all existing corpus posts and cached SERP content. Similarity > 0.70 triggers an immediate quarantine as a near-duplicate (fulfilling the red-team near-duplicate test).
- **D-08:** Structured 4-Point Information Gain Rubric — Dedicated LLM evaluation task scoring: (1) unique workflow guidance, (2) structured comparison synthesis, (3) edge-case/limitation coverage, and (4) competitor gap closure. A draft must score $\ge 3/4$ to pass; failure quarantines.
- **D-09:** Deterministic Link Crawl Gate — Pre-publish crawler verifying all internal links resolve to valid routes in the Next.js route table (broken internal link = instant quarantine); external links probed with quick HTTP HEAD (4s timeout; broken external link has anchor tag stripped to plain text with a logged warning, or quarantines if central to the article).

### Auto-Pause Thresholds & Failure Alerting (QA-04)
- **D-10:** $K = 3$ Consecutive Failure Circuit-Breaker — 3 consecutive draft quarantines immediately halts pipeline publishing to prevent quota waste, runaway retries, or systemic prompt regressions.
- **D-11:** Persistent State Lockfile + CLI Resume — Halt state stored in `content/keywords/pipeline-state.json` (`{ paused: true, pausedAt, consecutiveFailures: 3, failureHistory, reason }`). All pipeline entrypoints fail preflight immediately when paused. Resuming requires `npm run pipeline:resume` (which clears the lock and resets the failure counter to 0).
- **D-12:** Multi-Channel Alerting — High-visibility terminal alert banner + actionable `content/quarantine/ALERT.md` + optional webhook dispatch if `ALERT_WEBHOOK_URL` is configured in `.env` (gracefully skipped if unset).

### Agent's Discretion
- Exact prompt engineering and schema details for `qa-extract-claims` and `qa-evaluate-gain`.
- Specific shingling parameters ($n$-gram size, e.g. 3-grams vs 5-grams) for Jaccard similarity.
- Formatting layout for `content/quarantine/SUMMARY.md` and CLI output tables.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Roadmap
- `.planning/PROJECT.md` — Quality floor, EEAT/anti-spam mandate, fully-free platform directive.
- `.planning/REQUIREMENTS.md` § Quality Gates (QA-01, QA-02, QA-03, QA-04) — Core requirements for quarantine, fact verification, blocklist, and auto-pause.
- `.planning/ROADMAP.md` § Phase 4: Quality Gates — Success criteria and red-team test specifications.

### Architecture & Pipeline
- `lib/pipeline/types.ts` — Registry entry schema and `RegistryStage` enum.
- `lib/pipeline/registry.ts` — Stage advancement, shard loading, and persistence.
- `lib/pipeline/run.ts` — Pipeline runner and stage execution chain.
- `scripts/check-template.mjs` — Landed-post strict template gate.
- `content-collections.ts` — MDX document collection configuration.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/pipeline/llm.ts`: `completeJson` for structured LLM tasks (`qa-extract-claims`, `qa-evaluate-gain`) using OpenAI-compatible free adapter.
- `lib/pipeline/registry.ts`: `loadShard`, `saveShard`, `advance`, `reject` primitives for updating keyword states.
- `scripts/check-template.mjs`: Pre-existing rules for banned buzzwords, title/meta lengths, structure, and CTAs.

### Established Patterns
- **Gate-Before-Advance (D-12)**: Running checks and verifying disk/state consistency before mutating registry or advancing stages.
- **Fail-Closed Security**: Missing files, timeouts, transport errors, or unverified claims park or quarantine, never fail open.
- **Zero-Dep Scripts**: Independent node scripts in `scripts/` that can run standalone and in CI.

### Integration Points
- **Pipeline Runner (`lib/pipeline/run.ts`)**: Add a new `qa` stage in `STAGE_ORDER` after `draft` (or integrate QA before publish).
- **Preflight Gate**: All stages in `run.ts` check `content/keywords/pipeline-state.json` to verify `paused !== true`.
- **Directory Structure**: Add `content/quarantine/` for quarantined `.mdx` drafts, JSON reports, and `ALERT.md`.

</code_context>

<specifics>
## Specific Ideas

- **Red-Team Verification Tests**: Phase 4 plans must include deliberate red-team tests:
  1. A draft containing a planted false statistic (e.g., "78% of all code was written by AI in 1994") MUST be caught and quarantined.
  2. A near-duplicate draft (>0.70 similarity to an existing post or competitor) MUST be caught and quarantined.
  3. A draft with an invalid internal link (e.g. `/non-existent-page`) MUST be caught and quarantined.
  4. Triggering 3 consecutive failures MUST trip `paused: true` and write `ALERT.md`.

</specifics>

<deferred>
## Deferred Ideas

- Post-publish live-URL monitoring (belongs in Phase 5: Autonomous Publish + Indexing).
- GSC indexing verification & CTR analytics (belongs in Phase 6: Observe, Refresh + Compound).

</deferred>

---

*Phase: 04-quality-gates*
*Context gathered: 2026-10-18*
