// DataForSEO v3 REST client (PIPE-01). Dependency-free over global fetch —
// DataForSEO has no Node SDK worth adding (plan <interfaces>). Primary keyword
// endpoint: Labs Google Keyword Ideas (chosen over bulk_search_volume because
// ONE endpoint returns per-geo volume AND KD together, so a single call site
// covers D-04 filtering and D-07 per-geo capture without a second integration).
//
// Endpoint choice documented (planner discretion per CONTEXT "DataForSEO
// mechanics"): live endpoints accept only ONE task per call ("each Live API
// call can contain only one task" — docs 2026-10), so the planned batched
// multi-geo call is impossible here; the stage therefore makes one
// keyword_ideas call per topic per geo and documents the frontier.
//
// Spend-first (T-03-04): every successful priced response appends to the
// spend ledger (reading `cost` from the response envelope) BEFORE results are
// processed, so a crash after billing still leaves an auditable trail.
// Never hardcode prices — the response `cost` is the only source.
//
// Security (T-03-05): credentials are read from env per call and encoded into
// the Authorization header; no code path logs, echoes, or stores them. Error
// messages name the missing env-var NAMES, never their values. (T-03-02)
// malformed payloads fail closed via zod narrow-shape validation.
//
// Cache discipline (D-02 cache-everything): this client keeps no cache of its
// own — the git-committed registry shards ARE the cache. `metricsFresh()` is
// the 30-day freshness gate the stage applies via entry.metricsAsOf
// (D-06: refresh only when promoted and older than the window).

import { z } from 'zod';
import { appendSpend, type SpendOpInput } from './budget';
import { GEO_CODES, type GeoCode, type SerpResult } from './types';

/** Per-geo Google location codes (Labs + SERP endpoints, docs Locations). */
export const locations: Record<GeoCode, number> = {
  us: 2840,
  uk: 2826,
  ca: 2124,
  au: 2036,
};

/** Single search language for this project (en-US primary, English-only). */
export const LANGUAGE_CODE = 'en';

/** Candidate cap per keyword-ideas call: keeps payloads small; DataForSEO
 * Labs keyword_ideas pricing is per call, so the cap trades breadth for
 * focused candidates (server-side volume pre-filter does the heavy lifting). */
export const KEYWORD_IDEAS_LIMIT = 30;

/** Server-side pre-filter, deliberately WIDER than D-04 (500-5000, kd<20):
 * billing protection — the API should not charge for clearly unusable items,
 * while the pipeline's exact D-04 thresholds are still applied in the stage
 * with visible per-candidate rejection reasons (no silent discards). */
export const KEYWORD_IDEAS_FILTER: unknown[] = [['keyword_info.search_volume', '>', 400]];

/** Thrown when DATAFORSEO_LOGIN / DATAFORseo_PASSWORD are absent from env.
 * Message names the env-var NAMES only — values are never read into it. */
export class MissingCredentialsError extends Error {
  constructor() {
    const missing: string[] = [];
    const login = process.env.DATAFORSEO_LOGIN?.trim();
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login) missing.push('DATAFORSEO_LOGIN');
    if (!password) missing.push('DATAFORSEO_PASSWORD');
    super(
      `DataForSEO credentials missing from environment: ${missing.join(', ')}. ` +
        `Set ${missing.join(', ')} in .env (values from DataForSEO Dashboard -> API Access; ` +
        `see the phase user_setup checklist). Values are never printed by this pipeline.`,
    );
    this.name = 'MissingCredentialsError';
  }
}

/** Thrown when the DataForSEO API answers but not with success. Carries the
 * response status_code/status_message verbatim — no credential material. */
export class DataForSeoApiError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, statusMessage: string, context: string) {
    super(`DataForSEO API error (status ${statusCode}): ${statusMessage} — ${context}`);
    this.name = 'DataForSeoApiError';
    this.statusCode = statusCode;
  }
}

/** Normalized keyword-idea item (narrow shape, T-03-02). `kd` is undefined
 * when DataForSEO reports difficulty as null (unknown — stage must then
 * fail the candidate with an explicit reason, D-04). */
export interface KeywordIdea {
  keyword: string;
  volume: number;
  kd?: number;
  cpc?: number;
}

/** Direct capture of one SERP pull: top organic results + PAA questions. */
export interface SerpCapture {
  top: SerpResult[];
  paa: string[];
}

