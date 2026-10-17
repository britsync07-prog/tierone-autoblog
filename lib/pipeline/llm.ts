// Free-tier LLM client for the PIPE-02/PIPE-03 intelligence stages — REWORKED
// (Plan 03-03, 2026-10-17) for the ⚠ OWNER FULLY-FREE DIRECTIVE: the platform
// must work fully free, so NO third-party PAYED APIs — ever. The plan's
// pre-override dual-SDK contract (Anthropic primary / OpenAI fallback) is
// superseded by a single OpenAI-COMPATIBLE adapter whose endpoint, key and
// model all come from env, so any FREE endpoint can serve it:
//
//   LLM_BASE_URL   e.g. Groq              https://api.groq.com/openai/v1   (free API key)
//                  e.g. OpenRouter free   https://openrouter.ai/api/v1     (`:free`-suffixed models)
//                  e.g. local Ollama      http://localhost:11434/v1        (no key needed)
//   LLM_API_KEY    free-tier key — OPTIONAL (keyless local runtimes leave it unset)
//   LLM_MODEL      primary model id served by that endpoint
//   LLM_MODEL_CHEAP  optional cheaper/faster model id used only for narrow
//                  tasks (summarize/title-desc); unset → LLM_MODEL
//   LLM_FALLBACK_BASE_URL / LLM_FALLBACK_API_KEY / LLM_FALLBACK_MODEL
//                  optional second provider attempted once when the primary
//                  transport fails (outage shape) — both free tiers, never paid
//
// (`openai`-package-style protocol, zero SDK dependency: plain fetch against
// `{baseUrl}/chat/completions`, so Groq/OpenRouter/Ollama/vLLM all work.)
//
// Credential protocol: errors name the MISSING ENV VAR, never its value
// (T-03-05); log/error surfaces truncate anything beyond the first 200 chars
// so briefs never leak into logs. Structured output = model returns JSON,
// parsed through the caller's zod schema — 1 repair retry carrying the
// validation error, then LlmBadStructuredOutputError. FIXTURE MODE: when a
// caller passes jsonFixture, the exact same zod validation path runs on the
// fixture with zero network — this is how stages verify deterministically.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ZodType } from 'zod';

export type LlmTask = 'summarize' | 'title-desc' | 'outline-body' | 'generic-structured';
export type LlmProviderId = 'primary' | 'fallback';
/** ⚠ reworked per owner directive: provider tags are ROLE tags of the free adapter. */
export type LlmProviderTag = LlmProviderId | 'fixture';

export interface LlmMessage {
  role: 'system' | 'user';
  content: string;
}

export interface LlmJson<T> {
  parsed: T;
  raw: string;
  provider: LlmProviderTag;
  /** Real HTTP attempts made (0 for fixture mode); free calls are still
   * governed requests on the ledger's request-cap axis. */
  attempts: number;
}

/** Tight default for every task family — explicit per plan contract. */
export const TASK_MAX_TOKENS: Record<LlmTask, number> = {
  summarize: 2000,
  'title-desc': 400,
  'outline-body': 4000,
  'generic-structured': 2000,
};

/** Narrow/routed-cheap tasks (⚠ rework: model-level routing — cheap model id
 * serves these when LLM_MODEL_CHEAP is set; everything else uses LLM_MODEL). */
export const NARROW_TASKS: readonly LlmTask[] = ['summarize', 'title-desc'];

export class LlmNoCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmNoCredentialsError';
  }
}

export class LlmBadStructuredOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmBadStructuredOutputError';
  }
}

/** Both configured providers failed at the transport level (outage shape). */
export class LlmProvidersExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmProvidersExhaustedError';
  }
}

/** Resolved (ready) provider configuration — secrets are never logged. */
export interface LlmProviderReady {
  id: LlmProviderId;
  baseUrl: string;
  /** Optional: keyless runtimes (local Ollama) send no Authorization header. */
  apiKey?: string;
  model: string;
}

