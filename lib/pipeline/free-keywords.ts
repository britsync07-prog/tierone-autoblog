// In-house keyless keyword intelligence (PIPE-01) — built per the ⚠ OWNER
// FULLY-FREE DIRECTIVE of 2026-10-17 (03-CONTEXT.md): the platform must work
// fully free. NO third-party PAID APIs — ever. No DataForSEO, no paid LLM
// bills, no paid image APIs. Everything that needed paid metrics becomes
// free-signal proxies, and a missing signal is recorded honestly — it is
// NEVER fabricated (D-04 visible-trail policy).
//
// Sources (all keyless, zero signup, zero billing):
//   1. Anonymous Google autocomplete (suggestqueries.google.com, client=firefox
//      JSON) queried PER GEO via gl/hl params — the per-geo long-tail expansion
//      pool (D-07) and the "autocomplete rank" free-signal proxy gate.
//   2. Google Trends public explore endpoint (trends.google.com/trends/api/*
//      two-step widget handshake, today 3-m window) — the "trend interest"
//      free-signal proxy gate. Failures degrade to an honest absence note.
//   3. Anonymous free SERP HTML for the UNCHANGED D-05 anti-cannibalization
//      check + PAA question capture. ENGINE: Bing (www.bing.com), because on
//      2026-10-17 every anonymous keyless Google SERP fetch variant (fresh
//      browser UA, legacy mobile UA, gbv=1) returned only the JS-only shell
//      with ZERO organic markup (h3=0 verified) — Google free SERP HTML no
//      longer exists as a data source, per its own ⚠ directive rule "use an
//      alternative that is free". Bing's anonymous HTML serves plain organic
//      result blocks keylessly (verified same day). Same contract as before:
//      top-3 organic URLs + PAA as plain-text data (T-03-06: titles/questions
//      are stored as plain strings, never executed). PAA may be absent on
//      Bing-built SERPs — an empty capture is recorded honestly.
//
// Security boundaries carried over from the Plan 03-02 threat register:
//   T-03-02 analog: third-party public payloads are UNTRUSTED INPUT — JSON is
//   zod-validated into narrow shapes and any surprise FAILS CLOSED (returns a
//   recorded !ok outcome / throws with reason; never coerced into fake data).
//   T-03-05 analog: no credentials exist to leak (fully keyless); hosts are
//   compile-time constants — no dynamic host/target is ever built from input.
//   T-03-06: SERP titles/PAA are stored as plain text fields only.
//
// Request governance (T-03-04 spirit, ⚠ directive): EVERY source call appends
// a $0 / requests:N ledger op (spend-record-first, before results are
// processed) with the truthful count of HTTP attempts made — so the monthly
// request cap is auditable. Cached in-process repeat fetches consume 0
// requests and record NO ledger op (D-02 cache-everything applies to free
// sources: the git-committed registry shards remain the real cache —
// metricsFresh() is the 30-day freshness gate on entry.metricsAsOf, D-06).

import { z } from 'zod';
import { appendSpend, type SpendOpInput, type SpendOpService } from './budget';
import { GEO_CODES, type GeoCode, type SerpResult } from './types';

/** Per-geo Google locale params (D-07 per-geo capture). gl is the ISO 3166-1
 * country code the endpoints expect (GB is the UK's code); hl is the English
 * locale variant for each Tier-1 market (en-US/en-GB/en-CA/en-AU). */
export const GEO_LOCALES: Record<GeoCode, { gl: string; hl: string }> = {
  us: { gl: 'us', hl: 'en-US' },
  uk: { gl: 'gb', hl: 'en-GB' },
  ca: { gl: 'ca', hl: 'en-CA' },
  au: { gl: 'au', hl: 'en-AU' },
};

/** Compile-time host allowlist — no dynamic hosts from any input (T-03-05).
 * SERP engine is Bing (documented in the header block: Google's anonymous
 * SERP serves a JS-only shell with zero organic markup as of 2026-10-17). */
export const SUGGEST_HOST = 'suggestqueries.google.com';
export const TRENDS_HOST = 'trends.google.com';
export const SERP_HOST = 'www.bing.com';

/** Anonymous browser UA for keyless public fetches (no cookies, no auth). */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Politeness floor per host between attempts (ms, ⚠ directive: cache +
 * rate-limits respected). Applied per host, conservatively shared. */
