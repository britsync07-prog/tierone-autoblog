// Expander stage (PIPE-01, plan 03-02): owner-seeded topics -> per-geo keyword
// candidates governed by D-01/D-02/D-04/D-05/D-06/D-07/D-09.
//
// Flow (sequential, never parallel API bursts):
//   PASS 1 (resume): leftover 'expanded' entries from an interrupted run are
//     completed from their persisted US metrics (no keyword-ideas re-billing)
//     + one SERP pull when no serpTop3 exists yet — idemposite continuation.
//   PASS 2 (seed queue): seed-topics.json drives the D-01 queue. Topics that
//     already have any entry (candidates or a rejected seed marker) in their
//     shard are skipped — no re-billing (D-02 cache-everything; the id-dedupe
//     marker for zero-candidate topics lives in the rejected entry itself).
//   Per topic: one keyword_ideas call per geo is applied here (US discovery +
//   UK/CA/AU per-geo metrics fetch). The planner's "batch all four geos in one
//   call" default is impossible on Labs keyword_ideas live — each Live call
//   holds exactly one task (documented in lib/pipeline/dataforseo.ts header).
//   US carries the D-04 filter (kd < 20, 500 <= volume <= 5000) and the only
//   SERP pulls; UK/CA/AU results only survive into the geo map (D-07).
//   Budget: assertSpendable($2 headroom) BEFORE each topic's calls
//   (spend-first appends happen inside the DataForSEO client), and a run
//   reserve halt when remainingUsd < $5 (task-3 guard: headroom for a second
//   partial run). BudgetExhaustedError mid-run => partial results + note.
//
// Key links (plan <interfaces>): registry listPromotable/advance/reject via
// ctx.registry; budget assertSpendable via ctx.budget; seed-topics.json queue.
// MissingCredentialsError/DataForSeoApiError propagate untouched (auth gate).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BudgetExhaustedError } from '../budget';
import { keywordIdeas as keywordIdeasRaw, serpTop as serpTopRaw } from '../dataforseo';
import type { DataForSeoClient, KeywordIdea } from '../dataforseo';
import { GEO_CODES } from '../types';
import type { GeoCode, GeoMetrics, RegistryEntry, SerpResult } from '../types';
import type { RegistryApi, StageContext, StageResult } from '../run';
import type { SiloSlug } from '../../silos';

/** Headroom reserved before each topic's keyword-ideas batch (plan task 2:
 * "~ $2" — comfortably over four geo calls at any plausible per-call cost).*/
export const EXPAND_HEADROOM_USD = 2;

/** Run-level halt (plan task 3): stop the backfill when remainingUsd < $5 so a
 * second partial run always has headroom. */
export const MIN_RUN_RESERVE_USD = 5;

/** D-05 overlap threshold: >= 60% shared top-3 URLs = near-cannibal. */
export const NEAR_CANNIBAL_OVERLAP = 0.6;

/** D-04 hard thresholds (US = single-locale publish target). */
const KD_MAX = 20;
const VOLUME_MIN = 500;
const VOLUME_MAX = 5000;

/** Candidate id contract (registry.ts: slug-safe, <= 5 segments, <= 120). */
const ID_MAX_SEGMENTS = 5;
const ID_MAX_LEN = 120;

/** Stage-local DFS surface — injection seam for fixture tests; defaults to
 * the module-singleton calls in ../dataforseo (real Basic-auth client). */
export interface ExpandDfs {
  keywordIdeas: DataForSeoClient['keywordIdeas'];
  serpTop: DataForSeoClient['serpTop'];
}

const DEFAULT_DFS: ExpandDfs = {
  keywordIdeas: (topic, geo, dir) => keywordIdeasRaw(topic, geo, dir),
  serpTop: (keyword, geo, dir) => serpTopRaw(keyword, geo, dir),
};

interface SeedTopics {
  [silo: string]: string[] | undefined;
}

