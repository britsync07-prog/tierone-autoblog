// Free-API usage governance (PIPE-01, D-02 spirit repurposed per the ⚠ OWNER
// FULLY-FREE DIRECTIVE of 2026-10-17): a monthly USD envelope (kept, and never
// exceeded — free ops are always $0) PLUS a monthly REQUEST cap over the same
// persisted, git-committed ledger. Sums gate only the current month (monthly
// rollover — old-month ops stay in the file as the audit trail).
// Ledger file: content/keywords/spend-ledger.json
//   { "monthlyEnvelopeUsd": 25, "monthlyRequestCap": 4000, "ops": SpendOp[] }
// The envelope/cap are owner-tunable by editing those numbers (D-02). All
// writes are atomic (tmp + rename) so a crash never loses the trail
// (T-03-04), and assertSpendable/assertRequestsAvailable hard-stop BEFORE any
// batch of spend/requests. Services `free.*` record `cost: 0` + `requests: N`
// — no USD number ever becomes nonzero; the dfs.* services are kept only so
// historical (pre-directive) ledger ops still validate as the audit trail.

import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';

export type MonthKey = `${number}-${number}`; // 'YYYY-MM' shape, regex-verified at runtime

/** Ledger service vocabulary (additive, ⚠ fully-free directive): `dfs.*` are
 * legacy pre-directive services kept so historical ops validate; `free.*` are
 * the keyless in-house sources — always `cost: 0` with a truthful
 * `requests: N` (actual HTTP attempts made, including retries). */
export type SpendOpService =
  | 'dfs.keyword-ideas'
  | 'dfs.serp'
  | 'free.autocomplete'
  | 'free.trends'
  | 'free.serp';

export interface SpendOp {
  ts: string; // ISO datetime of the append
  month: MonthKey; // gate month — computed once at append time, never re-read
  service: SpendOpService;
  cost: number; // USD; ALWAYS 0 for free.* services (fully-free directive)
  requests?: number; // for free.* ops: actual HTTP attempts recorded this op
  keywords?: string[]; // keywords covered by this op (cache trail)
  note?: string;
}

export type SpendOpInput = Omit<SpendOp, 'ts' | 'month'>;

export interface Budget {
  envelopeUsd: number;
  month: string; // 'YYYY-MM'
  monthSpendUsd: number;
  remainingUsd: number;
  /** Request-cap governance (⚠ fully-free directive) — additive on the same
   * budget read: the monthly cap over keyless free-source HTTP requests. */
  requestCap: number;
  monthRequests: number;
  remainingRequests: number;
}

export interface SpendLedger {
  monthlyEnvelopeUsd: number;
  /** ⚠ fully-free directive: monthly request cap for free.* ops
   * (owner-tunable; absent → DEFAULT_MONTHLY_REQUEST_CAP). */
  monthlyRequestCap?: number;
  ops: SpendOp[];
}

/** D-02 default envelope when the ledger's field is absent. */
export const DEFAULT_MONTHLY_ENVELOPE_USD = 25;

/** ⚠ fully-free directive default request cap (owner-tunable in the ledger
 * file) — sized for several runs/mo at <100 requests/run with headroom. */
export const DEFAULT_MONTHLY_REQUEST_CAP = 4000;

const SERVICES: readonly SpendOpService[] = [
  'dfs.keyword-ideas',
  'dfs.serp',
  'free.autocomplete',
  'free.trends',
  'free.serp',
];
/** Services that must never carry a nonzero USD cost (directive invariant). */
const FREE_SERVICES: readonly SpendOpService[] = ['free.autocomplete', 'free.trends', 'free.serp'];
const MONTH_RE = /^(20\d{2})-(0[1-9]|1[0-2])$/;

/** Thrown by assertSpendable when the current-month envelope can't cover the
 * requested additional spend. Runner + all spend-capable stages must let this
 * propagate as a hard stop (D-02). */
export class BudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExhaustedError';
  }
}