const LLM_JSON_SYSTEM =
  'You are a structured-data generator inside an automated pipeline. You always reply with a single valid JSON object and nothing else — no prose, no markdown fences, no commentary.';

function providerEnvPrefix(id: LlmProviderId): string {
  return id === 'fallback' ? 'LLM_FALLBACK_' : 'LLM_';
}

function missingRequiredVars(id: LlmProviderId): string[] {
  const prefix = providerEnvPrefix(id);
  const missing: string[] = [];
  if (!process.env[`${prefix}BASE_URL`]) missing.push(`${prefix}BASE_URL`);
  if (!process.env[`${prefix}MODEL`]) missing.push(`${prefix}MODEL`);
  // LLM_API_KEY is deliberately OPTIONAL (keyless local runtimes), so it is
  // never listed as required and never becomes a credential error itself.
  return missing;
}

const FREE_OPTIONS_WIRING =
  'Set a FREE OpenAI-compatible endpoint: LLM_BASE_URL + LLM_MODEL (+ optional LLM_API_KEY — unset it for keyless local runtimes like Ollama). Free choices: Groq (https://api.groq.com/openai/v1, free API key), OpenRouter `:free` models (https://openrouter.ai/api/v1), or a local Ollama (http://localhost:11434/v1). No third-party PAID API is ever allowed (owner fully-free directive 2026-10-17).';

/**
 * Resolve provider env config. 'primary' throws LlmNoCredentialsError naming
 * the missing vars when not configured; 'fallback' returns null when entirely
 * unset and throws on a PARTIAL fallback config (misconfiguration is honest).
 */
export function readProviderConfig(id: LlmProviderId): LlmProviderReady | null {
  const prefix = providerEnvPrefix(id);
  const baseUrl = process.env[`${prefix}BASE_URL`];
  const apiKey = process.env[`${prefix}API_KEY`];
  const model = process.env[`${prefix}MODEL`];
  const missing = missingRequiredVars(id);
  const anySet = baseUrl !== undefined || apiKey !== undefined || model !== undefined;
  if (id === 'fallback' && !anySet) return null; // no fallback configured — legitimate
  if (missing.length > 0) {
    throw new LlmNoCredentialsError(
      `LLM credentials missing: ${missing.join(' and ')} not set. ${FREE_OPTIONS_WIRING}`,
    );
  }
  return {
    id,
    baseUrl: baseUrl as string,
    ...(apiKey ? { apiKey } : {}),
    model: model as string,
  };
}

/** Stage-level fast gate: fail closed on missing LLM env BEFORE any registry
 * state is touched (never half-mutate, then fail on missing configuration). */
export function assertLlmReady(): LlmProviderReady {
  const cfg = readProviderConfig('primary');
  if (cfg === null) {
    throw new LlmNoCredentialsError(`LLM credentials missing: LLM_BASE_URL and/or LLM_MODEL not set. ${FREE_OPTIONS_WIRING}`);
  }
  return cfg;
}

function modelFor(task: LlmTask, cfg: LlmProviderReady): string {
  if (NARROW_TASKS.includes(task)) {
    return process.env.LLM_MODEL_CHEAP ?? cfg.model;
  }
  return cfg.model;
}

/** One structured-call transport. Real transports record their truthfully
 * counted HTTP attempts; injected doubles return attempts as given. */
export interface TransportCallContext {
  provider: LlmProviderId;
  baseUrl: string;
  apiKey?: string;
  model: string;
  task: LlmTask;
  messages: LlmMessage[];
  maxTokens: number;
}

export type LlmTransport = (call: TransportCallContext) => Promise<{ raw: string; attempts: number }>;

const HTTP_TIMEOUT_MS = 60_000;
const RETRY_BACKOFF_MS = 5_000;
const MAX_HTTP_ATTEMPTS = 2; // 1 polite retry on 5xx/429/network — never retry other 4xx

