# Phase 3 Deferred Items

Out-of-scope findings logged during execution per executor scope-boundary rules
(pre-existing issues unrelated to the current task's changes — never auto-fixed).

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| deps-audit | npm audit: `basic-ftp <=6.2.0` (high, quadratic-time CPU DoS in Unix LIST parser) reaches the tree transitively via `@lhci/cli` → `get-uri` → `proxy-agent` chain; installed in Phase 1, surfaced by the task-3 `npm install` of new pipeline deps. Fix known to npm is a breaking downgrade of @lhci/cli to 0.6.x — not acceptable here. | Open — revisited when Lighthouse CI (`@lhci/cli`) is next upgraded or Phase 6 optimization work touches CI tooling | 03-01 (2026-10-17) |