// ---- zod narrow-shape validation (T-03-02: fail closed on surprises) -------

const EnvelopeSchema = z.object({
  status_code: z.number(),
  status_message: z.string(),
  /** Task objects stay raw (z.unknown): their full shape (id/result/...)
   * is consumed downstream by endpoint-specific schemas; stripping keys
   * here would erase task.result before it reaches those parsers. */
  tasks: z.array(z.unknown()).optional(),
});

const KeywordIdeaItemSchema = z.object({
  keyword: z.string().min(1),
  keyword_info: z.object({
    search_volume: z.number(),
    cpc: z.number().optional(),
  }),
  keyword_properties: z
    .object({ keyword_difficulty: z.number().nullable().optional() })
    .optional(),
});

/** v3 envelope nesting (docs response examples): items live at
 * task.result[0].items — the task object itself carries no items field. */
const KeywordIdeasResultSchema = z.object({
  result: z
    .array(z.object({ items: z.array(z.unknown()).optional() }).nullable())
    .nullable()
    .optional(),
});

const SerpItemsResultSchema = z.object({
  result: z
    .array(z.object({ items: z.array(z.unknown()).optional() }).nullable())
    .nullable()
    .optional(),
});

const OrganicItemSchema = z.object({
  url: z.string().min(1),
  title: z.string().min(1),
  rank_absolute: z.number().optional(),
});

const PaaItemSchema = z.object({
  title: z.string().min(1),
});

// ---- client -----------------------------------------------------------------

export interface DataForSeoClientDeps {
  /** Fetch seam for fixtures (defaults to globalThis.fetch). */
  fetchFn?: typeof fetch;
  /** Spend-record seam (defaults to the real appendSpend — spend-first). */
  spendFn?: (registryDir: string, op: SpendOpInput) => void;
  /** Backoff delays for the two 5xx retries (defaults to 2s/8s). */
  retryDelaysMs?: number[];
  /** Wall clock for timeout/backoff (injectable clock not needed; keep). */
  timeoutMs?: number;
}

export interface DfsPostResult {
  cost: number;
  /** Raw task array from the envelope (zod-validated minimum shape). */
  results: unknown[];
}

export interface DataForSeoClient {
  buildAuth: () => string;
  post: (
    path: string,
    body: unknown,
    registryDir: string,
    service: 'dfs.keyword-ideas' | 'dfs.serp',
    keywords?: string[],
  ) => Promise<DfsPostResult>;
  keywordIdeas: (topic: string, geo: GeoCode, registryDir: string) => Promise<KeywordIdea[]>;
  serpTop: (keyword: string, geo: GeoCode, registryDir: string) => Promise<SerpCapture>;
}

const PATTERN_HOST = 'api.dataforseo.com';

/** Endpoint URL — HTTPS to api.dataforseo.com ONLY, /v3/ paths (T-03-05:
 * no dynamic host/target from any input). */