function fail(message: string): never {
  throw new Error(message);
}

function ledgerPath(registryDir: string): string {
  const dir = resolve(registryDir);
  const file = resolve(dir, 'spend-ledger.json');
  if (file !== dir && !file.startsWith(dir + sep)) {
    fail(`ledger path escapes registry directory: ${file}`);
  }
  return file;
}

export function readLedger(registryDir: string): SpendLedger {
  const file = ledgerPath(registryDir);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    fail(`spend ledger missing/unreadable: ${file}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`spend ledger is not valid JSON (${file}): ${err instanceof Error ? err.message : String(err)}`);
  }
  const ledger = parsed as SpendLedger;
  if (typeof ledger !== 'object' || ledger === null || !Array.isArray(ledger.ops)) {
    fail(`spend ledger ${file}: ops must be an array`);
  }
  return ledger;
}

function ym(now: Date): MonthKey {
  const m = now.toISOString().slice(0, 7);
  if (!MONTH_RE.test(m)) fail(`computed month is malformed: '${m}'`);
  return m as MonthKey; // MONTH_RE proves the ${number}-${number} shape
}

/** Read-only budget view: envelope + request cap from the ledger file, with
 * current-month sums in cents (avoids float drift like 25 - 0.6 -> 24.399...).
 * free.* ops count toward `monthRequests` via their truthful `requests` value;
 * legacy dfs.* ops (no `requests`) count only toward the USD envelope. */
export function readBudget(registryDir: string, now: Date = new Date()): Budget {
  const ledger = readLedger(registryDir);
  const envelope =
    typeof ledger.monthlyEnvelopeUsd === 'number' &&
    Number.isFinite(ledger.monthlyEnvelopeUsd) &&
    ledger.monthlyEnvelopeUsd > 0
      ? ledger.monthlyEnvelopeUsd
      : DEFAULT_MONTHLY_ENVELOPE_USD;
  const requestCap =
    typeof ledger.monthlyRequestCap === 'number' &&
    Number.isFinite(ledger.monthlyRequestCap) &&
    Number.isInteger(ledger.monthlyRequestCap) &&
    ledger.monthlyRequestCap > 0
      ? ledger.monthlyRequestCap
      : DEFAULT_MONTHLY_REQUEST_CAP;
  const month = ym(now);
  let spentCents = 0;
  let monthRequests = 0;
  for (const op of ledger.ops) {
    const o = op as SpendOp;
    if (typeof op === 'object' && op !== null && typeof o.month === 'string' && o.month === month) {
      spentCents += Math.round((o.cost ?? 0) * 100);
      if (typeof o.requests === 'number' && Number.isFinite(o.requests)) {
        monthRequests += Math.max(0, Math.round(o.requests));
      }
    }
  }
  const envelopeCents = Math.round(envelope * 100);
  return {
    envelopeUsd: envelope,
    month,
    monthSpendUsd: spentCents / 100,
    remainingUsd: (envelopeCents - spentCents) / 100,
    requestCap,
    monthRequests,
    remainingRequests: requestCap - monthRequests,
  };
}

/** Append one usage op (ts/month computed here) and persist atomically.
 * Convention (⚠ fully-free directive): free.* services must carry `cost: 0`
 * exactly plus a positive integer `requests` — the ledger can never gain a
 * nonzero USD value; legacy dfs.* ops must carry cost > 0 (unchanged old rule). */
export function appendSpend(registryDir: string, op: SpendOpInput, now: Date = new Date()): void {
  if (typeof op !== 'object' || op === null) fail('spend op is required');
  if (!SERVICES.includes(op.service)) {
    fail(`unknown spend service '${String(op.service)}' (valid: ${SERVICES.join(', ')})`);
  }
  const isFreeOp = (FREE_SERVICES as readonly string[]).includes(op.service);
  if (isFreeOp) {
    if (op.cost !== 0) {
      fail(`free service '${op.service}' must record cost exactly 0 — the platform is fully free and no USD number ever becomes nonzero (owner directive 2026-10-17)`);
    }
    if (
      typeof op.requests !== 'number' ||
      !Number.isInteger(op.requests) ||
      op.requests < 1
    ) {
      fail(`free service '${op.service}' must record a truthfully counted integer requests >= 1 (got ${String(op.requests)}) — requests governance is the ledger's second axis (T-03-03 analog)`);
    }
  } else if (typeof op.cost !== 'number' || !Number.isFinite(op.cost) || op.cost <= 0) {
    fail(`spend cost must be a positive finite number (got ${String(op.cost)}) — over-inflated or free ops are rejected (T-03-03)`);
  }
  if (
    op.requests !== undefined &&
    (typeof op.requests !== 'number' || !Number.isInteger(op.requests) || op.requests < 1)
  ) {
    fail('spend op requests, when present, must be an integer >= 1');
  }
  if (op.keywords !== undefined && (!Array.isArray(op.keywords) || op.keywords.some((k) => typeof k !== 'string'))) {
    fail('spend op keywords, when present, must be an array of strings');
  }
  if (op.note !== undefined && typeof op.note !== 'string') {
    fail('spend op note, when present, must be a string');
  }

  const entry: SpendOp = { ...op, ts: now.toISOString(), month: ym(now) };
  const ledger = readLedger(registryDir);
  ledger.ops.push(entry);

  const file = ledgerPath(registryDir);
  const dir = resolve(registryDir);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, 'spend-ledger.json.tmp');
  writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}

