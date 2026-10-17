// Expander stage (PIPE-01, plan 03-02): owner-seeded topics -> per-geo keyword
// candidates governed by D-01/D-05/D-06/D-07/D-09 — REWORKED (2026-10-17) for
// the ⚠ OWNER FULLY-FREE DIRECTIVE: no third-party paid APIs, ever. The
// DataForSEO client and its KD/gates are gone; keyword intelligence comes from
// the keyless in-house sources in ../free-keywords (anonymous per-geo Google
// autocomplete + Google Trends public explore + anonymous free SERP HTML —
// Bing engine, since Google's keyless SERP renders no organic markup). Budget governance survived as a monthly REQUEST-cap governor
// (assertRequestsAvailable hard-stop; the USD ledger ops are always $0).
//
// Flow (sequential, never parallel API bursts):
//   PASS 1 (resume): leftover 'expanded' entries from interrupted runs are
//     re-gated from their persisted freeSignal evidence and completed with at
//     most one SERP pull when serpTop3 is missing — idempotent continuation.
//   PASS 2 (seed queue): seed-topics.json drives the D-01 queue. Topics that
//     already have any entry (candidates or a rejected seed marker) in their
//     shard are skipped (D-02 cache rule; id-dedupe marker lives in the
//     rejected entry itself).
//   Per topic: one autocomplete call per geo (US discovery + UK/CA/AU per-geo
//   capture, D-07). Candidates ranked by public suggestion position (1-based). US
//   carries the four free-signal proxy gates (⚠ replaces KD<20 / 500-5k
//   volume, which are NOT free) and the only SERP pull; UK/CA/AU only add per-
//   geo autocomplete rank evidence.
//   Gates (all mechanical, all reasons visible — D-04 "no silent discards"):
//     G1 autocomplete rank <= 8 (US list)
//     G2 keyword shape 2-8 words (long-tail discipline)
//     G3 article-worthy intent (question / comparison / best / review /
//        alternatives / guide forms)
//     G4 trend interest >= 5 over the 3-month public window when Google
//        Trends delivers; when Trends is unavailable the candidate passes
//        WITH the absence note recorded (honest-empty policy — never fabricate)
//     G5 D-05 anti-cannibalization UNCHANGED: >= 60% top-3 URL overlap with an
//        existing filtered silo-mate rejects as near-cannibal (one SERP pull).
//   Request budget: assertRequestsAvailable(~20) BEFORE each topic's calls;
//   a run-reserve halt when remainingRequests < 50 (headroom for a second
//   partial run, mirroring the old $5 reserve). BudgetExhaustedError mid-run
//   => partial results + visible note.
//
// Honest-failure policy (⚠ directive): a free source that is momentarily
// blocked (403/429) is retried politely inside ../free-keywords; a
// persistently unavailable source yields ok:false with the exact reason —
// candidates whose evidence is missing are either rejected with the reason
// recorded or left at 'expanded' for a later run. NEVER fabricated.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BudgetExhaustedError } from '../budget';
import {
  topicSuggestions as topicSuggestionsRaw,
  trendInterest as trendInterestRaw,
  serpTop as serpTopRaw,
  normalizeSuggestion,
} from '../free-keywords';
import type { SerpCapture, SuggestionBatch, TrendCapture } from '../free-keywords';
import { GEO_CODES } from '../types';
import type { GeoCode, RegistryEntry } from '../types';
import type { RegistryApi, StageContext, StageResult } from '../run';
import type { SiloSlug } from '../../silos';

/** Headroom reserved before each topic's keyless-source batch (requests).
 * Worst case: 4 autocomplete + 3 survivors × (1 SERP + 1 trends handshake
 * *2 calls*) ≈ 13; 20 leaves polite slack for retries inside the sources. */
export const EXPAND_HEADROOM_REQUESTS = 20;

/** Run-level halt: stop the run when fewer than 50 free-source requests
 * remain this month so a second partial run always has headroom. */
export const MIN_RUN_RESERVE_REQUESTS = 50;

