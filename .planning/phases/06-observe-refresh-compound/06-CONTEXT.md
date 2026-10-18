# Phase 6: Observe, Refresh + Compound - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 implements the compounding growth layer for TierOne AutoBlog:
1. An owner-facing growth analytics dashboard at `/dashboard` displaying country-segmented search traffic (GSC country × page × query) and engagement (Plausible), spotlighting Tier-1 traffic share and the $\ge 70\%$ indexed-to-submitted ratio.
2. An autonomous content refresh engine that detects striking-distance keywords (positions 5.0–20.0) and decaying content (>90d traffic loss), manages a structured refresh queue (`content/keywords/refresh-queue.json`), and handles data-driven 301 redirects (`content/redirects.json`).
3. A publishing velocity governor gating daily publication behind a strict 4-point 60-day baseline check.
4. An automated pillar hub promotion engine that elevates silos with 8–12 published articles into comprehensive hubs with bidirectional link meshes.

</domain>

<decisions>
## Implementation Decisions

### Analytics Dashboard & Access Control (GROW-01)
- **D-01:** Protected Dashboard Route — Implement `/dashboard` in Next.js App Router (`app/dashboard/page.tsx`), gated by a secret token via query param `?token=...` or `Authorization: Bearer <token>` matching `process.env.DASHBOARD_SECRET`. Access attempts without the valid token return HTTP 404 / Unauthorized, protecting private search data from public scrapers.
- **D-02:** Country-Segmented Data Sourcing & Offline Resilience — Fetch live search analytics from Google Search Console API (grouped by `country`, `page`, `query`) and Plausible stats API. For local development or when API credentials are unset, automatically fall back to cached snapshots in `content/analytics/snapshot.json` and a deterministic synthetic generator so the dashboard renders cleanly without third-party dependencies.
- **D-03:** Headline Metrics & Visual Indicators —
  - **Tier-1 Share Headline**: Prominently displays percentage of sessions and impressions originating from US, UK, CA, and AU.
  - **Indexed-vs-Submitted Ratio**: Visual gauge displaying live sitemap coverage against the $\ge 70\%$ target.
  - **Performance Breakdown**: Top pages and top queries filterable by country.

### Refresh Engine & 301 Consolidation (GROW-02)
- **D-04:** Striking-Distance & Content Decay Detection —
  - **Striking-Distance**: Pages/queries ranking between average position 5.0 and 20.0 with $\ge 50$ impressions over the last 28 days.
  - **Content Decay**: Articles with $\ge 90$ days elapsed since publication demonstrating a $\ge 25\%$ drop in clicks or impressions comparing the current 30-day window against the previous 30-day window.
- **D-05:** Autonomous Refresh Execution & Queue —
  - Scans and persists actionable items into `content/keywords/refresh-queue.json`.
  - Automatically executes safe, low-risk optimizations during scheduled runs: updating frontmatter `dateModified` to current ISO date, injecting missing FAQ questions derived from high-impression striking-distance queries, and repairing broken external links.
  - Queues structural recommendations (content mergers) with detailed diagnostics.
- **D-06:** Data-Driven 301 Redirect Registry —
  - Manage consolidations through `content/redirects.json` (`[ { source, destination, permanent: true, reason, retiredAt } ]`).
  - `next.config.mjs` dynamically reads `content/redirects.json` and merges them into the native `redirects()` array.
  - Retired posts are physically relocated to `content/quarantine/{slug}.mdx` with redirect metadata, preventing duplicate builds while preserving clean commit history.

### Velocity Scaling Governor (GROW-03)
- **D-07:** Strict 4-Point Baseline Gate — Publishing frequency is barred from scaling to daily (7 posts/week) until all 4 conditions are met:
  1. **Domain Operating Age**: $\ge 60$ days elapsed since the first published article.
  2. **Indexation Health**: GSC indexed-vs-submitted ratio $\ge 70\%$.
  3. **Operational Stability**: Circuit breaker unpaused with 0 trips in the preceding 30 days.
  4. **Active Corpus Floor**: $\ge 10$ live articles actively indexed in Google.
- **D-08:** Runtime Velocity Governor — Implemented in `lib/pipeline/publish/governor.ts`:
  - Called at the start of each scheduled publish run.
  - When the gate is locked, daily cron triggers on non-scheduled days (Tue, Thu, Sat) exit cleanly with code 0 and log a graceful notice (`[governor] Velocity gate locked (<60d baseline): skipping non-scheduled daily publish`).
  - Once all 4 criteria pass, the governor automatically unlocks, allowing the scheduled cron to publish 7 days/week without manual config edits.

