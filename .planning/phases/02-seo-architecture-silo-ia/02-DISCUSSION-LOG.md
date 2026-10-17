# Phase 2: SEO Architecture + Silo IA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-17
**Phase:** 2-SEO Architecture + Silo IA
**Areas discussed:** Silo inventory + landings, Link graph rules

---

## Silo inventory

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 5 seed silos | Keep ai-writing, ai-coding, ai-image, ai-productivity, ai-guides — matches 5 seeds, 1 post each at start | ✓ |
| Consolidate to 4 | Merge guides into others + tighten to 4 broader hubs |  |
| Keep 5 + reserve future | Keep 5 now + reserve 3 slots for VPN/hosting/streaming expansion later |  |

**User's choice:** Keep 5 seed silos
**Notes:** Satisfies 4–8 landing requirement directly; no consolidation.

## Landing URL shape

| Option | Description | Selected |
|--------|-------------|----------|
| /{silo} at root | Matches ARCHITECTURE.md app/[silo] pattern, shortest URLs, no extra segment | ✓ |
| /topics/{silo} | Explicit namespace avoids collision with future pages; slightly longer |  |
| /blog/{silo} | Keeps everything under /blog but risks confusion between posts and landings |  |

**User's choice:** /{silo} at root
**Notes:** Flat /blog/{slug} posts untouched; one-way URL contract.

## Landing depth

| Option | Description | Selected |
|--------|-------------|----------|
| Curated intro + list | Unique intro prose + cluster list + link context; thin-safe | ✓ |
| Auto list only | Title + auto post cards only; fastest but thin-page risk |  |
| Full pillar stub | Full pillar prose + FAQ + comparison; heaviest |  |

**User's choice:** Curated intro + list
**Notes:** Avoids thin content without Phase 6 pillar weight.

## Homepage shape

| Option | Description | Selected |
|--------|-------------|----------|
| Add silo hubs section | Latest-posts stay + silo cards on top linking to 5 landings | ✓ |
| Keep as-is | No homepage change; silos via posts/breadcrumbs only |  |
| Silo-first redesign | Homepage becomes silo-first, latest secondary |  |

**User's choice:** Add silo hubs section
**Notes:** Minimal change + hub signal.

## Silo display names

| Option | Description | Selected |
|--------|-------------|----------|
| Agent defines labels | Slugs stay ai-writing style in URL, pretty labels in UI defined once in code | ✓ |
| I will specify names | User provides exact display names now |  |

**User's choice:** Agent defines labels
**Notes:** Agent discretion.

## Post breadcrumb

| Option | Description | Selected |
|--------|-------------|----------|
| Include silo crumb | Home / {Silo} / Title where Silo links to landing | ✓ |
| Keep Blog crumb | No change; hierarchy only in landings + link graph |  |

**User's choice:** Include silo crumb
**Notes:** Carries hierarchy signal in UI + schema; JSON-LD must mirror.

## Thin-start policy

| Option | Description | Selected |
|--------|-------------|----------|
| Ship all 5 now | Ship all 5 landings at 1 post each; they fill as pipeline publishes | ✓ |
| Gate by count | Hide landings with <3 posts until they fill |  |

**User's choice:** Ship all 5 now
**Notes:** No gating.

## Silo intro copy source

| Option | Description | Selected |
|--------|-------------|----------|
| Static in repo | Hand-written static definitions in repo, versioned, no pipeline dependency | ✓ |
| Registry-driven later | Pipeline-generated from keyword registry; placeholder copy in Phase 2 |  |

**User's choice:** Static in repo
**Notes:** Versioned, no pipeline dependency.

---

## Link graph rules

### Pillar up-link

| Option | Description | Selected |
|--------|-------------|----------|
| Crumb + Related only | Silo crumb + landing link in Related block covers it; no in-body injection | ✓ |
| In-body up-link | Explicit pillar link in first 2 paragraphs of every post body |  |

**User's choice:** Crumb + Related only

### Sibling policy

| Option | Description | Selected |
|--------|-------------|----------|
| Strict same-silo | Same-silo only in Related; cross-silo only via homepage hubs | ✓ |
| Allow 1 cross-silo | Allow 1 relevant cross-silo link when genuinely related |  |

**User's choice:** Strict same-silo

### RelatedPosts scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minor upgrade | Keep deterministic logic; add silo header link + empty-state link to silo | ✓ |
| Keep as-is | No Related changes; landings + crumbs only |  |

**User's choice:** Minor upgrade

### Orphan rule

| Option | Description | Selected |
|--------|-------------|----------|
| Landing counts | Landing list + homepage hubs + crumb count as in-links | ✓ |
| Strict post-to-post | Require 1+ post-to-post in-link even in 1-post silos |  |

**User's choice:** Landing counts

### Anchor text

| Option | Description | Selected |
|--------|-------------|----------|
| Title + silo name | Post titles for siblings, silo display name for pillar — no stuffing | ✓ |
| Keyword-rich pillar | Keyword-rich anchors for pillar + descriptive anchors for siblings |  |

**User's choice:** Title + silo name

### Link count cap

| Option | Description | Selected |
|--------|-------------|----------|
| Keep minimal | Up to 3 Related + crumb + landing list; no in-body links | ✓ |
| Up to 5 links | Allow up to 5 contextual links including in-body |  |

**User's choice:** Keep minimal

### Homepage hub targets

| Option | Description | Selected |
|--------|-------------|----------|
| Hubs to silos only | Homepage hubs link to 5 landings only; landings link to posts (two-hop) | ✓ |
| Hubs + latest posts | Homepage also lists latest posts directly |  |

**User's choice:** Hubs to silos only
**Notes:** Homepage retains existing latest-posts list below hubs — hubs section itself links silos-only.

### List ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Newest first | Newest first everywhere; deterministic, matches current logic | ✓ |
| Curated order | Curated order per silo defined in static file |  |

**User's choice:** Newest first

---

## the agent's Discretion

- Silo display labels + intro prose drafts (defined once, reused everywhere).
- Crawl surface + sitemaps (SEO-01/SEO-04): split shape, diff-gated lastmod, robots strictness, tag/archive/pagination policy, CI suite — planner/researcher discretion.
- Canonical + hreflang + schema builders (SEO-02/SEO-03/GEO-01/GEO-03): en-US + x-default self-ref, hreflang plumbing CI, lib/seo/ builders (next-seo v7 + schema-dts) — planner discretion.

## Deferred Ideas

None — discussion stayed within phase scope. Undiscussed Phase 2 scope (crawl surface, canonical/schema) remains in-phase as agent discretion, not deferred.