function readSeedTopics(registryDir: string): SeedTopics {
  const file = join(registryDir, 'seed-topics.json');
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`seed topics unreadable at ${file} — D-01 queue cannot start (did content/keywords/seed-topics.json get lost?)`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`seed-topics at ${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const topics = (parsed as { topics?: SeedTopics } | null)?.topics;
  if (typeof topics !== 'object' || topics === null) {
    throw new Error(`seed-topics at ${file} has no topics map`);
  }
  return topics;
}

/** Slug-safe registry id: [a-z0-9(-)] only, max 5 segments, max 120 chars
 * (T-03-01: no path traversal possible through candidate ids). */
function slugId(raw: string): string {
  const parts = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .slice(0, ID_MAX_SEGMENTS);
  const slug = parts.join('-').slice(0, ID_MAX_LEN);
  return slug.replace(/^-+|-+$/g, '') || 'seed-topic';
}

/** Canonical URL token for D-05 comparison: lowercase host (www. stripped) +
 * path (trailing slashes stripped). Non-URL strings fall back to lowercased
 * raw — comparison only ever reads, never executes (T-03-06). */
function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return url.toLowerCase();
  }
}

/** D-04 reject reason for a candidate's US metrics, or null when it passes. */
function d04RejectReason(metrics: { volume: number; kd?: number }): string | null {
  if (typeof metrics.kd !== 'number') return `KD unknown (API null) — can not verify D-04`;
  if (metrics.kd >= KD_MAX) return `KD ${metrics.kd} > ${KD_MAX}`;
  if (metrics.volume < VOLUME_MIN) return `volume ${metrics.volume} < ${VOLUME_MIN}`;
  if (metrics.volume > VOLUME_MAX) return `volume ${metrics.volume} > ${VOLUME_MAX}`;
  return null;
}

function toMetrics(idea: KeywordIdea): GeoMetrics {
  return { volume: idea.volume, kd: idea.kd, cpc: idea.cpc };
}

function candidateUrls(top: SerpResult[] | undefined): string[] {
  return (top ?? []).map((r) => canonicalUrl(r.url));
}

/** D-05 reject string when mine >= 60% overlaps an existing silo-mate. */
function nearCannibalWith(mine: string[], existing: RegistryEntry): string | null {
  const theirs = candidateUrls(existing.serpTop3);
  if (mine.length === 0 || theirs.length === 0) return null;
  const set = new Set(theirs);
  const shared = mine.filter((u) => set.has(u)).length;
  if (shared / Math.min(mine.length, theirs.length) >= NEAR_CANNIBAL_OVERLAP) {
    return `near-cannibal: >=60% overlap with ${existing.id}`;
  }
  return null;
}

/** Persist a detached (listPromotable-loaded) entry back into its silo shard
 * by id: replace in place, or append when the object is not yet on disk. */
function persistEntryState(registry: RegistryApi, silo: SiloSlug, entry: RegistryEntry): void {
  const shard = registry.loadShard(silo);
  const idx = shard.keywords.findIndex((e) => e.id === entry.id);
  if (idx >= 0) shard.keywords[idx] = entry;
  else shard.keywords.push(entry);
  shard.updatedAt = new Date().toISOString();
  registry.saveShard(silo, shard);
}

interface CompletionCounts {
  advanced: number;
  rejected: number;
}

/** PASS 1: finish one leftover 'expanded' entry using its persisted state —
 * zero keyword-ideas re-billing; at most one SERP pull (D-05 only when the
 * interrupted run had not captured serpTop3 yet). */
async function completeLeftover(
  registry: RegistryApi,
  silo: SiloSlug,
  entry: RegistryEntry,
  dfs: ExpandDfs,
  registryDir: string,
  nowIso: string,
): Promise<CompletionCounts> {
  const usMetrics = entry.geo?.us;
  const failReason =
    usMetrics === undefined
      ? 'US metrics missing after interrupted run — rejected instead of silently advancing (fail-closed)'
      : d04RejectReason(usMetrics);
  if (failReason !== null) {
    registry.reject(entry, failReason);
    persistEntryState(registry, silo, entry);
    return { advanced: 0, rejected: 1 };
  }

  if (!Array.isArray(entry.serpTop3) || entry.serpTop3.length === 0) {
    const serp = await dfs.serpTop(entry.keyword, 'us', registryDir);
    entry.serpTop3 = serp.top;
    entry.serpAsOf = nowIso;
    entry.paa = serp.paa;
  }

  const shard = registry.loadShard(silo);
  const mine = candidateUrls(entry.serpTop3);
  const cannibal = shard.keywords.find(
    (other) => other.stage === 'filtered' && other.id !== entry.id && nearCannibalWith(mine, other) !== null,
  );
  if (cannibal !== undefined) {
    registry.reject(entry, `near-cannibal: >=60% overlap with ${cannibal.id}`);
  } else {
    registry.advance(entry, 'filtered');
  }
  persistEntryState(registry, silo, entry);
  return { advanced: cannibal === undefined ? 1 : 0, rejected: cannibal === undefined ? 0 : 1 };
}

/** PASS 2: expand one seed topic into candidates (D-01/D-04/D-05/D-07). */
async function processSeedTopic(
  ctx: StageContext,
  dfs: ExpandDfs,
  silo: SiloSlug,
  topic: string,
): Promise<CompletionCounts> {
  const { registry, registryDir } = ctx;
  let advanced = 0;
  let rejected = 0;
  const ts = new Date().toISOString();

  const usIdeas = await dfs.keywordIdeas(topic, 'us', registryDir);

  if (usIdeas.length === 0) {
    // Zero-candidate topic: write the seed itself as a *rejected marker*
    // entry so (a) the rejection is visible (D-04) and (b) id-dedupe makes
    // reruns skip it — never re-billing (D-02).
    const shard = registry.loadShard(silo);
    if (!shard.keywords.some((e) => e.seedTopic === topic)) {
      const seedEntry: RegistryEntry = {
        id: slugId(topic),
        keyword: topic,
        silo,
        stage: 'rejected',
        seedTopic: topic,
        createdAt: ts,
        updatedAt: ts,
        rejectionReason: 'keyword_ideas returned 0 candidates for seed topic (US)',
      };
      shard.keywords.push(seedEntry);
      shard.updatedAt = ts;
      registry.saveShard(silo, shard);
      rejected += 1;
    }
    return { advanced, rejected };
  }

  // D-07 per-geo metrics: same seed topic per geo, matched by keyword.
  const geoIdeas = new Map<Exclude<GeoCode, 'us'>, KeywordIdea[]>();
  for (const geo of GEO_CODES) {
    if (geo === 'us') continue;
    geoIdeas.set(geo, await dfs.keywordIdeas(topic, geo, registryDir));
  }

  let shard = registry.loadShard(silo);
  const usedIds = new Set<string>(shard.keywords.map((e) => e.id));

  for (const idea of usIdeas) {
    const id = slugId(idea.keyword);
    if (usedIds.has(id)) continue; // same keyword surfaced by another topic — no duplicate entry
    usedIds.add(id);

    const entry: RegistryEntry = {
      id,
      keyword: idea.keyword,
      silo,
      stage: 'expanded',
      seedTopic: topic,
      createdAt: ts,
      updatedAt: ts,
      geo: { us: toMetrics(idea) },
      metricsAsOf: ts,
    };
    for (const geo of GEO_CODES) {
      if (geo === 'us') continue;
      const scale = geoIdeas.get(geo)?.find((i) => i.keyword.toLowerCase() === idea.keyword.toLowerCase());
      if (scale) entry.geo![geo] = toMetrics(scale); // geo.us set at creation — Partial geo map
    }

    const filterReason = d04RejectReason(toMetrics(idea));
    if (filterReason !== null) {
      registry.reject(entry, filterReason);
      shard.keywords.push(entry);
      shard.updatedAt = ts;
      registry.saveShard(silo, shard);
      rejected += 1;
      continue;
    }

    // D-05: exactly ONE SERP pull per candidate check (US publish locale).
    const serp = await dfs.serpTop(idea.keyword, 'us', registryDir);
    entry.serpTop3 = serp.top;
    entry.serpAsOf = ts;
    entry.paa = serp.paa;

    const mine = candidateUrls(entry.serpTop3);
    const cannibal = shard.keywords.find(
      (other) => other.stage === 'filtered' && other.id !== entry.id && nearCannibalWith(mine, other) !== null,
    );
    if (cannibal !== undefined) {
      registry.reject(entry, `near-cannibal: >=60% overlap with ${cannibal.id}`);
      rejected += 1;
    } else {
      registry.advance(entry, 'filtered');
      advanced += 1;
    }

    shard.keywords.push(entry); // save after EVERY candidate (crash-safe, D-09)
    shard.updatedAt = ts;
    registry.saveShard(silo, shard);
  }

  ctx.log(`topic '${topic}': ${advanced} filtered, ${rejected} rejected`);
  return { advanced, rejected };
}

/**
 * Stage entrypoint (Plan 03-01 contract): `runStage(ctx) -> StageResult`.
 * `dfs` is an optional injection seam (fixture probes); production callers
 * omit it and the real DataForSEO client is used.
 */
export async function runStage(ctx: StageContext, dfs: ExpandDfs = DEFAULT_DFS): Promise<StageResult> {
  const { registry, budget, log } = ctx;
  const sequentialSeeds = readSeedTopics(ctx.registryDir);

  let advanced = 0;
  let rejected = 0;
  let skipped = 0;
  let pending = 0;
  let stopped = false;
  const notes: string[] = [];
  const spendBefore = budget.readBudget().monthSpendUsd;

  for (const silo of registry.silos) {
    // PASS 1 — crash-artifact leftovers complete first, regardless of the
    // seed queue state (interrupted topics must not lie half-processed).
    const leftovers = registry.listPromotable('expanded', 'filtered', 10_000).filter((e) => e.silo === silo);
    for (const leftover of leftovers) {
      const step = await completeLeftover(registry, silo, leftover, dfs, ctx.registryDir, new Date().toISOString());
      advanced += step.advanced;
      rejected += step.rejected;
    }

    const topics = sequentialSeeds[silo];
    if (!Array.isArray(topics) || topics.length === 0) {
      notes.push(`seed-topics has no usable topics for silo '${silo}' — skipped`);
      continue;
    }

    // D-02 cache rule: any entry seeded from this topic (candidates or the
    // zero-candidate marker) makes the topic processed — reruns skip it.
    const processed = new Set(
      registry
        .loadShard(silo)
        .keywords.map((e) => e.seedTopic)
        .filter((t): t is string => typeof t === 'string' && t.length > 0),
    );

    for (const topic of topics) {
      if (processed.has(topic)) {
        skipped += 1;
        continue;
      }

      // Task-3 guard: leave $5 headroom for a second partial run.
      const remaining = budget.readBudget().remainingUsd;
      if (remaining < MIN_RUN_RESERVE_USD) {
        notes.push(`remaining $${remaining.toFixed(2)} below the $${MIN_RUN_RESERVE_USD.toFixed(2)} run reserve — halting early`);
        stopped = true;
        break;
      }

      // T-03-04: gate the batch BEFORE its calls; the client records real
      // response `cost` spend-first, which can only move the ledger further
      // over the headroom, never silently.
      try {
        budget.assertSpendable(EXPAND_HEADROOM_USD);
      } catch (err) {
        if (err instanceof BudgetExhaustedError) {
          notes.push('budget envelope exhausted — halting expansion');
          stopped = true;
          break;
        }
        throw err;
      }

      const step = await processSeedTopic(ctx, dfs, silo, topic);
      advanced += step.advanced;
      rejected += step.rejected;
    }

    if (stopped) break;
  }

  if (stopped) {
    for (const silo of registry.silos) {
      const topics = sequentialSeeds[silo];
      if (!Array.isArray(topics)) continue;
      const processed = new Set(
        registry.loadShard(silo).keywords.map((e) => e.seedTopic).filter((t): t is string => typeof t === 'string' && t.length > 0),
      );
      pending += topics.filter((t) => !processed.has(t)).length;
    }
    if (pending > 0) notes.push(`${pending} topics remain unprocessed after the halt`);
  }

  if (skipped > 0) notes.push(`${skipped} topics skipped — already expanded (no re-billing, D-02 cache rule)`);
  const spendAfter = budget.readBudget().monthSpendUsd;
  const spentUsd = Math.round((spendAfter - spendBefore) * 10_000) / 10_000;
  if (spentUsd > 0) notes.push(`spend recorded this run: $${spentUsd.toFixed(4)}`);

  return { advanced, rejected, spentUsd, notes };
}
