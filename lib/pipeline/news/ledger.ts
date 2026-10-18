import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CoveredLedger, CoveredStoryEntry, NewsCoveredLedger } from './types';

export const DEFAULT_COVERED_LEDGER_PATH = 'content/news/covered.json';

/**
 * Loads covered stories ledger from disk.
 * Returns default empty structure if file does not exist or fails to parse.
 */
export function loadCoveredLedger(filePath?: string): NewsCoveredLedger {
  const targetPath = resolve(filePath ?? DEFAULT_COVERED_LEDGER_PATH);

  if (!existsSync(targetPath)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      events: [],
    };
  }

  try {
    const raw = readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CoveredLedger>;
    return {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch (err) {
    console.warn(`[Ledger] Warning: Failed to parse ${targetPath}, returning empty ledger:`, err);
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      events: [],
    };
  }
}

/**
 * Saves covered stories ledger to disk with pretty formatting.
 */
export function saveCoveredLedger(ledger: NewsCoveredLedger, filePath?: string): void {
  const targetPath = resolve(filePath ?? DEFAULT_COVERED_LEDGER_PATH);
  const dir = dirname(targetPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(targetPath, JSON.stringify(ledger, null, 2), 'utf8');
}

/**
 * Records a newly covered story in the persistent ledger.
 */
export function recordCoveredStory(entry: CoveredStoryEntry, filePath?: string): void {
  const ledger = loadCoveredLedger(filePath);
  ledger.updatedAt = new Date().toISOString();

  // Deduplicate entry by id or normalizedTitle in ledger
  const existingIdx = ledger.events.findIndex(
    (e) => e.id === entry.id || e.sourceUrl === entry.sourceUrl,
  );

  if (existingIdx >= 0) {
    ledger.events[existingIdx] = entry;
  } else {
    ledger.events.unshift(entry);
  }

  saveCoveredLedger(ledger, filePath);
}
