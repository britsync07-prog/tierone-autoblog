// Keyword registry IO + stage-machine governance (PIPE-01, D-08/D-09/D-04).
//
// The registry lives as git-committed per-silo JSON shards under
// content/keywords/{silo}/registry.json (D-08: no DB in v1, small diffs, no
// cross-silo clobbering). Every load must pass write-through validation so a
// malformed/hand-edited shard fails closed instead of feeding downstream
// stages (D-04: rejected entries must carry a visible reason — no silent
// discards). This is pipeline-internal: the Next app must never import it.
//
// SECURITY (T-03-01): silo names are whitelisted against SILO_SLUGS (single
// source lib/silos.ts) and resolved silo dirs are prefix-checked against the
// registry dir before any read/write, so shard paths can never escape it.

import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep, isAbsolute } from 'node:path';
import { SILO_SLUGS, type SiloSlug } from '../silos';
import type { RegistryEntry, RegistryShard, RegistryStage } from './types';

/** Progression order (D-09). `drafted` is the acceptance point of the chain;
 * `rejected` is terminal and handled by reject(). */
export const STAGE_CHAIN: readonly RegistryStage[] = [
  'expanded',
  'filtered',
  'briefed',
  'outlined',
  'drafted',
];

/** Slug-safe id contract from the type comment:
 * /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/ trimmed to <=120 chars. Enforced on load
 * AND by the zero-dep check gate so ids can never smuggle path segments. */
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/;
const ID_MAX = 120;

function fail(message: string): never {
  throw new Error(message);
}

function assertSilo(silo: SiloSlug): void {
  if (!SILO_SLUGS.includes(silo)) {
    fail(`unknown silo '${String(silo)}' (valid: ${SILO_SLUGS.join(', ')})`);
  }
}

/** RegistryDir defaults to `<repo>/content/keywords` — callers pass the dir
 * explicitly (runner does; tests pass fixture dirs). */
function shardPath(registryDir: string, silo: SiloSlug): string {
  const dir = resolve(registryDir);
  const siloDir = isAbsolute(silo) ? silo : resolve(dir, silo);
  if (siloDir !== dir && !siloDir.startsWith(dir + sep)) {
    fail(`silo path escapes registry directory: ${siloDir}`);
  }
  return siloDir;
}

function isNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Write-through entry validation applied by loadShard (tasks rule set). */
function validateEntry(silo: SiloSlug, entry: unknown, file: string, index: number): RegistryEntry {
  const ctx = `shard ${file} entry[${index}]`;
  if (typeof entry !== 'object' || entry === null) fail(`${ctx}: entry is not an object`);
  const e = entry as RegistryEntry;

  if (!isNonEmpty(e.id) || !ID_RE.test(e.id) || e.id.length > ID_MAX) {
    fail(`${ctx}: id '${String(e.id)}' is not a slug-safe registry id (max ${ID_MAX} chars)`);
  }
  if (!isNonEmpty(e.keyword)) fail(`${ctx} (${e.id}): keyword is required`);
  if (e.silo !== silo) fail(`${ctx} (${e.id}): entry.silo '${String(e.silo)}' != shard silo '${silo}'`);

  const stageIdx = STAGE_CHAIN.indexOf(e.stage);
  if (e.stage === 'rejected') {
    // rejected is terminal; reason is D-04's visible data trail requirement
    if (!isNonEmpty(e.rejectionReason)) {
      fail(`${ctx} (${e.id}): stage 'rejected' requires a non-empty rejectionReason`);
    }
  } else if (e.stage === 'quarantined') {
    if (!e.quarantine || !isNonEmpty(e.quarantine.failedRule) || !isNonEmpty(e.quarantine.reportPath)) {
      fail(`${ctx} (${e.id}): stage 'quarantined' requires quarantine.failedRule and quarantine.reportPath`);
    }
  } else if (e.stage === 'published') {
    if (!isNonEmpty(e.draft?.slug)) {
      fail(`${ctx} (${e.id}): stage 'published' requires draft.slug`);
    }
    if (!isNonEmpty(e.qa?.passedAt)) {
      fail(`${ctx} (${e.id}): stage 'published' requires qa.passedAt`);
    }
  } else if (stageIdx === -1) {
    fail(`${ctx} (${e.id}): unknown stage '${String(e.stage)}' (vocabulary: ${STAGE_CHAIN.join(' -> ')}, quarantined, published, rejected)`);
  } else {
    // Promoted stages carry the proof of each completed stage (D-04).
    if (stageIdx >= STAGE_CHAIN.indexOf('briefed') && !isNonEmpty(e.brief?.completedAt)) {
      fail(`${ctx} (${e.id}): stage '${e.stage}' requires brief.completedAt`);
    }
    if (stageIdx >= STAGE_CHAIN.indexOf('outlined')) {
      if (!e.outline || e.outline.lint !== 'pass') {
        fail(`${ctx} (${e.id}): stage '${e.stage}' requires outline.lint === 'pass'`);
      }
    }
    if (e.stage === 'drafted' && !isNonEmpty(e.draft?.slug)) {
      fail(`${ctx} (${e.id}): stage 'drafted' requires draft.slug`);
    }
  }

  if (e.images && !(isNonEmpty(e.images.hero.src) && isNonEmpty(e.images.hero.alt))) {
    fail(`${ctx} (${e.id}): images require non-empty hero.src and hero.alt`);
  }
  if (e.stage !== 'rejected' && !isNonEmpty(e.createdAt)) {
    fail(`${ctx} (${e.id}): createdAt is required`);
  }
  if (e.stage !== 'rejected' && !isNonEmpty(e.updatedAt)) {
    fail(`${ctx} (${e.id}): updatedAt is required`);
  }
  return e;
}