const HOST_MIN_SPACING_MS: Record<string, number> = {
  [SUGGEST_HOST]: 400,
  [TRENDS_HOST]: 1_200,
  [SERP_HOST]: 1_800,
};

/** Thrown when a keyless source stays unavailable after polite retries
 * (persistently 403/429/timeout/5xx/network). reason is the honest cause; the
 * caller (stage) records it visibly and never fabricates data to fill in. */
export class SourceUnavailableError extends Error {
  readonly reason: string;
  readonly attempts: number;
  constructor(reason: string, attempts: number) {
    super(reason);
    this.name = 'SourceUnavailableError';
    this.reason = reason;
    this.attempts = attempts;
  }
}

/** Thrown when a source answered but the payload could not be parsed into a
 * trustworthy shape (T-03-02 fail-closed: never coerce unknown data). */
export class SourceParseError extends Error {
  readonly reason: string;
  readonly attempts: number;
  constructor(reason: string, attempts: number) {
    super(reason);
    this.name = 'SourceParseError';
    this.reason = reason;
    this.attempts = attempts;
  }
}

/** True when the free-source ledger op for this result must NOT be written
 * (in-process cache hit: zero HTTP requests actually happened). */
export function isCacheHit(attempts: number): boolean {
  return attempts <= 0;
}

export interface SuggestionBatch {
  ok: boolean;
  /** Honest failure cause when !ok (HTTP 429 upstream, malformed payload, …). */
  reason?: string;
  /** Long-tail suggestions in public rank order (index 0 = rank 1). */
  suggestions: string[];
  /** == suggestions.length when ok (topic expansion breadth signal); 0 else. */
  breadth: number;
}

/** One trend read for one keyword + geo. */
export interface TrendCapture {
  ok: boolean;
  /** Honest absence cause when !ok (source unavailable / unparseable). */
  reason?: string;
  /** Measured interest 0-100 (mean over the 3-month window) when ok. */
  interest: number;
  asOf: string;
}

export interface SerpCapture {
  ok: boolean;
  reason?: string;
  /** Top organic results (title/url/position parsed from SERP HTML). */
  top: SerpResult[];
  /** People-Also-Ask questions captured from the SERP region (may be empty). */
  paa: string[];
}

export interface FreeSources {
  topicSuggestions: (topic: string, geo: GeoCode, registryDir: string) => Promise<SuggestionBatch>;
  trendInterest: (keyword: string, geo: GeoCode, registryDir: string) => Promise<TrendCapture>;
  serpTop: (keyword: string, geo: GeoCode, registryDir: string) => Promise<SerpCapture>;
}

/** Suggest response (client=firefox JSON): [query, [suggestions…], …?] —
 * trailing metadata tolerated, count/shape validated (T-03-02 fail-closed). */
const SuggestSchema = z.tuple([z.string(), z.array(z.string())]).rest(z.unknown());

/** Trends explore response: widget list; only the TIMESERIES widget's
 * token/request/endpoint fields are read (narrow shape). */
const ExploreWidgetSchema = z.object({
  id: z.string(),
  token: z.string().optional(),
  request: z.unknown().optional(),
  endpoint: z.string().optional(),
});
const ExploreSchema = z.object({ widgets: z.array(ExploreWidgetSchema).min(1) });

// ---- text parsing helpers (HTML treated as untrusted data — T-03-06) -------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  rsquo: '\u2019',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
};

