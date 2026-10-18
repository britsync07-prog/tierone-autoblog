// 4-point velocity scaling governor (Plan 06-04, D-07, D-08, GROW-03).
//
// Gates daily publishing velocity until the domain achieves 4 stability & trust milestones:
// 1. Domain Operating Age >= 60 days (measured from earliest publishedAt in any silo shard)
// 2. GSC Indexation Ratio >= 70% (totalIndexed / totalSubmitted >= 0.70)
// 3. Operational Stability: circuit breaker is not paused AND 0 failures/trips in last 30 days
// 4. Active Corpus Floor: >= 10 published articles across all silo registries

import { resolve } from 'node:path';
import { SILO_SLUGS, type SiloSlug } from '../../silos';
import { loadShard } from '../registry';
import { readPipelineState } from '../qa/circuit-breaker';
import { loadAnalyticsSnapshot } from '../analytics/snapshot';

export interface GovernorEvaluation {
  unlocked: boolean;
  domainAgeDays: number;
  domainAgePassed: boolean;
  indexationRatio: number;
  indexationPassed: boolean;
  circuitBreakerTrips30d: number;
  stabilityPassed: boolean;
  activeCorpusCount: number;
  corpusPassed: boolean;
  reasons: string[];
}

export interface GovernorCheckOptions {
  keywordsDir?: string;
  snapshotPath?: string;
  siteUrl?: string;
  now?: Date;
  mockIndexRatio?: number;
  mockGscRatio?: number;
}

const DEFAULT_KEYWORDS_DIR = 'content/keywords';
const DOMAIN_AGE_DAYS_REQUIRED = 60;
const INDEXATION_RATIO_REQUIRED = 0.70;
const ACTIVE_CORPUS_MINIMUM = 10;
const CB_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Baseline publishing days (4x/week): Sun (0), Mon (1), Wed (3), Fri (5).
 * Expanded publishing days (7x/week): Tue (2), Thu (4), Sat (6).
 */
export function isBaselineDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 1 || day === 3 || day === 5;
}

/**
 * Evaluates the 4-point velocity governor criteria against current registry,
 * analytics snapshot, and pipeline state.
 */
export function checkVelocityGovernor(options?: GovernorCheckOptions): GovernorEvaluation {
  const keywordsDir = options?.keywordsDir ?? DEFAULT_KEYWORDS_DIR;
  const now = options?.now ?? new Date();
  const reasons: string[] = [];

  // 1. Domain Operating Age & 4. Active Corpus Floor
  let earliestPublishedMs: number | null = null;
  let activeCorpusCount = 0;

  for (const silo of SILO_SLUGS) {
    try {
      const shard = loadShard(keywordsDir, silo);
      for (const entry of shard.keywords) {
        if (entry.stage === 'published') {
          activeCorpusCount += 1;
          const tsStr = entry.publishedAt ?? entry.qa?.passedAt ?? entry.updatedAt;
          if (tsStr) {
            const ms = Date.parse(tsStr);
            if (!Number.isNaN(ms)) {
              if (earliestPublishedMs === null || ms < earliestPublishedMs) {
                earliestPublishedMs = ms;
              }
            }
          }
        }
      }
    } catch {
      // Shard directory might not exist or be empty in test setups
    }
  }

  // Criterion 1: Domain Operating Age >= 60 days
  let domainAgeDays = 0;
  let domainAgePassed = false;
  if (earliestPublishedMs !== null) {
    const elapsedMs = now.getTime() - earliestPublishedMs;
    domainAgeDays = Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
    domainAgePassed = domainAgeDays >= DOMAIN_AGE_DAYS_REQUIRED;
    if (!domainAgePassed) {
      reasons.push(
        `Domain operating age ${domainAgeDays}d < ${DOMAIN_AGE_DAYS_REQUIRED}d threshold (earliest published: ${new Date(
          earliestPublishedMs
        ).toISOString()})`
      );
    }
  } else {
    reasons.push(`Domain operating age 0d < ${DOMAIN_AGE_DAYS_REQUIRED}d threshold (no published posts found)`);
  }

  // Criterion 2: Indexation Ratio >= 70%
  let indexationRatio = 0;
  if (options?.mockIndexRatio !== undefined) {
    indexationRatio = options.mockIndexRatio;
  } else if (options?.mockGscRatio !== undefined) {
    indexationRatio = options.mockGscRatio;
  } else {
    const snapshot = loadAnalyticsSnapshot(options?.snapshotPath);
    if (snapshot?.sitemapRatio && typeof snapshot.sitemapRatio.ratio === 'number') {
      indexationRatio = snapshot.sitemapRatio.ratio;
    }
  }

  const indexationPassed = indexationRatio >= INDEXATION_RATIO_REQUIRED;
  if (!indexationPassed) {
    reasons.push(
      `GSC indexation ratio ${(indexationRatio * 100).toFixed(1)}% < ${(
        INDEXATION_RATIO_REQUIRED * 100
      ).toFixed(0)}% threshold`
    );
  }

  // Criterion 3: Operational Stability (Circuit Breaker Clean)
  const pipelineState = readPipelineState(keywordsDir);
  let circuitBreakerTrips30d = 0;

  if (pipelineState.failureHistory && Array.isArray(pipelineState.failureHistory)) {
    const cutoff = now.getTime() - CB_LOOKBACK_MS;
    for (const record of pipelineState.failureHistory) {
      const recMs = Date.parse(record.timestamp);
      if (!Number.isNaN(recMs) && recMs >= cutoff) {
        circuitBreakerTrips30d += 1;
      }
    }
  }

  let stabilityPassed = true;
  if (pipelineState.paused) {
    stabilityPassed = false;
    reasons.push(`Circuit breaker is currently paused (${pipelineState.reason ?? 'manual or tripped pause'})`);
  } else if (circuitBreakerTrips30d > 0) {
    stabilityPassed = false;
    reasons.push(`Circuit breaker recorded ${circuitBreakerTrips30d} failure(s) in the last 30 days`);
  }

  // Criterion 4: Active Corpus Floor >= 10
  const corpusPassed = activeCorpusCount >= ACTIVE_CORPUS_MINIMUM;
  if (!corpusPassed) {
    reasons.push(`Active corpus size ${activeCorpusCount} < ${ACTIVE_CORPUS_MINIMUM} published articles threshold`);
  }

  const unlocked = domainAgePassed && indexationPassed && stabilityPassed && corpusPassed;

  return {
    unlocked,
    domainAgeDays,
    domainAgePassed,
    indexationRatio,
    indexationPassed,
    circuitBreakerTrips30d,
    stabilityPassed,
    activeCorpusCount,
    corpusPassed,
    reasons,
  };
}