### Pillar Hub Auto-Promotion & Link Mesh (GROW-03)
- **D-09:** Silo Cluster Threshold & Dual Promotion —
  - When any silo accumulates $\ge 8$ published articles (up to 12):
    1. The existing silo landing page (`app/[silo]/page.tsx`) automatically enhances into a comprehensive Pillar Hub featuring categorized thematic sub-sections, full spoke directories, and enhanced `CollectionPage` JSON-LD schema.
    2. An automated cornerstone pillar post (e.g. `/blog/{silo}-complete-guide`) is queued and drafted by the pipeline to serve as the long-form anchor.
- **D-10:** Automated Bidirectional Link Mesh —
  - The pillar page links out explicitly to every published spoke within its cluster.
  - Each of the 8–12 spoke posts automatically updates its related-posts frontmatter and contextual cross-links to point up to the Pillar Hub, eliminating orphan risks and establishing airtight topical authority.

### Agent's Discretion
- UI layout and Tailwind styling for `/dashboard` (dark/light contrast, responsive tables, cards).
- Internal format of `content/analytics/snapshot.json` and `content/redirects.json`.
- Exact heuristics for FAQ injection into existing MDX frontmatter during refresh.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Roadmap
- `.planning/PROJECT.md` — Core value, Tier-1 focus (US/UK/CA/AU), zero human gate directive.
- `.planning/REQUIREMENTS.md` § Observe + Compound (GROW-01, GROW-02, GROW-03) — Country dashboard, refresh queue, 301 consolidation, velocity scale, pillar hubs.
- `.planning/ROADMAP.md` § Phase 6: Observe, Refresh + Compound — Success criteria and dependencies.

### Architecture & Prior Phase Modules
- `lib/pipeline/indexing/google-search-console.ts` — GSC client and authentication patterns.
- `lib/pipeline/publish/claim-lock.ts` & `lib/pipeline/publish/dlq.ts` — Publishing state and concurrency controls.
- `lib/pipeline/qa/circuit-breaker.ts` — Circuit breaker state checking (`pipeline-state.json`).
- `lib/silos.ts` — Silo taxonomy and routing definitions.
- `app/[silo]/page.tsx` — Silo landing page architecture.
- `next.config.mjs` — Next.js redirects and rewrites configuration.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/pipeline/indexing/google-search-console.ts`: Established `google.auth.GoogleAuth` integration with service account authentication.
- `lib/pipeline/qa/quarantine.ts`: `quarantineDraft` for safely retiring consolidated/redirected posts.
- `lib/pipeline/draft-schema.ts`: Frontmatter parser and Zod schema for updating `dateModified` and injecting FAQs.
- `lib/silos.ts`: `SILO_CONFIGS`, `SiloSlug`, `siloUrl`.

### Established Patterns
- **Graceful Offline Degradation**: All external API integrations must fail-soft when credentials are absent, providing synthetic or cached data.
- **Zero-Dep Server Components**: Fast rendering without heavy client-side JavaScript bundles.
- **Data-Driven File Storage**: State persisted cleanly in `content/keywords/` or `content/analytics/` as formatted JSON.

### Integration Points
- **Route Handler**: `app/dashboard/page.tsx` for owner analytics.
- **Scheduled Publisher**: `scripts/publish-scheduled.ts` integrating the velocity governor before candidate dispatch.
- **Configuration**: `next.config.mjs` importing `content/redirects.json`.
- **CLI Commands**: Scripts for manual refresh triggers and dashboard reporting.

</code_context>

<specifics>
## Specific Ideas

- **Dashboard UI**: Minimalist Server Component dashboard with Tailwind cards:
  - Card 1: Tier-1 Traffic Share (`US: 58%, UK: 22%, CA: 11%, AU: 6%, Other: 3%`).
  - Card 2: Indexed vs Submitted Ratio (`85%` — Green status).
  - Card 3: Publishing Velocity Governor Status (`Throttled 4x/wk — 38 days until 60d evaluation`).
  - Card 4: Refresh Queue (`3 striking-distance items, 1 decaying item`).
- **301 Redirect Storage**: `content/redirects.json` structured as:
  ```json
  [
    {
      "source": "/blog/old-cannibalized-post",
      "destination": "/blog/pillar-comprehensive-guide",
      "permanent": true
    }
  ]
  ```

</specifics>

<deferred>
## Deferred Ideas

- v2 Localization: Substantively localized regional pricing/variants (en-GB, en-CA, en-AU) (Requirement `LOCL-01`).
- v2 Monetization: Affiliate block activation and display ad slots (`MON-01`, `MON-02`).

</deferred>
