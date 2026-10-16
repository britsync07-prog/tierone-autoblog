---
phase: 01
slug: site-foundation-trust
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-10-16
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 1 is a greenfield static scaffold: no unit-testable business logic exists yet.
> Validation is build-gate + content-assertion + Lighthouse based (Wave 0 installs nothing).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | next build + tsc --noEmit + Lighthouse CI (no unit framework in v1 scaffold) |
| **Config file** | `lighthouserc.cjs` (created in Plan 01) |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npx lhci autorun` |
| **Estimated runtime** | ~120–240 seconds (build-dominated) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run full suite (`build` + `lhci autorun` against preview)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 300 seconds

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SITE-01 | T-01-03 | no secrets in repo; Plausible only third-party | static | `npm run build` exits 0 | no W0 | pending |
| 01-01-02 | 01 | 1 | SITE-01, GEO-02 | T-01-01 | security headers present; HTTPS/HSTS posture | static | `grep -v '^#' next.config.* \| grep -c "headers"` + `npm run build` | no W0 | pending |
| 01-02-01 | 02 | 2 | SITE-02 | T-02-01 | JSON-LD sanitized (`\u003c` escape), no raw HTML injection | static | `npm run build` + `grep -c "u003c\|replace(/</g" app/blog/[slug]/page.tsx` | no W0 | pending |
| 01-02-02 | 02 | 2 | SITE-02, SITE-04 | T-02-02 | OG title text escaped before draw | static | `npm run build` + `grep -c "opengraph-image" app -r` | no W0 | pending |
| 01-03-01 | 03 | 2 | SITE-03 | T-03-01 | no fabricated identity; mailto only, no form endpoint | static | `grep -c "linkedin.com/in/musfiqur-rahman-saimon" app/authors/*` | no W0 | pending |
| 01-03-02 | 03 | 2 | SITE-03 | T-03-02 | privacy/terms carry deferral note; no tracking claims | static | `npm run build` + `grep -c "counsel" app/privacy/page.tsx app/terms/page.tsx` | no W0 | pending |
| 01-04-01 | 04 | 3 | SITE-02 | N/A | seed content has no scraped text (original writing) | static | `npm run build` + frontmatter length greps | no W0 | pending |
| 01-04-02 | 04 | 3 | SITE-01, SITE-04, GEO-02 | T-04-01 | cache rules bypass HTML; Googlebot not blocked | e2e-manual | `npx lhci autorun` + Googlebot-UA curl checks | no W0 | pending |

*Status: pending → green / red / flaky*

---

## Wave 0 Requirements

- [x] No Wave 0 needed — "Existing infrastructure covers all phase requirements" (build + LHCI + grep assertions; no unit-testable logic in scaffold phase).

*If none: "Existing infrastructure covers all phase requirements."* — Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editorial-light visual feel | SITE-02 (D-03) | Aesthetic judgment | Open `/blog/{seed}` on desktop+mobile; confirm white bg, dark text, single accent, no dark mode |
| OG unfurl card | SITE-04 | External renderer | Paste post URL into opengraph.xyz + Twitter card validator; confirm title + image |
| Googlebot serve behavior | GEO-02 | Requires UA spoof from outside | `curl -A "Googlebot/2.1" https://exclusivesources.online/blog/{slug} -sI`; expect 200, no `x-robots-tag: noindex` |

---

## Regression Risks

- Template edits after seeds land can silently break frontmatter conformance → `npm run build` after every template change (Content Collections schema fails the build on violation).
- Cloudflare cache-rule edits can stale HTML → re-run Googlebot-UA curl after any CDN change.
- Adding any third-party script regresses LCP/INP → LHCI gate must stay green; Plausible stays the only script.

---

## Sign-off

- [ ] Quick command green after every task commit
- [ ] Full suite green after Wave 3
- [ ] Manual-only rows checked before verify-work
- [ ] Set `nyquist_compliant: true` above when all green

---
*Generated from 01-RESEARCH.md §11 during plan-phase (inline — Nyquist validation enabled, research present).*
