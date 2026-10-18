import { isStoryDuplicate, isWithinFreshnessWindow, tokenizeTitle } from './dedup';
import type { CoveredLedger, CoveredStoryEntry, RawNewsItem, ScoredNewsCandidate } from './types';

export const PRIORITY_ENTITIES = [
  'openai',
  'anthropic',
  'claude',
  'gpt',
  'chatgpt',
  'gemini',
  'google',
  'deepseek',
  'meta',
  'llama',
  'nvidia',
  'cursor',
  'copilot',
  'github',
  'mistral',
  'apple',
  'groq',
  'huggingface',
  'rust',
  'typescript',
  'vibe',
];

/**
 * Scores a single news item based on HN points, cross-feed mentions,
 * priority entities, and publication recency.
 */
export function scoreNewsItem(
  item: RawNewsItem,
  allItems: RawNewsItem[],
  now: Date = new Date(),
): ScoredNewsCandidate {
  const baseScore = 10;

  // 1. Hacker News points weight: score * 1.5
  const hnPoints = Math.round((item.score ?? 0) * 1.5);

  // 2. Cross-feed mentions: find other items from different sources sharing >= 2 title tokens
  const itemTokens = new Set(tokenizeTitle(item.title));
  let crossFeedCount = 0;

  for (const other of allItems) {
    if (other.id === item.id || other.source === item.source) {
      continue;
    }

    const otherTokens = tokenizeTitle(other.title);
    let common = 0;
    for (const t of otherTokens) {
      if (itemTokens.has(t)) {
        common += 1;
      }
    }

    if (common >= 2) {
      crossFeedCount += 1;
    }
  }

  const crossFeedMentions = crossFeedCount * 40;

  // 3. Priority entity bonus
  const titleLower = item.title.toLowerCase();
  const matchedEntities: string[] = [];

  for (const entity of PRIORITY_ENTITIES) {
    const regex = new RegExp(`\\b${entity}\\b`, 'i');
    if (regex.test(titleLower)) {
      matchedEntities.push(entity);
    }
  }

  let entityBonus = 0;
  if (matchedEntities.length >= 2) {
    entityBonus = 80;
  } else if (matchedEntities.length >= 1) {
    entityBonus = 50;
  }

  // 4. Recency bonus: max(0, 24 - ageHours) * 3
  const itemTime = Date.parse(item.pubDate);
  const ageHours = Number.isNaN(itemTime)
    ? 24
    : Math.max(0, (now.getTime() - itemTime) / (3600 * 1000));

  const recencyBonus = Math.round(Math.max(0, 24 - ageHours) * 3);

  const totalScore = baseScore + hnPoints + crossFeedMentions + entityBonus + recencyBonus;

  return {
    ...item,
    scoreDetails: {
      baseScore,
      hnPoints,
      crossFeedMentions,
      entityBonus,
      recencyBonus,
      totalScore,
    },
    matchedEntities,
  };
}

/**
 * Filters items by freshness and duplication, scores them, and returns ranked list descending by total score.
 */
export function rankNewsCandidates(
  items: RawNewsItem[],
  ledgerOrEvents: CoveredLedger | CoveredStoryEntry[],
  now: Date = new Date(),
): ScoredNewsCandidate[] {
  // 1. Freshness filter
  const freshItems = items.filter((item) => isWithinFreshnessWindow(item.pubDate, now));

  // 2. Deduplication filter against covered ledger
  const deduplicatedItems: RawNewsItem[] = [];
  for (const item of freshItems) {
    const check = isStoryDuplicate(item, ledgerOrEvents, { now });
    if (!check.isDuplicate) {
      deduplicatedItems.push(item);
    }
  }

  // 3. Score candidates relative to the fresh batch
  const scored = deduplicatedItems.map((item) => scoreNewsItem(item, freshItems, now));

  // 4. Sort descending by totalScore
  scored.sort((a, b) => b.scoreDetails.totalScore - a.scoreDetails.totalScore);

  return scored;
}