const sleep = (ms: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function chatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

/** Default transport: OpenAI-compatible `/chat/completions` over plain fetch
 * (works with Groq/OpenRouter/Ollama/vLLM-style free endpoints). 60s timeout,
 * 1 retry on 5xx/429/network errors with a 5s backoff, other 4xx fail fast. */
export const defaultOpenAiTransport: LlmTransport = async (call) => {
  let lastReason = 'unknown error';
  for (let attempt = 1; attempt <= MAX_HTTP_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(chatUrl(call.baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(call.apiKey ? { authorization: `Bearer ${call.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: call.model,
          messages: call.messages,
          max_tokens: call.maxTokens,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          choices?: Array<{ message?: { content?: unknown } }>;
        } | null;
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
          lastReason = `HTTP ${res.status} but no message content in response`;
        } else {
          return { raw: content, attempts: attempt };
        }
      } else {
        const bodyText = await res.text().catch(() => '');
        const detail = bodyText ? bodyText.slice(0, 200) : '';
        lastReason = `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
      }
    } catch (err) {
      lastReason = err instanceof Error ? err.message.slice(0, 200) : String(err);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_HTTP_ATTEMPTS) {
      // 5xx / 429 / network transport errors are transient — retry politely
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  throw new Error(
    `LLM ${call.provider} transport failed after ${MAX_HTTP_ATTEMPTS} attempt(s): ${lastReason}`,
  );
};

/** Tolerant JSON extraction: strips optional code fences, then takes the
 * first balanced '{...}' or '[...]' span the model may have wrapped. */
export function extractJson(raw: string): string {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if (fence) t = fence[1].trim();
  for (const [open, close] of [
    ['{', '}'],
    ['[', ']'],
  ] as const) {
    const start = t.indexOf(open);
    const end = t.lastIndexOf(close);
    if (start !== -1 && end > start) return t.slice(start, end + 1);
  }
  return t;
}

type ZodOutcome<T> = { ok: true; data: T } | { ok: false; detail: string };

/** THE zod gate — every path (fixture and live) funnels through here. */
function validateZod<T>(zodSchema: ZodType<T>, raw: string): ZodOutcome<T> {
  let jsonParsed: unknown;
  try {
    jsonParsed = JSON.parse(extractJson(raw));
  } catch (err) {
    return { ok: false, detail: `response is not parseable JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  const parsed = zodSchema.safeParse(jsonParsed);
  if (!parsed.success) {
    return {
      ok: false,
      detail: parsed.error.issues
        .map((i) => `${i.path.length > 0 ? i.path.join('.') : '(root)'}: ${i.message}`)
        .join('; '),
    };
  }
  return { ok: true, data: parsed.data };
}

export interface CompleteJsonOptions<T> {
  task: LlmTask;
  zodSchema: ZodType<T>;
  messages: LlmMessage[];
  /** Fixture text key (stage callers pass `${stage}:${silo}:${id}`) — used to
   * look up fixture payloads deterministically with zero API spend. */
  fixtureKey?: string;
  /** FIXTURE payload: when provided, validate through the SAME zod path with
   * ZERO network. This is the deterministic verification lane. */
  jsonFixture?: unknown;
  /** Test seam: inject provider transports (no real network). Unspecified
   * providers fall back to the default OpenAI-compatible transport. */
  transports?: Partial<Record<LlmProviderId, LlmTransport>>;
}

/**
 * One structured-JSON completion. FIXTURE mode validates jsonFixture through
 * the same zod gate (provider='fixture', attempts 0). Live mode: primary
 * provider first (cheap model for narrow tasks when LLM_MODEL_CHEAP is set),
 * 1 repair retry on schema failure, then optional fallback provider once on
 * transport failure; throws LlmNoCredentialsError naming env vars when the
 * primary endpoint is not configured.
 */
export async function completeJson<T>(opts: CompleteJsonOptions<T>): Promise<LlmJson<T>> {
  if (opts.jsonFixture !== undefined) {
    const raw = JSON.stringify(opts.jsonFixture);
    const outcome = validateZod(opts.zodSchema, raw);
    if (!outcome.ok) {
      throw new LlmBadStructuredOutputError(
        `LLM fixture (task ${opts.task}, key ${opts.fixtureKey ?? 'anonymous'}) failed schema validation: ${outcome.detail} — fixtures must satisfy the same zod contract as live output`,
      );
    }
    return { parsed: outcome.data, raw, provider: 'fixture', attempts: 0 };
  }

  const chain: Array<{ id: LlmProviderId; cfg: LlmProviderReady; transport: LlmTransport }> = [];
  const primary = readProviderConfig('primary');
  chain.push({ id: 'primary', cfg: primary as LlmProviderReady, transport: opts.transports?.primary ?? defaultOpenAiTransport });
  const fallback = readProviderConfig('fallback'); // null when unconfigured
  if (fallback !== null) {
    chain.push({ id: 'fallback', cfg: fallback, transport: opts.transports?.fallback ?? defaultOpenAiTransport });
  }

  const messages: LlmMessage[] =
    opts.messages[0]?.role === 'system'
      ? opts.messages
      : [{ role: 'system', content: LLM_JSON_SYSTEM }, ...opts.messages];
  const maxTokens = TASK_MAX_TOKENS[opts.task];

  for (const link of chain) {
    const model = modelFor(opts.task, link.cfg);
    const attempts: number[] = [];
    const call = (msgs: LlmMessage[]) =>
      link
        .transport({
          provider: link.id,
          baseUrl: link.cfg.baseUrl,
          ...(link.cfg.apiKey ? { apiKey: link.cfg.apiKey } : {}),
          model,
          task: opts.task,
          messages: msgs,
          maxTokens,
        })
        .then((r) => {
          attempts.push(r.attempts);
          return r.raw;
        });
    try {
      const raw1 = await call(messages);
      const v1 = validateZod(opts.zodSchema, raw1);
      if (v1.ok) {
        return { parsed: v1.data, raw: raw1, provider: link.id, attempts: attempts.reduce((a, b) => a + b, 0) };
      }
      // Repair retry (exactly one): hand the model back the validation error.
      const repairMessage: LlmMessage = {
        role: 'user',
        content: `Your previous reply failed output validation: ${v1.detail.slice(0, 4000)}. Return the corrected JSON object only — no prose, no markdown fences.`,
      };
      const raw2 = await call([...messages, repairMessage]);
      const v2 = validateZod(opts.zodSchema, raw2);
      if (v2.ok) {
        return { parsed: v2.data, raw: raw2, provider: link.id, attempts: attempts.reduce((a, b) => a + b, 0) };
      }
      throw new LlmBadStructuredOutputError(
        `LLM output failed schema validation for task '${opts.task}' after 1 repair retry (${v2.detail}) — model response starts '${raw2.replace(/\s+/g, ' ').slice(0, 200)}'`,
      );
    } catch (err) {
      if (err instanceof LlmBadStructuredOutputError) throw err; // output problem ≠ provider outage
      if (link.id === 'fallback') continue; // last provider failed — report below
      if (chain.find((next) => next.id === 'fallback')) continue; // try fallback once
      throw err; // no fallback configured: surface the primary error unchanged
    }
  }
  throw new LlmProvidersExhaustedError(
    'LLM providers exhausted: the primary (and configured fallback, if any) free endpoint all failed at the transport level — check endpoint health / rate limits, then retry',
  );
}

/**
 * Fixture map for deterministic stage verification: `<registryDir>/llm-fixtures.json`
 * maps `${stage}:${silo}:${id}` → the JSON payload the model would return.
 * Absent file → {} (real LLM calls); malformed → honest failure.
 */
export function readFixtureMap(dir: string): Record<string, unknown> {
  const file = join(resolve(dir), 'llm-fixtures.json');
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return {}; // no fixture map on disk — real LLM mode
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`llm-fixtures.json at ${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`llm-fixtures.json at ${file} must be a map of '${'{'}${'stage}:${silo}:${id}'}' → payload object`);
  }
  return parsed as Record<string, unknown>;
}
