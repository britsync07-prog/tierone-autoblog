---
phase: 02-seo-architecture-silo-ia
reviewed: 2026-10-17T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - .github/workflows/lhci.yml
  - app/blog/[slug]/page.tsx
  - app/[silo]/page.tsx
  - app/page.tsx
  - app/robots.ts
  - app/sitemap.ts
  - components/related-posts.tsx
  - content-collections.ts
  - lib/seo/canonical.ts
  - lib/seo/jsonld.ts
  - lib/silos.ts
  - package.json
  - scripts/check-crawl.mjs
findings:
  critical: 0
  warning: 9
  info: 10
  total: 19
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The SEO architecture phase deliverables (silo taxonomy, silo landings, breadcrumb/JSON-LD, sharded sitemap, robots policy, crawl-consistency gate, LHCI workflow) are architecturally coherent and single-source discipline is genuinely enforced in most places. Cross-file verification against the installed Next 16 confirmed the load-bearing assumptions: `lastModified` strings pass through unchanged (`node_modules/next/dist/build/webpack/loaders/metadata/resolve-route-data.js:152-154` — so `check-crawl`'s strict `lastmod === updatedAt` comparison is valid), and `generateSitemaps()` shards serve at `/sitemap/[id]` as robots.ts declares.

No BLOCKERs: no injection vectors (COPY_SCRIPT is a constant, JSON-LD strings are sanitized before serialization, the silo route is allowlist-based, frontmatter is build-time-validated), no broken primary paths, no secrets in reviewed files. However, 9 warnings were found: two classes of timestamp-handling nondeterminism (string `localeCompare` sorting of ISO dates and host-timezone-dependent `formatDate` rendering in static output), a redundancy between `generateSitemaps()` and `robots.ts` that will silently lose sitemap discovery on a future shard addition, a latent body-truncation edge case in the word-count/TOC pipeline, a silent fall-through in sitemap shard dispatch, a self-inconsistency where silo landings render a visible breadcrumb but emit no BreadcrumbList JSON-LD (contradicting jsonld.ts's own charter), a stuck-state bug in the copy-button script, a brittle source-scraping step in the CI gate, and an unpinned global tool install in LHCI.

## Warnings

### WR-01: Newest-first sorting compares ISO timestamps as locale-aware strings — ordering depends on representation, not time

**File:** `app/page.tsx:24-26`, `app/[silo]/page.tsx:57`, `components/related-posts.tsx:27`, `app/sitemap.ts:62`, `app/sitemap.ts:40`
**Issue:** Five ordering sites use `b.publishedAt.localeCompare(a.publishedAt)` (or `post.updatedAt > max` for lastmod in `siloLastModified`). The zod schema accepts both `2026-01-15T00:00:00Z` and `2026-01-15T00:00:00.000Z` (fractional seconds are optional in `z.string().datetime()`), so mixed representations across posts produce inverted order: `"...00.500Z"` sorts *before* `"...00Z"` lexicographically, even though it is later in time. Additionally `localeCompare` is locale/ICU-dependent, making order subtly build-machine-dependent. This affects homepage, silo landings, related-posts, and sitemap entry order. Current seeds all use the same format, so the bug is latent — but pipeline-written frontmatter from Phase 3 makes heterogeneous formats likely.
**Fix:** Compare epochs everywhere:
```ts
const byNewest = (a: Post, b: Post) =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
```
Apply to all three `localeCompare` sites and to `siloLastModified` (`new Date(post.updatedAt) > new Date(max)`).

### WR-02: `formatDate()` renders in build-host timezone — nondeterministic static HTML

**File:** `app/page.tsx:6-12`, `app/[silo]/page.tsx:36-42`
**Issue:** Both `formatDate` copies call `toLocaleDateString('en-US', ...)` without `timeZone`. Posts are stamped at UTC midnight (`2026-10-16T00:00:00.000Z`), so on a negative-offset host (or any non-UTC build machine) the rendered date flips a day ("October 15" vs "October 16") — deterministic-build invariant broken. The project already solved this once: `components/byline.tsx:8` pins `timeZone: 'UTC'`. These two routes additionally duplicate the formatDate function (third copy in the repo) with divergent behavior.
**Fix:** Use a single shared util with `timeZone: 'UTC'` (i.e., lift `byline.tsx`'s `formatDate`), e.g. `lib/format.ts`, imported by both routes — removes both the nondeterminism and the duplication.

### WR-03: robots.ts duplicates the shard list from `generateSitemaps()` — silent sitemap-discovery loss on future shard addition

**File:** `app/robots.ts:19`
**Issue:** `sitemap: [`${SITE_URL}/sitemap/0.xml`, `${SITE_URL}/sitemap/1.xml`]` hardcodes the shard ids that `app/sitemap.ts:25-27` (`generateSitemaps`) owns. Adding shard 2 later updates `generateSitemaps` but robots.ts keeps declaring only two — sitemap-2 URLs become unreachable for discovery, and nothing fails: `check-crawl` groups 1 and 5 also hardcode exactly `0`+`1`, so the mismatch passes CI. This is the same class of drift the phase's own "single-source rule" exists to prevent inside the phase's own flagship files.
**Fix:** Derive the sitemap list from the tile of truth, e.g. export `SITEMAP_SHARDS` from `app/sitemap.ts` (or a tiny `lib/seo/sitemap-config.ts`) and map it in robots.ts; make `check-crawl` compare robots `Sitemap:` lines against the parsed `generateSitemaps` ids instead of hardcoded literals.

### WR-04: Frontmatter-strip regex can silently truncate the post body for TOC and reading-time computation

**File:** `content-collections.ts:69`
**Issue:** `const body = document.content.replace(/^---[\s\S]*?---/, '')` re-strips frontmatter that the content-collections parser has already removed (the file's own comment says so). Because the pattern is unanchored to a line structure, a body that legitimately *begins* with a thematic break `---` (e.g., a horizontal rule before the TL;DR) gets a non-greedy match spanning to the **next** `---` in the file — silently deleting that real chunk from `extractHeadings` (TOC entries vanish) and shrinking `readingMinutes`. No failure signal is emitted; the QA gate (`check-seeds`) validates frontmatter fields, not computed heading coverage.
**Fix:** Remove the strip (trust the parser's `content`), or make it shape-exact so a bare thematic break cannot match:
```ts
const body = document.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
```

### WR-05: Sitemap shard dispatch silently falls through on unparsable `id`

**File:** `app/sitemap.ts:57-59`
**Issue:** Only `shard === 0` is guarded; everything after is unconditional. If Next ever passes `id` in an unexpected shape (`undefined`, non-numeric), `Number(await id)` is `NaN`, the posts branch is skipped, and the *pages* content is served at `/sitemap/0.xml` too — shard 0 contains the wrong URL set and nothing fails (the crawl suite only runs when `0`/`1` are correct). Fails silent instead of loud, contradicting the file's own comment about the previous silent-shard bug ("A sync `id === 0` check never matches").
**Fix:** Fail loudly on anything unexpected:
```ts
if (shard === 0) { ...posts... }
if (shard === 1) { ...pages... }
throw new Error(`Unknown sitemap shard id: ${shard}`);
```

### WR-06: Silo landing renders a visible breadcrumb but emits no BreadcrumbList JSON-LD

**File:** `app/[silo]/page.tsx:61-73`
**Issue:** The landing nav renders `Home / {label}` visually, but unlike post pages (`app/blog/[slug]/page.tsx:181-187`, where the JSON-LD mirrors the visible trail), no `BreadcrumbJsonLd` is emitted. This violates lib/seo/jsonld.ts's own charter ("Every post/landing route MUST import these builders — never hand-roll structured data" / schema-mirror rule) and loses breadcrumb rich-result eligibility on the highest-priority pages of the silo architecture (landings carry `priority: 0.9` in the sitemap).
**Fix:**
```tsx
import { BreadcrumbJsonLd } from 'next-seo';
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';
import { SITE_URL } from '@/lib/site';
// inside the page return:
<BreadcrumbJsonLd {...buildBreadcrumbJsonLd([
  { name: 'Home', item: SITE_URL },
  { name: def.label, item: canonical },
])} />
```

### WR-07: Copy button gets permanently stuck on "Copied" if re-clicked within 1.5 s

**File:** `app/blog/[slug]/page.tsx:130`
**Issue:** `COPY_SCRIPT` captures `var label=b.textContent` at click time and restores it after 1500 ms. A second click inside that window (impatient double-click) captures the label as the literal string `"Copied"` — after the timer fires the button shows "Copied" indefinitely for the rest of the page visit. The `b.textContent = 'Copied'` write is also not guarded, so the copy still works but the label is corrupted.
**Fix:** Store the label once outside the closure and guard re-entry:
```js
b.dataset.label = b.dataset.label || b.textContent;
if (b.dataset.copying) return;
b.dataset.copying = '1';
... setTimeout(function(){ b.textContent = b.dataset.label; delete b.dataset.copying; }, 1500);
```

### WR-08: CI gate scrapes SILO_SLUGS by whole-file regex with an implicit `ai-` prefix filter

**File:** `scripts/check-crawl.mjs:54-57`
**Issue:** `SILO_SLUGS` is derived with `matchAll(/^\s*'([a-z0-9-]+)',?\s*$/gm)` then filtered to `.startsWith('ai-')`. Two failure modes: (a) any future standalone quoted line starting `ai-` — including inside a comment, or a renamed slug fixture — injects a phantom silo and fails parity with a misleading message ("post silos != SILO_SLUGS"); (b) any future silo slug not named `ai-*` is silently excluded from the scraped set, so the parity check compares the wrong sets and reports a false mismatch while the real breakage is the scrape. Both are loud failures (acceptable) but misdirecting, and the `ai-` hardcode violates the phase's declared "ground truth from source (single-source rule: never hardcode)" header.
**Fix:** Restrict the scrape to the `SILO_SLUGS = [...]` initializer block (e.g. match `SILO_SLUGS = \[([^\]]*)\]` then extract quoted tokens), drop the `ai-` prefix filter, and fail with "cannot parse SILO_SLUGS from lib/silos.ts" if the block is absent.

### WR-09: LHCI job installs an unpinned global `@lhci/cli`

**File:** `.github/workflows/lhci.yml:36`
**Issue:** `npm install -g @lhci/cli` fetches the **latest published version** every run, while devDependencies already pin `@lhci/cli ^0.15.1` (`package.json:36`). A future LHCI major can change its config/assertion schema and break this workflow's red/green signal nondeterministically (may pass pin-compatibly one day, fail the next with no code change).
**Fix:** Use the locked dependency instead of a global install: `npx lhci autorun` (drop line 36), or pin the global: `npm install -g @lhci/cli@0.15.1`.

## Info

### IN-01: FAQ items keyed by question text — duplicate keys possible

**File:** `app/blog/[slug]/page.tsx:112`
**Issue:** `key={item.q}` — the zod schema requires `q.length >= 1` but not uniqueness, so two identical questions produce duplicate React keys (reconciliation warning, hydration risk) and duplicate questions in the FAQPage schema.
**Fix:** `key={`${i}-${item.q}`}` (and optionally a schema ref `.refine` enforcing unique questions if duplicates are editorially invalid).

### IN-02: Breadcrumb links use raw `<a>` while sibling code uses `<Link>`

**File:** `app/blog/[slug]/page.tsx:85, 91`
**Issue:** `Breadcrumb` renders internal links (`/`, silo href) as plain anchors while the silo landing and related-posts use `next/link`. No SEO impact, but inconsistent prefetch-client-nav behavior on the same template.
**Fix:** Import `Link` and use it for both crumb links.

### IN-03: `@vercel/og` declared but unused

**File:** `package.json:21`
**Issue:** Both OG image routes import `ImageResponse` from `next/og` (native, recommended for Next); nothing imports `@vercel/og`. Dead production dependency — extra install weight and supply-chain surface.
**Fix:** Remove `"@vercel/og"` from dependencies.

### IN-04: Review dates duplicated as two unrelated magic constants

**File:** `app/sitemap.ts:9, 75`
**Issue:** `REVIEW_DATE = '2026-10-16'` and the homepage-lastmod floor `'2026-10-16T00:00:00.000Z'` encode the same day in two different representations with no linkage. On the next review bump, updating one and not the other yields inconsistent-looking lastmods.
**Fix:** Derive the floor once: `const FLOOR = new Date(`${REVIEW_DATE}T00:00:00Z`).toISOString()` and use it in the reduce init.

### IN-05: h2 render logic duplicated between `mdx-components.tsx` and the post template

**File:** `app/blog/[slug]/page.tsx:137-148` (vs `mdx-components.tsx:15-19`)
**Issue:** `ArticleBody` re-declares the same `h2` → `<h2 id={id} className="group scroll-mt-24">` mapping as the global `useMDXComponents` base map just to count H2s. If the base map gains styling/behavior later, the post-page override silently diverges (drift the D-08 single-source rule should prevent).
**Fix:** Compose instead of duplicate: `const base = useMDXComponents(); const BaseH2 = base.h2;` then render `<BaseH2 id={id}>{children}</BaseH2>` inside the counting wrapper (or factor a heading factory).

### IN-06: `extractHeadings` is an approximation of rehype-slug

**File:** `content-collections.ts:87-112`
**Issue:** Mirroring holds only for plain-text markdown headings: rehype-slug slugs post-MDX text, while extraction operates on source and strips only `[*_~\`]` and link syntax. Headings containing JSX inline nodes, or HTML entities like `&amp;`, will slug differently, and 1+ leading spaces (`/^#{1,6}/` is untrimmed) skip headings CommonMark would render. Outcome: TOC anchor scrolls to nowhere, silently. Current seeds avoid all cases.
**Fix:** At minimum assert parity in CI: render each heading through the same pipeline in a seed check (compile the MDX and extract `h2/h3[id]` from the hast), fail on mismatch. Longer term, extract headings from the compiled hast in the transform instead of regexing source.

### IN-07: CI rebuilds the site three times per run

**File:** `.github/workflows/lhci.yml:12-49`
**Issue:** The `build`, `lhci`, and `crawl` jobs each run `npm ci && npm run build` with no artifact sharing and no `concurrency` group. Same-commit builds cannot diverge (correctness holds), but the duplicated minutes multiply CI cost and cancel/uncancelled runs can thrash on rapid pushes.
**Fix:** Build once (upload `.next` artifact, restore in lhci/crawl jobs) and add `concurrency: { group: lhci-${{ github.ref }}, cancel-in-progress: true }`.

### IN-08: `@types/node ^20` vs engines `node >= 22`

**File:** `package.json:6, 38`
**Issue:** Type definitions target Node 20 while the declared engine floor is Node 22 — newer APIs typed as errors/unresolved. Doesn't block current code.
**Fix:** Align to `"@types/node": "^22"`.

### IN-09: `npm run lint` exists but is not run in CI

**File:** `.github/workflows/lhci.yml:12-49` (and `package.json:12`)
**Issue:** The phase gates performance (LHCI) and crawl consistency in CI, but the eslint gate (`eslint-config-next` installed) runs nowhere — dead script + unsurfaced lint defects.
**Fix:** Add `- run: npm run lint` to the shared `build` job (post-`npm ci`).

### IN-10: `introExcerpt` first-sentence heuristic is fragile to mid-sentence periods

**File:** `app/page.tsx:16-19`
**Issue:** Splits on the first `". "` (period+space). "e.g. " / "U.S. " styles would truncate mid-sentence in the silo cards. Today's five silo intros are safe only by authoring luck ("Copy.ai " has no space after the dot).
**Fix:** Acceptable for curated content leveraged as-is, but consider an explicit `excerpt` field in `Silo` when the next copy pass happens — one more single-source string, zero heuristic risk.

---

_Reviewed: 2026-10-17T00:00:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: standard_
