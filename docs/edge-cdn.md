# Edge + CDN posture (D-04 / T-01-01)

Production domain: `https://exclusivesources.online`
Origin: Vercel project, US region **`iad1`** (pinned via `vercel.json` `regions`).
HTTPS everywhere: HSTS via `next.config.mjs` headers
(`max-age=63072000; includeSubDomains; preload`) plus Cloudflare
"Always Use HTTPS" below. No actual DNS changes happen in this task
(no credentials available) — apply the steps below post-deploy;
live verification happens in Plan 04.

## 1. DNS (Cloudflare front → Vercel origin)

1. In Cloudflare DNS, point the apex/root to Vercel:
   proxied `A` record `@` → `76.76.21.21`, **proxied (orange cloud) ON**.
2. Point `www` to Vercel: proxied `CNAME` `www` → `cname.vercel-dns.com`.
3. SSL/TLS mode: **Full (strict)**. "Always Use HTTPS" **ON**. HSTS **ON**.
4. Add the domain as a Vercel project custom domain and complete Vercel's
   verification (Vercel issues and renews the edge certificate).

## 2. Cache Rules (priority order — first match wins)

| Priority | Rule | Setting |
|----------|------|---------|
| 1 | URI path starts with `/blog/` **or** equals `/` (article + homepage HTML) | **bypass-cache** (HTML freshness on publish) |
| 2 | URI path starts with `/_next/static/` (hashed static assets) | **cache-eligible**, edge TTL 1 year, browser TTL 1 year |
| 3 | URI path equals `/sitemap.xml` **or** `/robots.txt` | **cache-eligible**, edge TTL 5 minutes |

Rationale: per-post deploys must be visible immediately (rule 1), while
content-hashed JS/CSS/fonts cache for a year with zero staleness risk
(rule 2). Crawler files stay nearly fresh without hammering origin (rule 3).

## 3. WAF / transforms — crawler safety (do NOT do these)

- No firewall rule blocking or challenging the `Googlebot` user agent.
- No Bot Fight Mode / JS-challenge on HTML paths (`/`, `/blog/*`) —
  a challenge breaks crawler rendering and tanks indexability.
- Do NOT rely on Cloudflare "Crawler Hints" as a substitute for real
  submission: Google does not consume IndexNow. Indexing runs on the
  separate Google track (sitemap + Search Console API) in Phase 5.

## 4. Verification commands (run post-deploy)

```bash
URL="https://exclusivesources.online"

# Homepage serves 200 with no noindex gate, including as Googlebot.
curl -A "Googlebot/2.1" -sI "$URL" | grep -Ei "^(HTTP|cache-status|age|x-robots-tag)"
curl -A "Googlebot/2.1" -sI "$URL" | grep -i "x-robots-tag: noindex" && echo "FAIL: noindex present" || echo "OK: no noindex"

# Hashed static asset is an edge HIT.
ASSET=$(curl -s "$URL" | grep -oE '/_next/static/[^"]+' | head -1)
curl -sI "$URL$ASSET" | grep -Ei "^(HTTP|cache-status|age|cache-control)"

# Crawler files return 200.
curl -sI "$URL/sitemap.xml" | head -1
curl -sI "$URL/robots.txt" | head -1
```

Expected: homepage `200` and no `x-robots-tag: noindex`; static asset
`HIT` (after warm); sitemap + robots `200`.
