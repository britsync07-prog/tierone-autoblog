// DataForSEO spend governance (PIPE-01, D-02): a monthly USD envelope with a
// persisted, git-committed spend ledger. Sums gate only the current month
// (monthly rollover — old-month ops stay in the file as the audit trail).
// Ledger file: content/keywords/spend-ledger.json
//   { "monthlyEnvelopeUsd": 25, "ops": SpendOp[] }
// The envelope is owner-tunable by editing that single number (D-02). All
// writes are atomic (tmp + rename) so a crash never loses the spend trail
// (T-03-04), and assertSpendable hard-stops BEFORE any batched spend.

import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';

export type MonthKey = `${number}-${number}`; // 'YYYY-MM' shape, regex-verified at runtime

export interface SpendOp {
  ts: string; // ISO datetime of the append
  month: MonthKey; // gate month — computed once at append time, never re-read
  service: 'dfs.keyword-ideas' | 'dfs.serp';
  cost: number;
  keywords?: string[]; // keywords covered by this op (cache trail)
  note?: string;
}

export type SpendOpInput = Omit<SpendOp, 'ts' | 'month'>;

export interface Budget {
  envelopeUsd: number;
  month: string; // 'YYYY-MM'
  monthSpendUsd: number;
  remainingUsd: number;
}

export interface SpendLedger {
  monthlyEnvelopeUsd: number;
  ops: SpendOp[];
}

/** D-02 default envelope when the ledger's field is absent. */
export const DEFAULT_MONTHLY_ENVELOPE_USD = 25;

const SERVICES: readonly SpendOp['service'][] = ['dfs.keyword-ideas', 'dfs.serp'];
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

/** Read-only budget view: envelope from the ledger file (default 25), current-
 * month sum in cents (avoids float drift like 25 - 0.6 -> 24.399...). */
export function readBudget(registryDir: string, now: Date = new Date()): Budget {
  const ledger = readLedger(registryDir);
  const envelope =
    typeof ledger.monthlyEnvelopeUsd === 'number' &&
    Number.isFinite(ledger.monthlyEnvelopeUsd) &&
    ledger.monthlyEnvelopeUsd > 0
      ? ledger.monthlyEnvelopeUsd
      : DEFAULT_MONTHLY_ENVELOPE_USD;
  const month = ym(now);
  let spentCents = 0;
  for (const op of ledger.ops) {
    if (typeof op === 'object' && op !== null && typeof (op as SpendOp).month === 'string' && (op as SpendOp).month === month) {
      spentCents += Math.round((op as SpendOp).cost * 100);
    }
  }
  const envelopeCents = Math.round(envelope * 100);
  return {
    envelopeUsd: envelope,
    month,
    monthSpendUsd: spentCents / 100,
    remainingUsd: (envelopeCents - spentCents) / 100,
  };
}

/** Append one spend op (ts/month computed here) and persist atomically. */
export function appendSpend(registryDir: string, op: SpendOpInput, now: Date = new Date()): void {
  if (typeof op !== 'object' || op === null) fail('spend op is required');
  if (!SERVICES.includes(op.service)) {
    fail(`unknown spend service '${String(op.service)}' (valid: ${SERVICES.join(', ')})`);
  }
  if (typeof op.cost !== 'number' || !Number.isFinite(op.cost) || op.cost <= 0) {
    fail(`spend cost must be a positive finite number (got ${String(op.cost)}) — over-inflated or free ops are rejected (T-03-03)`);
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
      `DataForSEO monthly budget exhausted: remaining $${b.remainingUsd.toFixed(2)} < required $${maxAddlUsd.toFixed(2)} for month ${b.month} — raise monthlyEnvelopeUsd in content/keywords/spend-ledger.json or wait for monthly rollover (D-02)`,
    );
  }
  return b;
}