export function loadShard(registryDir: string, silo: SiloSlug): RegistryShard {
  assertSilo(silo);
  const dir = shardPath(registryDir, silo);
  const file = join(dir, 'registry.json');

  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    fail(`registry shard missing/unreadable: ${file}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`registry shard is not valid JSON (${file}): ${err instanceof Error ? err.message : String(err)}`);
  }

  const shard = parsed as RegistryShard;
  if (typeof shard !== 'object' || shard === null || shard.version !== 1) {
    fail(`registry shard ${file}: version must be 1`);
  }
  if (!Array.isArray(shard.keywords)) fail(`registry shard ${file}: keywords must be an array`);
  if (!isNonEmpty(shard.updatedAt)) fail(`registry shard ${file}: updatedAt is required`);
  shard.keywords.forEach((entry, i) => validateEntry(silo, entry, file, i));
  return shard;
}

export function saveShard(registryDir: string, silo: SiloSlug, shard: RegistryShard): void {
  assertSilo(silo);
  const dir = shardPath(registryDir, silo);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'registry.json');
  const tmp = join(dir, 'registry.json.tmp');
  // Atomic write: tmp + rename in the same directory keeps a crash from
  // ever leaving a half-written (or deleted) shard behind.
  writeFileSync(tmp, `${JSON.stringify(shard, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}

/** Scan all 5 shards and return every entry currently at `stage`. */
export function listByStage(registryDir: string, stage: RegistryStage): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const silo of SILO_SLUGS) {
    for (const entry of loadShard(registryDir, silo).keywords) {
      if (entry.stage === stage) out.push(entry);
    }
  }
  return out;
}

/**
 * Entries at stage `from` that may be advanced to `to`, oldest-updated first.
 * `limit` defaults to 1 (D-09 slot rule: one promotion per silo-pass per run;
 * stage modules drive silo round-robin by calling per silo-head rotation and
 * re-listing with a larger limit when they persist candidates).
 */
export function listPromotable(
  registryDir: string,
  from: RegistryStage,
  to: RegistryStage,
  limit = 1,
): RegistryEntry[] {
  if (!Number.isInteger(limit) || limit < 1) fail(`listPromotable limit must be a positive integer (got ${limit})`);
  assertTransitionStage(from, to);
  const out: RegistryEntry[] = [];
  for (const silo of SILO_SLUGS) {
    for (const entry of loadShard(registryDir, silo).keywords) {
      if (entry.stage === from) out.push(entry);
    }
  }
  out.sort((a, b) => {
    const byDate = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    if (!Number.isNaN(byDate) && byDate !== 0) return byDate;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out.slice(0, limit);
}

/** Legal transitions: exactly +1 in STAGE_CHAIN, to 'quarantined' from 'drafted', to 'published' from 'drafted' or 'quarantined', or to terminal 'rejected'. */
export function assertTransitionStage(from: RegistryStage, to: RegistryStage): void {
  if (to === 'rejected') return;
  if (to === 'quarantined') {
    if (from !== 'drafted' && from !== 'published') {
      fail(`invalid stage transition '${from}' -> 'quarantined' (only 'drafted' or 'published' entries can be quarantined)`);
    }
    return;
  }
  if (to === 'published') {
    if (from !== 'drafted' && from !== 'quarantined') {
      fail(`invalid stage transition '${from}' -> 'published' (only 'drafted' or 'quarantined' entries can be published)`);
    }
    return;
  }
  const fromIdx = STAGE_CHAIN.indexOf(from);
  const toIdx = STAGE_CHAIN.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) {
    fail(`unknown stage in transition '${String(from)}' -> '${String(to)}'`);
  }
  if (toIdx !== fromIdx + 1) {
    fail(`invalid stage transition '${from}' -> '${to}' (only +1 in chain allowed)`);
  }
}

/**
 * Advance an entry through the stage machine: sets stage + updatedAt.
 * Throws on any illegal transition (only +1 in chain, or to 'rejected' —
 * where a non-empty reason must already exist; use reject() for that path).
 */
export function advance(entry: RegistryEntry, to: RegistryStage): RegistryEntry {
  assertTransitionStage(entry.stage, to);
  if (to === 'rejected' && !isNonEmpty(entry.rejectionReason)) {
    fail(`advance to 'rejected' requires a rejectionReason — use reject(entry, reason)`);
  }
  entry.stage = to;
  entry.updatedAt = new Date().toISOString();
  return entry;
}

/** Terminal reject with a required non-empty reason (D-04 visible trail). */
export function reject(entry: RegistryEntry, reason: string): RegistryEntry {
  if (!isNonEmpty(reason)) {
    fail(`rejectionReason must be non-empty (got '${String(reason)}')`);
  }
  entry.stage = 'rejected';
  entry.rejectionReason = reason;
  entry.updatedAt = new Date().toISOString();
  return entry;
}

/** Quarantine a drafted entry with structured failure info (D-01/D-02). */
export function quarantineEntry(
  entry: RegistryEntry,
  info: NonNullable<RegistryEntry['quarantine']>,
): RegistryEntry {
  assertTransitionStage(entry.stage, 'quarantined');
  if (!isNonEmpty(info.failedRule)) {
    fail('quarantineEntry requires a non-empty failedRule');
  }
  if (!isNonEmpty(info.reportPath)) {
    fail('quarantineEntry requires a non-empty reportPath');
  }
  entry.stage = 'quarantined';
  entry.quarantine = {
    ...info,
    quarantinedAt: info.quarantinedAt || new Date().toISOString(),
  };
  entry.updatedAt = new Date().toISOString();
  return entry;
}

/** Mark a drafted or restored entry as published with timestamp (Plan 05-02). */
export function publishEntry(entry: RegistryEntry): RegistryEntry {
  assertTransitionStage(entry.stage, 'published');
  if (!isNonEmpty(entry.draft?.slug)) {
    fail(`publishEntry (${entry.id}): requires draft.slug`);
  }
  if (!isNonEmpty(entry.qa?.passedAt)) {
    fail(`publishEntry (${entry.id}): requires qa.passedAt`);
  }
  entry.stage = 'published';
  entry.publishedAt = new Date().toISOString();
  entry.updatedAt = new Date().toISOString();
  return entry;
}