function decodeEntities(input: string): string {
  let out = input.replace(/&#(\d+);/g, (_, d: string) => {
    const n = Number.parseInt(d, 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
  out = out.replace(/&([A-Za-z#0-9]+);/g, (raw, name: string) => NAMED_ENTITIES[name] ?? raw);
  return out;
}

function stripTags(htmlInner: string): string {
  return htmlInner.replace(/<[^>]*>/g, ' ');
}

function innerText(htmlInner: string): string {
  return decodeEntities(stripTags(htmlInner)).replace(/\s+/g, ' ').trim();
}

/** LONG-ish URL decode for /url?q= redirect wrappers + %xx escapes. */
function decodeUrlish(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Unwrap a Bing click-tracking redirect /ck/a?...&u=a1<base64-url>&...
 * into the destination URL (u param carries an "a1" + base64url payload).
 * Returns null when the href is not a wrapped URL. */
function unwrapBingRedirect(href: string): string | null {
  try {
    const url = new URL(href, `https://${SERP_HOST}`);
    if (!/\/{1,3}ck\/a(?:\/|$)/.test(url.pathname) && url.pathname !== '/ck/a') return null;
    const u = url.searchParams.get('u');
    if (u && (u.startsWith('a1'))) {
      let decoded = '';
      try {
        decoded = Buffer.from(u.slice(2), 'base64url').toString('utf8');
      } catch {
        decoded = '';
      }
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export interface SerpParse {
  top: SerpResult[];
  paa: string[];
}

/** One organic candidate discovered in the parsed SERP HTML. */
interface SerpAnchor {
  idx: number;
  href: string;
  title: string;
}

/**
 * Parse anonymous free SERP HTML (Bing engine) deterministically into organic
 * results. Parsing is TEXT-ONLY and tolerant: `<script>`/`<style>` blocks are
 * stripped first so JS config strings never masquerade as visible markup;
 * every result title comes from inside a `b_algo` organic block's first
 * <h2><a href> anchor; Bing /ck/a click wrappers are unwrapped to the real
 * destination URL. PAA questions are read from the visible "People also ask"
 * region when the engine renders one (an empty capture is an honest outcome).
 * Any yield (even zero) is an observation the stage records verbatim —
 * nothing is invented.
 */
export function parseSerpHtml(rawHtml: string): SerpParse {
  // Strip script/style payloads BEFORE any matching (T-03-06 data-only).
  const html = rawHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

  // Organic blocks: Bing marks results with li.b_algo (ads/answers excluded).
  const blockStarts: number[] = [];
  for (const m of html.matchAll(/<li\b[^>]*\bclass="[^"]*\bb_algo\b[^"]*"[^>]*>/gi)) {
    if (m.index !== undefined) blockStarts.push(m.index);
  }
  const H2_A_RE =
    /<h2\b[^>]*>\s*<a\b[^>]*?\bhref="([^"]+)"[^>]*>([\s\S]{0,400}?)<\/a>\s*<\/h2>/i;
  const blockEnds = blockStarts.map((start, i) =>
    i + 1 < blockStarts.length ? blockStarts[i + 1] : Math.min(start + 100_000, html.length),
  );
  const anchors: SerpAnchor[] = [];
  for (let i = 0; i < blockStarts.length; i += 1) {
    const m = html.slice(blockStarts[i], blockEnds[i]).match(H2_A_RE);
    const title = innerText(m?.[2] ?? '');
    if (title && m?.[1] !== undefined) {
      anchors.push({ idx: blockStarts[i], href: m[1], title });
    }
  }

  const top: SerpResult[] = [];
  const seenUrls = new Set<string>();
  for (const a of anchors) {
    // hrefs arrive HTML-escaped (&amp;u=a1…) — unescape BEFORE unwrapping so
    // the click-tracking de-wrapper can read its real query params.
    let href = decodeEntities(a.href);
    const unwrapped = unwrapBingRedirect(href);
    if (unwrapped) href = unwrapped;
    href = decodeUrlish(href);
    let full = href;
    if (href.startsWith('/')) full = `https://${SERP_HOST}${href}`;
    if (!/^https?:\/\//i.test(full)) continue;
    let url: URL;
    try {
      url = new URL(full);
    } catch {
      continue;
    }
    // Skip the engine's own navigation/chrome links (never organic results).
    const bareHost = url.hostname.toLowerCase().replace(/^www\./, '');
    if (bareHost === SERP_HOST.replace(/^www\./, '')) {
      if (
        url.pathname.startsWith('/search') ||
        url.pathname.startsWith('/ck/') ||
        url.pathname.startsWith('/preferences') ||
        url.pathname === '/'
      ) {
        continue;
      }
    }
    const dedup = `${bareHost}${url.pathname}`;
    if (seenUrls.has(dedup)) continue;
    seenUrls.add(dedup);
    top.push({ url: url.toString(), title: a.title, position: top.length + 1 });
    if (top.length >= 3) break;
  }

  const paa: string[] = [];
  const paaIdx = html.search(/people also ask/i);
  if (paaIdx >= 0) {
    const win = html.slice(paaIdx, paaIdx + 30_000);
    for (const m of win.matchAll(/<h3\b[^>]*>([\s\S]{0,400}?)<\/h3>/gi)) {
      const text = innerText(m[1] ?? '');
      if (!text) continue;
      if (!paa.includes(text)) paa.push(text);
      if (paa.length >= 10) break;
    }
  }

  return { top, paa };
}

// ---- trends payload parsing -------------------------------------------------

function stripXssiGuard(text: string): string {
  const brace = text.indexOf('{');
  const bracket = text.indexOf('[');
  const cut =
    brace === -1 ? bracket : bracket === -1 ? brace : Math.min(brace, bracket);
  return cut === -1 ? text : text.slice(cut);
}

/** Parse a multiline CSV in the shape `Day,<keyword>[,isPartial?]\n<date>,<n>` —
 * value column 2 is Google's 0-100 interest; malformed lines are skipped
 * (a returned 'no values' is the honest outcome, never an invention). */
export function parseTrendCsv(text: string): number[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.startsWith('Day,'));
  if (headerIdx === -1) throw new Error('trends CSV has no "Day," header row');
  const values: number[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim()) continue;
    const cells = line.split(',');
    if (cells.length < 2) continue;
    const v = Number.parseInt(cells[1], 10);
    if (Number.isFinite(v) && v >= 0) values.push(Math.min(v, 100));
  }
  return values;
}

// ---- client -------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FreeSourcesDeps {
  /** Fetch seam for fixtures (defaults to globalThis.fetch). */
  fetchFn?: typeof fetch;
  /** Ledger-record seam (defaults to the real appendSpend — record-first). */
  spendFn?: (registryDir: string, op: SpendOpInput) => void;
  /** Backoff delays for the two polite retries on 5xx/403/429/network. */
  retryDelaysMs?: number[];
  /** Per-request timeout (default 20s). */
  timeoutMs?: number;
  /** Politeness floor per request beyond the host floor (test pacing). */
  extraDelayMs?: (kind: 'autocomplete' | 'trends' | 'serp', host: string) => number;
}

export interface HttpResult {
  text: string;
  attempts: number;
}

export function createFreeSources(deps: FreeSourcesDeps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const spendFn = deps.spendFn ?? appendSpend;
  const retryDelays = deps.retryDelaysMs ?? [4_000, 10_000];
  const timeoutMs = deps.timeoutMs ?? 20_000;

  /** In-process response cache keyed by canonical URL (D-02 cache-everything
   * applies to free sources — same URL is never re-fetched this process). */
  const cache = new Map<string, string>();
  const lastUse = new Map<string, number>();

  async function waitForHost(host: string, extraDelayMs: number): Promise<void> {
    const now = Date.now();
    const last = lastUse.get(host) ?? 0;
    const wait = last + (HOST_MIN_SPACING_MS[host] ?? 500) + extraDelayMs - now;
    if (wait > 0) await sleep(wait);
    lastUse.set(host, Date.now());
  }

  function assertBuiltUrl(url: URL): void {
    if (url.protocol !== 'https:') throw new Error(`refusing non-HTTPS source URL: ${pathOf(url)} on ${url.hostname}`);
    const stripped = url.hostname.replace(/^www\./, '');
    const allowed = [SUGGEST_HOST, TRENDS_HOST, SERP_HOST].map((h) => h.replace(/^www\./, ''));
    if (!allowed.includes(stripped)) {
      throw new Error(`refusing unexpected source host: ${url.hostname} (allowlist: ${allowed.join(', ')})`);
    }
  }

  /**
   * One anonymous keyless GET against a Google public endpoint.
   * - polite per-host pacing + in-process cache (D-02).
   * - 20s timeout via AbortController; cache hits consume 0 requests.
   * - polite retries (4s/10s) on 5xx / 403 / 429 / timeouts / network errors
   *   (⚠ directive: rerun politely a few times before giving up).
   * - other 4xx fail immediately (deterministic client-side shape).
   * Recorded requests = ACTUAL attempts made (retries included) — honest
   * cap accounting. Cached responses are returned with attempts cached=true.
   */
  async function httpGet(
    urlStr: string,
    kind: 'autocomplete' | 'trends' | 'serp',
    registryDir: string,
    service: SpendOpService,
    keywords: string[] | undefined,
    label: string,
  ): Promise<HttpResult> {
    const url = new URL(urlStr);
    assertBuiltUrl(url);
    const host = url.hostname;
    const cacheKey = urlStr;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return { text: cached, attempts: 0 };

    const headers: Record<string, string> = {
      'user-agent': USER_AGENT,
      'accept-language': 'en-US,en;q=0.9',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    let attempts = 0;
    let lastReason = 'unknown failure';
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      await waitForHost(host, deps.extraDelayMs?.(kind, host) ?? 0);
      attempts += 1;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchFn(new Request(url, { method: 'GET', headers, signal: ctrl.signal }));
        if (res.status >= 500 || res.status === 403 || res.status === 429) {
          lastReason = `HTTP ${res.status} upstream (blocked or throttled)`;
          if (attempt < retryDelays.length) {
            await sleep(retryDelays[attempt] ?? 0);
            continue;
          }
          throw new SourceUnavailableError(`${lastReason} after ${attempts} polite attempt(s)`, attempts);
        }
        if (res.status !== 200) {
          // Deterministic non-200 (e.g. 400): fail at once, no spam retries.
          throw new SourceUnavailableError(`HTTP ${res.status} from ${host}${pathOf(url)}`, attempts);
        }
        const text = await res.text();
        if (text.length === 0) {
          throw new SourceUnavailableError(`HTTP 200 with empty body from ${host}${pathOf(url)}`, attempts);
        }
        cache.set(cacheKey, text);
        return { text, attempts };
      } catch (err) {
        if (err instanceof SourceUnavailableError) throw err;
        if (err instanceof Error && err.name === 'AbortError') {
          lastReason = `request timed out after ${timeoutMs}ms`;
        } else if (err instanceof Error) {
          lastReason = err.message;
        } else {
          lastReason = String(err);
        }
        if (attempt < retryDelays.length) {
          await sleep(retryDelays[attempt] ?? 0);
          continue;
        }
        throw new SourceUnavailableError(`${lastReason} after ${attempts} polite attempt(s)`, attempts);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new SourceUnavailableError(`${lastReason} after ${attempts} polite attempt(s)`, attempts);
  }

  function pathOf(url: URL): string {
    return url.pathname;
  }

  function record(
    registryDir: string,
    service: SpendOpService,
    keywords: string[],
    attempts: number,
    note: string,
  ): void {
    if (attempts <= 0) return; // cache hit: no request, no ledger op
    spendFn(registryDir, { service, cost: 0, requests: attempts, keywords, note });
  }

  // ---- source 1: anonymous Google autocomplete (per geo) --------------------
  function suggestUrl(query: string, geo: GeoCode): string {
    const { gl, hl } = GEO_LOCALES[geo];
    const url = new URL(`https://${SUGGEST_HOST}/complete/search`);
    url.searchParams.set('client', 'firefox');
    url.searchParams.set('hl', hl);
    url.searchParams.set('gl', gl);
    url.searchParams.set('q', query);
    return url.toString();
  }

  /** ZERO-COST long-tail pool for one topic in ONE geo (D-07 per-geo
   * expansion). """ok:false""" = the source did not deliver — the stage
   * records the reason visibly; nothing is ever synthesized. */
  async function topicSuggestions(topic: string, geo: GeoCode, registryDir: string): Promise<SuggestionBatch> {
    if (!topic.trim()) throw new Error('topicSuggestions(topic) requires a non-empty seed topic');
    if (!GEO_CODES.includes(geo)) throw new Error(`topicSuggestions(geo) unknown geo '${String(geo)}'`);
    const url = suggestUrl(topic, geo);
    let attempts = 0;
    let text: string;
    try {
      const got = await httpGet(
        url,
        'autocomplete',
        registryDir,
        'free.autocomplete',
        [topic],
        `Google autocomplete q='${topic}' gl=${GEO_LOCALES[geo].gl} hl=${GEO_LOCALES[geo].hl}`,
      );
      attempts = got.attempts;
      text = got.text;
    } catch (err) {
      const a = err instanceof SourceUnavailableError ? err.attempts : 0;
      const reason = err instanceof SourceUnavailableError ? err.reason : String(err);
      record(registryDir, 'free.autocomplete', [topic], a, `autocomplete FAILED: ${reason}`);
      return { ok: false, reason, suggestions: [], breadth: 0 };
    }
    let suggestions: string[];
    try {
      const parsed = SuggestSchema.parse(JSON.parse(text));
      suggestions = parsed[1];
    } catch (err) {
      const issues = err instanceof z.ZodError ? err.issues.slice(0, 3).map((i) => i.message).join('; ') : String(err);
      record(
        registryDir,
        'free.autocomplete',
        [topic],
        attempts,
        `autocomplete delivered unparseable payload (fail-closed, T-03-02)`,
      );
      return {
        ok: false,
        reason: `autocomplete payload failed validation (fail-closed T-03-02): ${issues}`,
        suggestions: [],
        breadth: 0,
      };
    }
    record(
      registryDir,
      'free.autocomplete',
      [topic],
      attempts,
      `Google autocomplete q='${topic}' gl=${GEO_LOCALES[geo].gl} → ${suggestions.length} suggestions`,
    );
    return { ok: true, suggestions, breadth: suggestions.length };
  }

  // ---- source 2: Google Trends public explore (per keyword interest) --------
  const TREND_RANGE = 'today 3-m';
  const TREND_TZ = '0';

  function exploreUrl(keyword: string, geo: GeoCode): string {
    const { gl, hl } = GEO_LOCALES[geo];
    const req = {
      comparisonItem: [{ keyword, geo: gl.toUpperCase(), time: TREND_RANGE }],
      category: 0,
      property: '',
    };
    const url = new URL(`https://${TRENDS_HOST}/trends/api/explore`);
    url.searchParams.set('hl', hl);
    url.searchParams.set('tz', TREND_TZ);
    url.searchParams.set('req', JSON.stringify(req));
    return url.toString();
  }

  /** Public-interest read for ONE keyword in ONE geo (0-100, 3-m window mean).
   * ok:false ⇒ the trends step could not deliver — honest absence, recorded
   * in the entry's freeSignal.trend note; the free-signal gate then passes the
   * candidate on the remaining proxies rather than inventing a number. */
  async function trendInterest(keyword: string, geo: GeoCode, registryDir: string): Promise<TrendCapture> {
    if (!keyword.trim()) throw new Error('trendInterest(keyword) requires a non-empty keyword');
    if (!GEO_CODES.includes(geo)) throw new Error(`trendInterest(geo) unknown geo '${String(geo)}'`);
    const asOf = () => new Date().toISOString();
    let used = 0; // truthful HTTP attempts across the two-step handshake
    try {
      const explore = await httpGet(
        exploreUrl(keyword, geo),
        'trends',
        registryDir,
        'free.trends',
        [keyword],
        `Google Trends explore '${keyword}' (${TREND_RANGE})`,
      );
      used += explore.attempts;
      const exploreJson = JSON.parse(stripXssiGuard(explore.text));
      const widgets = ExploreSchema.parse(exploreJson).widgets;
      const series = widgets.find((w) => w.id === 'TIMESERIES');
      if (!series || !series.token || !series.request) {
        record(registryDir, 'free.trends', [keyword], used, `trends: no TIMESERIES widget delivered — absence recorded`);
        return { ok: false, reason: 'trends explore returned no TIMESERIES widget', interest: 0, asOf: asOf() };
      }
      const csv = new URL(`https://${TRENDS_HOST}${series.endpoint ?? '/trends/api/widgetdata/multiline/csv'}`);
      csv.searchParams.set('req', JSON.stringify(series.request));
      csv.searchParams.set('token', series.token);
      csv.searchParams.set('tz', TREND_TZ);
      const res = await httpGet(
        csv.toString(),
        'trends',
        registryDir,
        'free.trends',
        [keyword],
        `Google Trends timeseries '${keyword}'`,
      );
      used += res.attempts;
      const values = parseTrendCsv(res.text);
      if (values.length === 0) {
        record(registryDir, 'free.trends', [keyword], used, `trends CSV had no parseable values — absence recorded`);
        return { ok: false, reason: 'trends CSV had no parseable values', interest: 0, asOf: asOf() };
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const interest = Math.round(Math.min(100, Math.max(0, mean)) * 10) / 10;
      record(registryDir, 'free.trends', [keyword], used, `Google Trends '${keyword}' (${TREND_RANGE}) → interest ${interest}`);
      return { ok: true, interest, asOf: asOf() };
    } catch (err) {
      const a = err instanceof SourceUnavailableError ? err.attempts : 0;
      const reason =
        err instanceof SourceUnavailableError
          ? err.reason
          : `trends payload failed validation (fail-closed T-03-02): ${String(err)}`;
      record(registryDir, 'free.trends', [keyword], used + a, `trends FAILED: ${reason}`);
      return { ok: false, reason, interest: 0, asOf: asOf() };
    }
  }

  // ---- source 3: anonymous free SERP HTML (Bing engine) ----------------------
  function serpUrl(keyword: string, geo: GeoCode): string {
    // Per-geo market via mkt (Bing's en-GB/en-CA/en-AU/en-US market codes come
    // straight from GEO_LOCALES[geo].hl — D-07 per-geo capture semantics).
    const { hl } = GEO_LOCALES[geo];
    const url = new URL(`https://${SERP_HOST}/search`);
    url.searchParams.set('count', '20');
    url.searchParams.set('setlang', hl);
    url.searchParams.set('mkt', hl);
    url.searchParams.set('q', keyword);
    return url.toString();
  }

  /** ONE anonymous SERP HTML pull returns the top-3 organic URLs (D-05
   * "one SERP pull per check") + PAA questions T-03-06-safe as plain text.
   * Engine: Bing — see the header block (Google anonymous SERP serves no
   * organic markup to keyless fetches since 2026-10). */
  async function serpTop(keyword: string, geo: GeoCode, registryDir: string): Promise<SerpCapture> {
    if (!keyword.trim()) throw new Error('serpTop(keyword) requires a non-empty keyword');
    if (!GEO_CODES.includes(geo)) throw new Error(`serpTop(geo) unknown geo '${String(geo)}'`);
    const url = serpUrl(keyword, geo);
    const label = `SERP HTML (Bing) q='${keyword}' mkt=${GEO_LOCALES[geo].hl}`;
    let attempts = 0;
    let html: string;
    try {
      const got = await httpGet(url, 'serp', registryDir, 'free.serp', [keyword], label);
      attempts = got.attempts;
      html = got.text;
    } catch (err) {
      const a = err instanceof SourceUnavailableError ? err.attempts : 0;
      const reason = err instanceof SourceUnavailableError ? err.reason : String(err);
      record(registryDir, 'free.serp', [keyword], a, `SERP FAILED: ${reason}`);
      return { ok: false, reason, top: [], paa: [] };
    }
    let parse: SerpParse;
    try {
      parse = parseSerpHtml(html);
    } catch (err) {
      record(registryDir, 'free.serp', [keyword], attempts, `SERP HTML delivered unparseable structure`);
      return {
        ok: false,
        reason: `SERP HTML parse failure (fail-closed T-03-06): ${String(err)}`,
        top: [],
        paa: [],
      };
    }
    record(
      registryDir,
      'free.serp',
      [keyword],
      attempts,
      `SERP HTML (Bing) q='${keyword}' → ${parse.top.length} organic anchors, ${parse.paa.length} PAA`,
    );
    return { ok: true, top: parse.top, paa: parse.paa };
  }

  return { topicSuggestions, trendInterest, serpTop };
}

// ---- default sources (module-level singleton used by runners) ----------------

const defaultSources = createFreeSources();

export function topicSuggestions(
  topic: string,
  geo: GeoCode,
  registryDir: string,
): Promise<SuggestionBatch> {
  return defaultSources.topicSuggestions(topic, geo, registryDir);
}

export function trendInterest(
  keyword: string,
  geo: GeoCode,
  registryDir: string,
): Promise<TrendCapture> {
  return defaultSources.trendInterest(keyword, geo, registryDir);
}

export function serpTop(keyword: string, geo: GeoCode, registryDir: string): Promise<SerpCapture> {
  return defaultSources.serpTop(keyword, geo, registryDir);
}

/** Normalized suggestion string — the ONLY variant under which a candidate is
 * matched across per-geo suggestion lists (D-07 match rule: same normalized
 * wording surfaced by the topic's per-geo suggestion pool). */
export function normalizeSuggestion(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * D-06 freshness gate over the registry-entry cache: an entry whose
 * metricsAsOf exists and is no older than maxAgeDays (default 30) is fresh.
 * The registry shards are the cache — this module stores none itself.
 */
export function metricsFresh(
  entry: { metricsAsOf?: string },
  maxAgeDays = 30,
  now: Date = new Date(),
): boolean {
  if (!entry.metricsAsOf) return false;
  const asOf = Date.parse(entry.metricsAsOf);
  if (Number.isNaN(asOf)) return false;
  return now.getTime() - asOf <= maxAgeDays * 86_400_000;
}
