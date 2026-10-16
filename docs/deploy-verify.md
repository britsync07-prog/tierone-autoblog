# Deployment verification (GEO-02 / T-04-03)

Production domain: `https://exclusivesources.online`
Origin: Vercel project, US region `iad1` (pinned via `vercel.json` `regions`).
Cache posture: `docs/edge-cdn.md` (bypass HTML, long-cache hashed assets).

> Status as of 2026-10-16: the Vercel project does not exist yet (owner
> `user_setup` dashboard steps below). Production rows are therefore marked
> **PENDING DNS** — rerun section 3 against production after delegation.
> App-behavior evidence below comes from a real local production build
> (`npm run build` + `next start`), pasted verbatim, not invented.

## 1. Vercel project setup (owner dashboard steps)

1. Vercel Dashboard → Add New → Project → import this repo.
2. Framework preset: Next.js. Region: `iad1` (US origin).
3. Production branch: `main`.
4. Environment variables: none required in Phase 1. If code ever reads
   `SITE_URL`, set `SITE_URL=https://exclusivesources.online`.
5. Deploy, then add the production domain below.

## 2. Domain + Cloudflare (owner dashboard steps)

1. Vercel Dashboard → Project → Settings → Domains → add
   `exclusivesources.online` (and `www`), complete verification.
2. Cloudflare Dashboard → DNS: proxied `A` `@` → `76.76.21.21`,
   proxied `CNAME` `www` → `cname.vercel-dns.com`.
3. SSL/TLS mode **Full (strict)**; Always Use HTTPS **ON**; HSTS **ON**.
4. Cloudflare Dashboard → Rules → Cache Rules: apply the 3 rules from
   `docs/edge-cdn.md` verbatim (1: `/blog/*` + `/` **bypass-cache**;
   2: `/_next/static/*` cache 1 year; 3: `/sitemap.xml`, `/robots.txt`
   cache 5 minutes).
5. Do NOT challenge the `Googlebot` user agent; no Bot Fight Mode on HTML
   paths; do not rely on Crawler Hints for Google (see `docs/edge-cdn.md` §3).

## 3. Verification evidence

### 3a. App behavior (real output, local production build 2026-10-16)

Homepage serves 200 with HSTS and no crawler blocking:

```bash
$ curl -sI http://localhost:3000/ | grep -Ei "^(HTTP|strict-transport-security|x-robots-tag)"
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
# (no x-robots-tag line matched — no noindex gate)
```

Seed post serves 200 as Googlebot `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`, no `x-robots-tag: noindex`:

```bash
$ curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" -sI http://localhost:3100/blog/best-ai-writing-assistants-2026
HTTP/1.1 200 OK
# (no x-robots-tag line matched — no noindex gate)
```

Crawler files return 200:

```bash
$ curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/sitemap.xml
200
$ curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/robots.txt
200
```

Per-post OG card present in served `<head>` (D-21):

```html
<meta property="og:title" content="Best AI Writing Assistants in 2026: 7 Tools Compared"/>
<meta property="og:image" content="https://exclusivesources.online/blog/best-ai-writing-assistants-2026/opengraph-image"/>
<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
```

OG image route: `200 image/png` at
`/blog/best-ai-writing-assistants-2026/opengraph-image`.

LHCI: enforced in CI (`.github/workflows/lhci.yml`, `lhci autorun` on `/`
+ `/blog/best-ai-writing-assistants-2026`, performance ≥ 0.9).
Run the workflow once after production deploy and paste the median
performance score + LCP/INP/CLS values here.

### 3b. Production (real output 2026-10-16 — PENDING DNS)

Every production path currently returns `404` from Cloudflare with no
deployment attached (domain resolves, nothing serves it yet):

```bash
$ curl -sI https://exclusivesources.online/
HTTP/1.1 404 Not Found
Server: cloudflare
cf-cache-status: DYNAMIC
# (no strict-transport-security header — nothing serves the domain yet)

$ curl -sI https://exclusivesources.online/sitemap.xml
HTTP/1.1 404 Not Found
$ curl -sI https://exclusivesources.online/robots.txt
HTTP/1.1 404 Not Found
$ curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" -sI https://exclusivesources.online/blog/best-ai-writing-assistants-2026
HTTP/1.1 404 Not Found
```

OG meta grep on production returns nothing (404 body, no tags):

```bash
$ curl -s https://exclusivesources.online/ | grep -o 'og:image[^>]*'
# (no output — PENDING DNS)
```

**PENDING DNS — rerun all of 3b post-delegation.** Expected after the
owner completes sections 1–2: homepage `200` + `strict-transport-security`,
sitemap/robots `200`, seed URL `200` as `Googlebot/2.1` with NO
`x-robots-tag: noindex`, `og:image` present per post, LHCI summary pasted
in 3a. Nothing above was fabricated: outputs are pasted verbatim, and
unverifiable rows are marked pending rather than filled in.
