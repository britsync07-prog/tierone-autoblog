---
phase: 03-content-pipeline
plan: 06
subsystem: pipeline
tags: [llm, draft, mdx, template-checker, content-collections, full-chain, ci, free-tier]

# Dependency graph
requires:
  - phase: 03-content-pipeline (plans 01–05)
    provides: stage runner, registry shards, brief & outline stages, draft-schema & comparison table, image generation
provides:
  - lib/pipeline/llm.ts — 'draft-body' task wired to OpenAI-compatible free adapter with TPM-safe token limits (default 6000) and 35s backoff on 429
  - lib/pipeline/stages/draft.ts — draft stage: runs completeJson on outlined entries, validates zod payload, checks stage assertions (1500-2500 word band, H2 fidelity, FAQ provenance, comparison parity), validates draftSchema, runs check:template gate BEFORE advance, persists attempt trail on failure
  - scripts/check-template.mjs — zero-dependency landed-post template gate (frontmatter, title/description windows, slug, FAQ count, TL;DR <=100 words, >=3 H2s, /about CTA, banned phrases, H1 ban, unresolved markers)
  - content/posts/best-ai-writing-tools.mdx — first real pipeline-generated post landed and compiled into Next.js static pages
  - .github/workflows/lhci.yml — CI build job wired with check:registry, check:outline, check:template before build
affects: [Phase 4 QA-gates, Phase 5 auto-publishing]

# Tech tracking
tech-stack:
  added: []
  patterns: [gate-before-advance (spawnSync check-template precedes registry advance), visible-attempt-trail (draft.attempts/lastError on failure), tpm-aware-token-budget (bounded maxTokens for free API tiers), multi-paragraph-prompt-enforcement]

key-files:
  created:
    - scripts/check-template.mjs
    - content/posts/best-ai-writing-tools.mdx
    - test/fixtures/pipeline/template-fixtures/**
    - test/fixtures/pipeline/draft-registry/**
    - test/fixtures/pipeline/draft-fixtures/**
  modified:
    - lib/pipeline/llm.ts
    - lib/pipeline/stages/draft.ts
    - lib/pipeline/stages/outline.ts
    - .github/workflows/lhci.yml
    - content/keywords/**/registry.json
    - content/keywords/spend-ledger.json

key-decisions:
  - "Draft stage enforces D-12 gate-before-advance: spawnSync check-template runs over the posts dir before registry advance; on failure, written MDX is deleted and attempt/lastError trail is recorded with stage remaining 'outlined'"
  - "Free-tier TPM governor: TASK_MAX_TOKENS['draft-body'] set to 6000 (overridable by LLM_MAX_TOKENS_DRAFT) to prevent prompt+output exceeding free endpoint 8000 TPM limit; transport backs off 35s on HTTP 429"
  - "Outline stage cleans up un-passed outlines on lint failure to avoid invalid artifacts lingering in content/briefs"
  - "First real draft landed (best-ai-writing-tools.mdx) with comparison block, hero image assets, 1500-2500 word body, and compiled cleanly into static HTML via next build"

requirements-completed: [PIPE-03]

# Metrics
duration: 45min
completed: 2026-10-18
---

# Phase 03 Plan 06: Draft Stage, Real Chain Run, and CI Gate Enforcement Summary

**The end-to-end autonomous content pipeline is fully live and proven: the draft stage produces template-conformant 1,500–2,500-word long-form articles with hero assets, comparison blocks, and PAA FAQs, validated by a zero-dep template gate before advance, wired into CI, and demonstrated with the first real landed post (`best-ai-writing-tools.mdx`).**

## Performance

- **Duration:** 45 min
- **Tasks:** 3 (Task 1: check-template gate; Task 2: draft stage + fixture verification; Task 3: real full-chain run + CI gate wiring)
- **Files touched:** 35+ (content, scripts, pipeline stages, fixtures, CI)
- **Pipeline result:** 1 real draft landed, 6 documents rendered in Content Collections, 24 static pages generated cleanly in Next.js build.

## Accomplishments

- **Template Gate (`scripts/check-template.mjs`)**: zero-dependency gate checking 14 strict template rules (frontmatter, title 50-60, meta description 150-160, slug regex, date parseability, 3-5 FAQs, TL;DR <=100 words, silo membership, >=3 H2s, `/about` CTA link, banned marketing buzzwords, H1 ban in body, unresolved marker bans, comparison frontmatter presence). Passes all 5 seeds and landed drafts.
- **Draft Stage (`lib/pipeline/stages/draft.ts`)**: implements the complete `outlined -> drafted` transition with defensive preconditions (outline lint pass, hero assets present, question pool >=3), zod payload validation, stage assertions (word band 1,500–2,500, exact H2 fidelity, FAQ question provenance, comparison-slot parity), atomic write, and `spawnSync` gate-before-advance. Failed attempts delete half-written files and record visible D-04 attempt trails (`attempts`, `lastError`).
- **First Real Draft Landed**: `content/posts/best-ai-writing-tools.mdx` generated and verified via the real pipeline run with free procedural hero + in-article image assets, comparison table with pricing note, and 1,500+ word in-depth reviews and use-case breakdowns.
- **CI Enforcement (`.github/workflows/lhci.yml`)**: all three Phase 3 quality gates (`check:registry`, `check:outline`, `check:template`) run in the build job ahead of `npm run build`.

## Task Commits

1. **Task 1: Landed-post template gate** — `5a30d4c` (test), `0f34e80` (feat)
2. **Task 2: Draft stage with gate-before-advance** — `932cc27` (test), `7bf2111` (feat)
3. **Task 3: Real pipeline run + CI wiring** — `87a7d86` (feat: first real pipeline run), `7916e9e` (ci: wire check gates into lhci.yml)

## Verification

- `npm run check:registry`: 5722 registry checks passed
- `npm run check:outline`: 9 passed
- `npm run check:template`: 6 passed (5 seeds + `best-ai-writing-tools.mdx`)
- `npx tsc --noEmit`: 0 errors
- `npm run build`: built 1 collection with 6 documents, generated 24 static pages including `/blog/best-ai-writing-tools`