/**
 * Hard-stop gate (D-02): throws BudgetExhaustedError when remainingUsd <
 * maxAddlUsd. Call BEFORE any batched external spend. maxAddlUsd = 0 is a
 * valid preflight ("never continue from an over-spent envelope").
 */
export function assertSpendable(registryDir: string, maxAddlUsd: number, now: Date = new Date()): Budget {
  if (typeof maxAddlUsd !== 'number' || !Number.isFinite(maxAddlUsd) || maxAddlUsd < 0) {
    fail(`maxAddlUsd must be a non-negative finite number (got ${String(maxAddlUsd)})`);
  }
  const b = readBudget(registryDir, now);
  if (b.remainingUsd < maxAddlUsd) {
    throw new BudgetExhaustedError(
      `monthly spend envelope exhausted: remaining $${b.remainingUsd.toFixed(2)} < required $${maxAddlUsd.toFixed(2)} for month ${b.month} — raise monthlyEnvelopeUsd in content/keywords/spend-ledger.json or wait for monthly rollover (D-02; kept as the USD guardian of the ⚠ fully-free directive — no op may ever push it nonzero)`,
    );
  }
  return b;
}

/**
 * Request-cap hard-stop (⚠ fully-free directive, D-02 spirit): throws
 * BudgetExhaustedError when the remaining monthly free-source request budget
 * is below maxAddlRequests. Call BEFORE any batch of keyless source calls —
 * this is the gate stages use instead of a USD envelope. maxAddlRequests = 0
 * is a valid preflight ("never continue from an exhausted cap").
 */
export function assertRequestsAvailable(
  registryDir: string,
  maxAddlRequests: number,
  now: Date = new Date(),
): Budget {
  if (typeof maxAddlRequests !== 'number' || !Number.isFinite(maxAddlRequests) || maxAddlRequests < 0) {
    fail(`maxAddlRequests must be a non-negative finite number (got ${String(maxAddlRequests)})`);
  }
  const b = readBudget(registryDir, now);
  if (b.remainingRequests < maxAddlRequests) {
    throw new BudgetExhaustedError(
      `free-source request cap exhausted for ${b.month}: ${b.monthRequests}/${b.requestCap} requests used, ${b.remainingRequests} remaining < required ${maxAddlRequests} — raise monthlyRequestCap in content/keywords/spend-ledger.json or wait for monthly rollover (⚠ fully-free directive; replaces the USD spend envelope as the operative hard-stop)`,
    );
  }
  return b;
}
