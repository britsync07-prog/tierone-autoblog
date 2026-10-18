// Idempotent claim-by-hash locking for scheduled publishing (Plan 05-02, D-02).
//
// Prevents duplicate or concurrent publish runs from clobbering each other
// or double-publishing the same draft. Lock is recorded in content/keywords/pipeline-state.json
// with a 30-minute stale expiration.

import { createHash } from 'node:crypto';
import { readPipelineState, writePipelineState } from '../qa/circuit-breaker';

export interface ClaimLock {
  hash: string;
  entryId: string;
  claimedAt: string;
}

export interface ClaimLockResult {
  success: boolean;
  hash: string;
  reason?: string;
}

export const CLAIM_LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Computes deterministic SHA-256 fingerprint for a candidate candidateId and candidateUpdatedAt.
 */
export function computeClaimHash(candidateId: string, candidateUpdatedAt: string): string {
  return createHash('sha256')
    .update(`${candidateId}:${candidateUpdatedAt}`)
    .digest('hex');
}

/**
 * Checks whether an unexpired active claim lock currently exists.
 */
export function isClaimActive(keywordsDir?: string): boolean {
  const state = readPipelineState(keywordsDir);
  if (!state.activeClaim?.claimedAt) return false;
  const ageMs = Date.now() - new Date(state.activeClaim.claimedAt).getTime();
  return ageMs < CLAIM_LOCK_TTL_MS;
}

/**
 * Attempts to acquire an atomic claim lock on a candidate.
 * Returns { success: true, hash } if lock is acquired, or { success: false, hash, reason }
 * if an unexpired lock is already active.
 */
export function acquireClaimLock(
  candidateId: string,
  candidateUpdatedAt: string,
  keywordsDir?: string,
): ClaimLockResult {
  const hash = computeClaimHash(candidateId, candidateUpdatedAt);
  const state = readPipelineState(keywordsDir);

  if (state.activeClaim) {
    const claimedTime = new Date(state.activeClaim.claimedAt).getTime();
    const ageMs = Date.now() - claimedTime;

    if (ageMs < CLAIM_LOCK_TTL_MS) {
      return {
        success: false,
        hash: state.activeClaim.hash,
        reason: `Already claimed by entry ${state.activeClaim.entryId} at ${state.activeClaim.claimedAt}`,
      };
    }

    console.warn(
      `[claim-lock] Stale claim lock detected (>30m for ${state.activeClaim.entryId}), overriding`,
    );
  }

  state.activeClaim = {
    hash,
    entryId: candidateId,
    claimedAt: new Date().toISOString(),
  };

  writePipelineState(state, keywordsDir);
  return { success: true, hash };
}

/**
 * Releases an active claim lock if the hash matches.
 */
export function releaseClaimLock(hash: string, keywordsDir?: string): void {
  const state = readPipelineState(keywordsDir);
  if (state.activeClaim?.hash === hash) {
    delete state.activeClaim;
    writePipelineState(state, keywordsDir);
  }
}
