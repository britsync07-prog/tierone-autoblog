# Phase 3 Deferred Items

## From 03-04 execution (2026-10-17)

**Pre-existing lint errors/warnings observed during `npm run lint` — NOT fixed (out of scope per executor boundary; none are from files this plan authored):**

| Item | File | Detail |
|------|------|--------|
| lint error | `app/blog/[slug]/page.tsx:86` | `@next/next/no-html-link-for-pages` — Breadcrumb `<a href="/">Home</a>` predates this plan (Phase 1/2 code, left untouched); harness rule suggests `next/link` |
| lint error | `lib/pipeline/stages/expand.ts:362` | `prefer-const`('shard') — 03-02 code |
| lint error | `lib/pipeline/stages/outline.ts:222` | `prefer-const`('rejected') — 03-03 code |
| lint warning | misc | 12 unused-var warnings across `lib/pipeline/*`, `test/pipeline/*` (03-01/03-02/03-03 leftovers) and 1 new noop from `.content-collections/generated` |

Note: these do not block `npm run build` (Next 16 does not run ESLint during build) or any `check:*` gate. Suggest a sweep in a later phase or a dedicated lint-cleanup quick task.