/** D-05 overlap threshold: >= 60% shared top-3 URLs = near-cannibal
 * (UNCHANGED — deterministic gate survives the free-source swap verbatim). */
export const NEAR_CANNIBAL_OVERLAP = 0.6;

/** ⚠ FREE-SIGNAL PROXY GATES (replaces KD<20 / 500-5k volume, which are not
 * free; owner directive deviates ROADMAP SC #1 wording by design):
 *   AUTOCOMPLETE_MAX_RANK — only the top-8 public suggestions carry a strong
 *     "Google surfaces this for the query" relevance signal;
 *   word window 2-8 — long-tail shape discipline (Project long-tail-first);
 *   MIN_TREND_INTEREST — Trends mean below 5 on a 0-100 scale = no audience. */
export const AUTOCOMPLETE_MAX_RANK = 8;
export const KEYWORD_MIN_WORDS = 2;
export const KEYWORD_MAX_WORDS = 8;
export const MIN_TREND_INTEREST = 5;

const OVERRIDE_WORDING =
  '⚠ free-signal proxy gate (replaces KD/volume gates per owner fully-free directive)';

/** Candidate id contract (registry.ts: slug-safe, <= 5 segments, <= 120). */
const ID_MAX_SEGMENTS = 5;
const ID_MAX_LEN = 120;

/** Stage-local free-source surface — injection seam for fixture tests;
 * defaults to the module-singleton calls in ../free-keywords (real keyless
 * sources). */
export interface ExpandSources {
  topicSuggestions: (topic: string, geo: GeoCode, registryDir: string) => Promise<SuggestionBatch>;
  trendInterest: (keyword: string, geo: GeoCode, registryDir: string) => Promise<TrendCapture>;
  serpTop: (keyword: string, geo: GeoCode, registryDir: string) => Promise<SerpCapture>;
}