function endpointUrl(path: string): URL {
  if (!path.startsWith('/v3/')) {
    throw new Error(`DataForSEO path must start with /v3/ (got '${path}')`);
  }
  const url = new URL(`https://${PATTERN_HOST}${path}`);
  if (url.protocol !== 'https:' || url.host !== PATTERN_HOST) {
    throw new Error(`refusing non-DataForSEO endpoint: ${url}`);
  }
  return url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDataForSeoClient(deps: DataForSeoClientDeps = {}): DataForSeoClient {
  const fetchFn = deps.fetchFn ?? fetch;
  const spendFn = deps.spendFn ?? appendSpend;
  const retryDelays = deps.retryDelaysMs ?? [2_000, 8_000];
  const timeoutMs = deps.timeoutMs ?? 60_000;

  /** HTTP Basic auth value from env (throws MissingCredentialsError). */
  function buildAuth(): string {
    const login = process.env.DATAFORSEO_LOGIN?.trim();
    const password = process.env.DATAFORSEO_PASSWORD;
    const missing: string[] = [];
    if (!login) missing.push('DATAFORSEO_LOGIN');
    if (!password) missing.push('DATAFORSEO_PASSWORD');
    if (missing.length > 0) {
      // MissingCredentialsError builds the message listing the missing NAMES
      // only — environment values never flow into error text (T-03-05).
      throw new MissingCredentialsError();
    }
    return `Basic ${Buffer.from(`${login}:${password}`, 'utf8').toString('base64')}`;
  }

  /**
   * One Basic-auth POST to a DataForSEO v3 live endpoint.
   * - 60s timeout via AbortController; never hits any other host.
   * - retries at most twice on 5xx/network errors (2s/8s), NEVER on 4xx.
   * - zod-validated envelope; non-20000 throws DataForSeoApiError.
   * - `cost` summed across tasks[].cost; > 0 => spend op BEFORE returning.
   */
  async function post(
    path: string,
    body: unknown,
    registryDir: string,
    service: 'dfs.keyword-ideas' | 'dfs.serp',
    keywords?: string[],
  ): Promise<DfsPostResult> {
    if (registryDir.length === 0) throw new Error('post(registryDir) is required for spend-first accounting');
    const auth = buildAuth(); // throws MissingCredentialsError — surfaced as auth gate
    const url = endpointUrl(path);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const req = new Request(url, {
          method: 'POST',
          headers: {
            authorization: auth,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body ?? []),
          signal: ctrl.signal,
        });
        const res = await fetchFn(req);

        if (res.status >= 500) {
          lastError = new DataForSeoApiError(res.status, `HTTP ${res.status} upstream 5xx`, path);
          if (attempt < retryDelays.length) {
            await sleep(retryDelays[attempt] ?? 0);
            continue;
          }
          throw lastError;
        }

        // 4xx and 2xx both carry a (possibly JSON) envelope; parse once.
        const text = await res.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new DataForSeoApiError(res.status, `non-JSON HTTP ${res.status} response body`, path);
        }
        const envelope = EnvelopeSchema.safeParse(parsed);
        if (!envelope.success) {
          // T-03-02 fail-closed: unexpected envelope shape is loud, never
          // coerced. Include HTTP status for context; body never echoed raw.
          throw new DataForSeoApiError(
            res.status,
            `malformed response envelope (zod: ${envelope.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '<root>'} ${i.message}`).join('; ')})`,
            path,
          );
        }

        let cost = 0;
        for (const rawTask of envelope.data.tasks ?? []) {
          const taskCost = (rawTask as { cost?: unknown } | null)?.cost;
          if (typeof taskCost === 'number' && Number.isFinite(taskCost) && taskCost > 0) {
            cost = Math.round((cost + taskCost) * 10_000) / 10_000; // cents-safe sum
          }
        }
        if (cost > 0) {
          // Spend-first: record BEFORE any result processing so a crash after
          // billing still leaves an auditable ledger op (T-03-04, D-02).
          spendFn(registryDir, { service, cost, keywords, note: `${path} (${envelope.data.status_message.replace(/\.+$/, '')})` });
        }
        if (envelope.data.status_code !== 20000) {
          throw new DataForSeoApiError(envelope.data.status_code, envelope.data.status_message, path);
        }
        return { cost, results: envelope.data.tasks ?? [] };
      } catch (err) {
        // Network/timeout failures retry like 5xx (bounded by the same loop);
        // deterministic client errors (4xx-shape, envelope) bubble at once.
        if (err instanceof DataForSeoApiError) throw err;
        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new DataForSeoApiError(0, `request timed out after ${timeoutMs}ms`, path);
        } else if (err instanceof Error) {
          lastError = err;
        } else {
          lastError = new Error(String(err));
        }
        if (attempt < retryDelays.length) {
          await sleep(retryDelays[attempt] ?? 0);
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    // Loop always returns or throws; unreachable guard for the type checker.
    throw lastError ?? new DataForSeoApiError(0, 'exhausted retries', path);
  }

  /** Labs Google Keyword Ideas — long-tail expansion of ONE seed topic for
   * ONE geo (live endpoints take exactly one task per call, docs 2026-10).
   * Normalized to {keyword, volume, kd?} (kd undefined when the API reports
   * null difficulty). Task-level failures throw AFTER the spend was recorded. */
  async function keywordIdeas(topic: string, geo: GeoCode, registryDir: string): Promise<KeywordIdea[]> {
    if (!topic.trim()) throw new Error('keywordIdeas(topic) requires a non-empty seed topic');
    if (!GEO_CODES.includes(geo)) throw new Error(`keywordIdeas(geo) unknown geo '${String(geo)}'`);
    const body = [
      {
        keywords: [topic],
        location_code: locations[geo],
        language_code: LANGUAGE_CODE,
        closely_variants: false,
        limit: KEYWORD_IDEAS_LIMIT,
        filters: KEYWORD_IDEAS_FILTER,
      },
    ];
    const { results } = await post(
      '/v3/dataforseo_labs/google/keyword_ideas/live',
      body,
      registryDir,
      'dfs.keyword-ideas',
      [topic],
    );

    const task = results[0] as z.infer<typeof KeywordIdeasResultSchema> | undefined;
    if (!task) throw new DataForSeoApiError(20000, 'keyword_ideas task result missing', 'keyword_ideas');
    const parsedTask = KeywordIdeasResultSchema.parse(task);
    const group = parsedTask.result?.[0];
    if (group === null || group === undefined) {
      throw new DataForSeoApiError(20000, 'keyword_ideas task result missing', 'keyword_ideas');
    }

    const out: KeywordIdea[] = [];
    const seen = new Set<string>();
    for (const raw of group.items ?? []) {
      const item = KeywordIdeaItemSchema.parse(raw);
      const key = item.keyword.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const kdRaw = item.keyword_properties?.keyword_difficulty;
      out.push({
        keyword: item.keyword,
        volume: item.keyword_info.search_volume,
        kd: typeof kdRaw === 'number' ? kdRaw : undefined,
        cpc: item.keyword_info.cpc,
      });
    }
    return out;
  }

  /** SERP API Google organic (regular, desktop, default depth 10 so billing
   * stays at the standard per-SERP rate). ONE pull returns the top-3 organic
   * URLs and the People-Also-Ask questions (D-05 "one SERP pull per check"). */
  async function serpTop(keyword: string, geo: GeoCode, registryDir: string): Promise<SerpCapture> {
    if (!keyword.trim()) throw new Error('serpTop(keyword) requires a non-empty keyword');
    if (!GEO_CODES.includes(geo)) throw new Error(`serpTop(geo) unknown geo '${String(geo)}'`);
    const body = [
      {
        keyword,
        location_code: locations[geo],
        language_code: LANGUAGE_CODE,
        device: 'desktop',
      },
    ];
    const { results } = await post(
      '/v3/serp/google/organic/live/regular',
      body,
      registryDir,
      'dfs.serp',
      [keyword],
    );

    const task = results[0] as z.infer<typeof SerpItemsResultSchema> | undefined;
    if (!task) throw new DataForSeoApiError(20000, 'serp task result missing', 'serp');
    const parsedTask = SerpItemsResultSchema.parse(task);
    const serpGroup = parsedTask.result?.[0];
    if (serpGroup === null || serpGroup === undefined) {
      throw new DataForSeoApiError(20000, 'serp task result missing', 'serp');
    }

    const organic: SerpResult[] = [];
    const paa: string[] = [];
    let index = 0;
    for (const raw of serpGroup.items ?? []) {
      const kind = (raw as { type?: unknown } | null)?.type;
      index += 1;
      if (kind === 'organic') {
        const item = OrganicItemSchema.parse(raw);
        organic.push({
          url: item.url,
          title: item.title,
          position: item.rank_absolute ?? index,
        });
      } else if (kind === 'people_also_ask') {
        // Titles/PAA are third-party strings stored as plain text only —
        // never interpolated into commands or paths (T-03-06).
        const item = PaaItemSchema.parse(raw);
        paa.push(item.title);
      }
    }
    organic.sort((a, b) => a.position - b.position);
    return { top: organic.slice(0, 3), paa };
  }

  return { buildAuth, post, keywordIdeas, serpTop };
}

// ---- default client (module-level singleton used by runners) ----------------

const defaultClient = createDataForSeoClient();

export function buildAuth(): string {
  return defaultClient.buildAuth();
}

export function post(
  path: string,
  body: unknown,
  registryDir: string,
  service: 'dfs.keyword-ideas' | 'dfs.serp',
  keywords?: string[],
): Promise<DfsPostResult> {
  return defaultClient.post(path, body, registryDir, service, keywords);
}

export function keywordIdeas(topic: string, geo: GeoCode, registryDir: string): Promise<KeywordIdea[]> {
  return defaultClient.keywordIdeas(topic, geo, registryDir);
}

export function serpTop(keyword: string, geo: GeoCode, registryDir: string): Promise<SerpCapture> {
  return defaultClient.serpTop(keyword, geo, registryDir);
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