const DEFAULT_SOURCES: ExpandSources = {
  topicSuggestions: (topic, geo, dir) => topicSuggestionsRaw(topic, geo, dir),
  trendInterest: (keyword, geo, dir) => trendInterestRaw(keyword, geo, dir),
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

function candidateUrls(top: RegistryEntry['serpTop3']): string[] {
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

/** Article-worthiness intent forms (G3): question-form keywords, comparisons,
 * best-pick lists, reviews, alternatives, guides, tutorials — the article
 * shapes Phase 3's topics actually publish. Purely informational single
 * nouns ("sudowrite") are left to the broader silo hubs instead. */
export function hasArticleIntent(keyword: string): boolean {
  const k = keyword.toLowerCase();
  if (/^(how|what|why|when|where|which|who|is|are|can|should|does|do)\b/.test(k)) return true;
  if (/\bvs\b|\bversus\b/.test(k)) return true;
  if (/\b(review|reviews|comparison|comparisons|alternatives?)\b/.test(k)) return true;
  if (/^best\b/.test(k)) return true;
  if (/\b(guide|tutorial|explained|help)\b/.test(k)) return true;
  return false;
}

/** Deterministic free-signal gate evaluation (G1/G2/G3 + breadth from the
 * topic's autocomplete batch + G4 from the measured trend when Trends
 * delivered). Returns null when every gate passes; the returned string is the
 * candidate's visible rejection reason. Expects the persisted per-geo
 * autocomplete evidence — missing evidence fails CLOSED (never guessed). */
export function freeGateReason(fs: {
  autocomplete: { rank: number };
  breadth: number;
  trend?: { interest: number; asOf: string } | { note: string };
  keyword: string;
}): string | null {
  if (typeof fs.autocomplete.rank !== 'number' || fs.autocomplete.rank < 1) {
    return 'free-signal evidence missing (no per-geo autocomplete rank) — re-expansion required';
  }
  if (fs.autocomplete.rank > AUTOCOMPLETE_MAX_RANK) {
    return `autocomplete rank ${fs.autocomplete.rank} beyond top-${AUTOCOMPLETE_MAX_RANK} (G1) — ${OVERRIDE_WORDING}`;
  }
  const words = fs.keyword.trim().split(/\s+/).length;
  if (words < KEYWORD_MIN_WORDS || words > KEYWORD_MAX_WORDS) {
    return `keyword shape ${words} words outside the ${KEYWORD_MIN_WORDS}-${KEYWORD_MAX_WORDS} long-tail window (G2) — ${OVERRIDE_WORDING}`;
  }
  if (!hasArticleIntent(fs.keyword)) {
    return `no article-worthy intent signal (G3: question/comparison/best/review/alternatives/guide form absent) — ${OVERRIDE_WORDING}`;
  }
  if (fs.breadth < 5) {
    return `topic expansion breadth too low (G2 breadth ${fs.breadth} suggestions) — ${OVERRIDE_WORDING}`;
  }
  const trend = fs.trend;
  if (trend && typeof (trend as { note?: string }).note === 'string') {
    // honest absence recorded on the entry — gate passes on remaining proxies
    return null;
  }
  if (trend && typeof (trend as { interest: number }).interest === 'number') {
    const interest = (trend as { interest: number }).interest;
    if (interest < MIN_TREND_INTEREST) {
      return `trend interest ${interest} below ${MIN_TREND_INTEREST} (G4, 3-month public window) — ${OVERRIDE_WORDING}`;
    }
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
  pending: number;
}

/** PASS 1: finish one leftover 'expanded' entry from persisted evidence —
 * zero new trend/autocomplete spend (D-06: gates re-run on what was captured);
 * at most one new SERP pull when serpTop3 is missing. */
async function completeLeftover(
  registry: RegistryApi,
  silo: SiloSlug,
  entry: RegistryEntry,
  sources: ExpandSources,
  registryDir: string,
): Promise<CompletionCounts> {
  const fs = entry.freeSignal;
  const rank = fs?.autocomplete?.us?.rank;
  const failReason =
    fs === undefined || typeof rank !== 'number'
      ? 'leftover without free-signal evidence — rejected instead of silently advancing (fail-closed)'
      : freeGateReason({ autocomplete: { rank }, breadth: fs.breadth ?? 0, trend: fs.trend, keyword: entry.keyword });
  if (failReason !== null) {
    registry.reject(entry, failReason);
    persistEntryState(registry, silo, entry);
    return { advanced: 0, rejected: 1, pending: 0 };
  }

  if (!Array.isArray(entry.serpTop3) || entry.serpTop3.length === 0) {
    const serp = await sources.serpTop(entry.keyword, 'us', registryDir);
    if (!serp.ok) {
      // honest absence: leave at 'expanded' with the reason on the entry —
      // a later run's PASS 1 retries the pull (idempotent, never fabricated)
      entry.updatedAt = new Date().toISOString();
      entry.freeSignal = {
        ...entry.freeSignal,
        trend: entry.freeSignal?.trend ?? { note: 'trend signal not re-read on leftover pass' },
      };
      persistEntryState(registry, silo, entry);
      return { advanced: 0, rejected: 0, pending: 1 };
    }
    entry.serpTop3 = serp.top;
    entry.serpAsOf = new Date().toISOString();
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
  return { advanced: cannibal === undefined ? 1 : 0, rejected: cannibal === undefined ? 0 : 1, pending: 0 };
}

/** PASS 2: expand one seed topic into candidates (D-01/G1-G5/D-07). */
async function processSeedTopic(
  ctx: StageContext,
  sources: ExpandSources,
  silo: SiloSlug,
  topic: string,
): Promise<CompletionCounts> {
  const { registry, registryDir } = ctx;
  let advanced = 0;
  let rejected = 0;
  let pending = 0;
  const ts = new Date().toISOString();

  const usBatch = await sources.topicSuggestions(topic, 'us', registryDir);

  if (!usBatch.ok) {
    // Source outage (politically retried inside free-keywords first): leave
    // the topic unprocessed for a later run — NO marker entry, NO fabricated
    // data; the run notes carry the reason (⚠ honest-absence policy).
    ctx.log(`topic '${topic}': source unavailable (${usBatch.reason ?? 'reason unstated'}) — left unprocessed`);
    return { advanced, rejected, pending: 1 };
  }

  if (usBatch.suggestions.length === 0) {
    // Zero-candidate topic: write the seed itself as a *rejected marker*
    // entry so (a) the empty response is visible (D-04) and (b) id-dedupe
    // makes reruns skip it (D-02 cache rule).
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
        rejectionReason: 'Google autocomplete returned 0 suggestions for seed topic (US) — topic has no long-tail pool',
      };
      shard.keywords.push(seedEntry);
      shard.updatedAt = ts;
      registry.saveShard(silo, shard);
      rejected += 1;
    }
    ctx.log(`topic '${topic}': 0 suggestions — marker rejected entry persisted (visible trail)`);
    return { advanced, rejected, pending };
  }

  // D-07 per-geo capture: same topic per geo; a candidate inherits the rank
  // where each geo's suggestion pool surfaced it (matched on normalized text).
  const geoBatch = new Map<Exclude<GeoCode, 'us'>, SuggestionBatch>();
  for (const geo of GEO_CODES) {
    if (geo === 'us') continue;
    geoBatch.set(geo, await sources.topicSuggestions(topic, geo, registryDir));
  }

  // US pool = the per-geo long-tail expansion the stage gates (ranked order).
  const rankOf = (sug: SuggestionBatch, candidate: string): number | undefined => {
    const norm = normalizeSuggestion(candidate);
    const idx = sug.suggestions.findIndex((s) => normalizeSuggestion(s) === norm);
    return idx === -1 ? undefined : idx + 1;
  };

  let shard = registry.loadShard(silo);
  const usedIds = new Set<string>(shard.keywords.map((e) => e.id));

  for (let i = 0; i < usBatch.suggestions.length; i += 1) {
    const keyword = usBatch.suggestions[i];
    // Malformed/blank pool item: skipped honestly rather than crashing the
    // topic's whole expansion (never coerced into a fake candidate).
    if (typeof keyword !== 'string' || keyword.trim().length === 0) continue;
    const usRank = i + 1;

    const id = slugId(keyword);
    if (usedIds.has(id)) continue; // same keyword surfaced by another topic/candidate — no duplicate entry
    usedIds.add(id);

    const entry: RegistryEntry = {
      id,
      keyword,
      silo,
      stage: 'expanded',
      seedTopic: topic,
      createdAt: ts,
      updatedAt: ts,
      freeSignal: {
        autocomplete: { us: { rank: usRank } },
        breadth: usBatch.breadth,
      },
    };

    let perGeoCaptured = 0;
    for (const geo of GEO_CODES) {
      if (geo === 'us') continue;
      const rank = rankOf(geoBatch.get(geo) ?? { ok: true, suggestions: [], breadth: 0 }, keyword);
      if (rank !== undefined) {
        entry.freeSignal!.autocomplete![geo] = { rank };
        perGeoCaptured += 1;
      }
    }
    if (perGeoCaptured === 0) {
      // honest absence per geo (UK/CA/AU pool did not surface this exact phrase)
      ctx.log(`candidate '${keyword}': no exact per-geo suggestion match (UK/CA/AU) — per-geo rank evidence absent, US rank retained (D-07 partial)`);
    }

    const gate = freeGateReason({
      autocomplete: { rank: usRank },
      breadth: usBatch.breadth,
      keyword,
    });
    if (gate !== null) {
      registry.reject(entry, gate);
      shard.keywords.push(entry);
      shard.updatedAt = ts;
      registry.saveShard(silo, shard);
      rejected += 1;
      continue;
    }

    // G4 — trend interest (3-month public window). Absence is RECORDED, not
    // fabricated: the candidate then passes the free-signal gates with the
    // note persisted on the entry.
    const trend = await sources.trendInterest(keyword, 'us', registryDir);
    entry.freeSignal!.trend = trend.ok
      ? { interest: trend.interest, asOf: trend.asOf }
      : { note: `trends unavailable: ${trend.reason ?? 'reason unstated'}` };

    const trendGate = freeGateReason({
      autocomplete: { rank: usRank },
      breadth: usBatch.breadth,
      trend: entry.freeSignal!.trend,
      keyword,
    });
    if (trendGate !== null) {
      registry.reject(entry, trendGate);
      shard.keywords.push(entry);
      shard.updatedAt = ts;
      registry.saveShard(silo, shard);
      rejected += 1;
      continue;
    }

    // D-05: exactly ONE SERP pull per candidate check (US publish locale).
    const serp = await sources.serpTop(keyword, 'us', registryDir);
    if (!serp.ok) {
      // honest absence: park at 'expanded' with the reason — PASS 1 of a
      // later run retries the pull (idempotent; nothing fabricated)
      entry.updatedAt = new Date().toISOString();
      shard.keywords.push(entry);
      shard.updatedAt = new Date().toISOString();
      registry.saveShard(silo, shard);
      pending += 1;
      ctx.log(`candidate '${keyword}': SERP unavailable (${serp.reason ?? 'reason unstated'}) — left at 'expanded' for a later pass`);
      continue;
    }
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

  ctx.log(`topic '${topic}': ${advanced} filtered, ${rejected} rejected, ${pending} pending SERP`);
  return { advanced, rejected, pending };
}

/**
 * Stage entrypoint (Plan 03-01 contract): `runStage(ctx) -> StageResult`.
 * `sources` is an optional injection seam (fixture probes); production callers
 * omit it and the real keyless free sources are used.
 */
export async function runStage(ctx: StageContext, sources: ExpandSources = DEFAULT_SOURCES): Promise<StageResult> {
  const { registry, budget, log } = ctx;
  const sequentialSeeds = readSeedTopics(ctx.registryDir);

  let advanced = 0;
  let rejected = 0;
  let skipped = 0;
  let pendings = 0;
  let stopped = false;
  const notes: string[] = [];
  const requestsBefore = budget.readBudget().monthRequests;

  for (const silo of registry.silos) {
    // PASS 1 — crash-artifact leftovers complete first, regardless of the
    // seed queue state (interrupted candidates must not lie half-processed).
    const leftovers = registry.listPromotable('expanded', 'filtered', 10_000).filter((e) => e.silo === silo);
    for (const leftover of leftovers) {
      const step = await completeLeftover(registry, silo, leftover, sources, ctx.registryDir);
      advanced += step.advanced;
      rejected += step.rejected;
      pendings += step.pending;
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

      // Run-reserve guard: leave headroom for a second partial run.
      const b = budget.readBudget();
      if (b.remainingRequests < MIN_RUN_RESERVE_REQUESTS) {
        notes.push(`remaining requests ${b.remainingRequests} below the ${MIN_RUN_RESERVE_REQUESTS} run reserve — halting early (⏳ request-cap governor, owner fully-free directive)`);
        stopped = true;
        break;
      }

      // Request-cap hard-stop BEFORE the topic's batch; the sources record
      // actual attempts spend-first, which can only move the ledger further
      // over the cap, never silently.
      try {
        budget.assertRequestsAvailable(EXPAND_HEADROOM_REQUESTS);
      } catch (err) {
        if (err instanceof BudgetExhaustedError) {
          notes.push(`request cap exhausted — halting expansion (${err.message})`);
          stopped = true;
          break;
        }
        throw err;
      }

      const step = await processSeedTopic(ctx, sources, silo, topic);
      advanced += step.advanced;
      rejected += step.rejected;
      pendings += step.pending;
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
      const unprocessed = topics.filter((t) => !processed.has(t)).length;
      if (unprocessed > 0) notes.push(`silo '${silo}': ${unprocessed} topics remain unprocessed after the halt`);
    }
  }

  if (skipped > 0) notes.push(`${skipped} topics skipped — already expanded (no re-fetching, D-02 cache rule)`);
  const requestsAfter = budget.readBudget().monthRequests;
  const requestsUsed = requestsAfter - requestsBefore;
  if (pendings > 0) notes.push(`${pendings} candidates left at 'expanded' — SERP pull pending for a later run (honest absence)`);
  notes.push(`free-source requests recorded this run: ${requestsUsed} (ledger) | spend $0.00 (fully-free platform)`);

  return { advanced, rejected, spentUsd: 0, notes };
}
