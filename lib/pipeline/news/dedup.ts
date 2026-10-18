import type { CoveredEvent, CoveredLedger, CoveredStoryEntry, RawNewsItem } from './types';

export const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const STOP_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'with',
]);

/**
 * Checks if a news item publication date falls within the 24-hour freshness window.
 */
export function isWithinFreshnessWindow(
  pubDateIso: string,
  referenceTime: Date = new Date(),
): boolean {
  const itemTime = Date.parse(pubDateIso);
  if (Number.isNaN(itemTime)) return false;
  const ageMs = referenceTime.getTime() - itemTime;
  return ageMs >= 0 && ageMs <= FRESHNESS_WINDOW_MS;
}

/**
 * Filters raw news items to only those published within the maxAgeHours window.
 */
export function filterFreshNews(
  items: RawNewsItem[],
  maxAgeHours = 24,
  now: Date = new Date(),
): RawNewsItem[] {
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  return items.filter((item) => {
    const itemTime = Date.parse(item.pubDate);
    if (Number.isNaN(itemTime)) return false;
    const ageMs = now.getTime() - itemTime;
    return ageMs >= 0 && ageMs <= maxAgeMs;
  });
}

/**
 * Normalizes a URL: strips protocol, www, trailing slashes, hash fragments,
 * and common tracking query parameters.
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'fbclid',
      'gclid',
      'oc',
      'ved',
    ];

    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    let host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '';

    const search = parsed.searchParams.toString();
    const queryPart = search ? `?${search}` : '';

    return `${host}${pathname}${queryPart}`;
  } catch {
    // If not a standard URL, fallback to regex cleanup
    return rawUrl
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
      .trim();
  }
}

/**
 * Extracts canonical domain from URL.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/:]+)/i);
    return match ? match[1].toLowerCase() : url.toLowerCase();
  }
}

/**
 * Tokenizes headline title: lowercase, strips non-alphanumeric chars,
 * and filters out common stop words.
 */
export function tokenizeTitle(title: string): string[] {
  if (!title) return [];

  const cleaned = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return cleaned
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

/**
 * Generates contiguous 3-word shingles from token sequence.
 */
export function generate3WordShingles(tokens: string[]): Set<string> {
  const shingles = new Set<string>();

  if (tokens.length < 3) {
    if (tokens.length > 0) {
      shingles.add(tokens.join(' '));
    }
    return shingles;
  }

  for (let i = 0; i <= tokens.length - 3; i += 1) {
    shingles.add(tokens.slice(i, i + 3).join(' '));
  }

  return shingles;
}

/**
 * Computes Jaccard similarity: |A ∩ B| / |A ∪ B|
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];

  for (const item of smaller) {
    if (larger.has(item)) {
      intersectionSize += 1;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0;

  return Math.round((intersectionSize / unionSize) * 10000) / 10000;
}

export interface DuplicateCheckOptions {
  jaccardThreshold?: number;
  windowDays?: number;
  now?: Date;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  matchedReason?: string;
  matchedStory?: CoveredStoryEntry;
}

/**
 * Evaluates whether a candidate news item is a duplicate of any covered story.
 * Checks:
 * 1. Normalized URL match.
 * 2. 3-word shingle Jaccard similarity >= threshold (default 0.40).
 * 3. Key entity token overlap (>= 3 shared significant tokens).
 */
export function isStoryDuplicate(
  candidate: RawNewsItem,
  ledgerOrEvents: CoveredLedger | CoveredStoryEntry[],
  optionsOrThreshold?: DuplicateCheckOptions | number,
  thresholdParam = 0.4,
): DuplicateCheckResult {
  const events: CoveredStoryEntry[] = Array.isArray(ledgerOrEvents)
    ? ledgerOrEvents
    : ledgerOrEvents?.events ?? [];

  if (events.length === 0) {
    return { isDuplicate: false };
  }

  let threshold = thresholdParam;
  let windowDays = 14;
  let now = new Date();

  if (typeof optionsOrThreshold === 'number') {
    threshold = optionsOrThreshold;
  } else if (optionsOrThreshold) {
    if (typeof optionsOrThreshold.jaccardThreshold === 'number') {
      threshold = optionsOrThreshold.jaccardThreshold;
    }
    if (typeof optionsOrThreshold.windowDays === 'number') {
      windowDays = optionsOrThreshold.windowDays;
    }
    if (optionsOrThreshold.now instanceof Date) {
      now = optionsOrThreshold.now;
    }
  }

  const candidateNormUrl = normalizeUrl(candidate.link);
  const candidateTokens = tokenizeTitle(candidate.title);
  const candidateShingles = generate3WordShingles(candidateTokens);
  const candidateTokenSet = new Set(candidateTokens);

  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  for (const event of events) {
    // 1. Exact normalized URL match
    const eventNormUrl = normalizeUrl(event.sourceUrl);
    if (candidateNormUrl && eventNormUrl && candidateNormUrl === eventNormUrl) {
      const reason = `Exact URL match with covered story: "${event.title}"`;
      return {
        isDuplicate: true,
        reason,
        matchedReason: reason,
        matchedStory: event,
      };
    }

    // Filter to events within the rolling window
    if (event.coveredAt || event.publishedDate) {
      const eventTime = Date.parse(event.coveredAt || event.publishedDate);
      if (!Number.isNaN(eventTime)) {
        const ageMs = now.getTime() - eventTime;
        if (ageMs > windowMs) {
          continue;
        }
      }
    }

    // 2. 3-word shingle Jaccard similarity
    const eventTokens = tokenizeTitle(event.title);
    const eventShingles = generate3WordShingles(eventTokens);
    const similarity = calculateJaccardSimilarity(candidateShingles, eventShingles);

    if (similarity >= threshold) {
      const reason = `Shingle similarity ${(similarity * 100).toFixed(1)}% exceeds threshold ${(threshold * 100).toFixed(1)}% with: "${event.title}"`;
      return {
        isDuplicate: true,
        reason,
        matchedReason: reason,
        matchedStory: event,
      };
    }

    // 3. Significant entity token overlap (>= 3 matching terms when titles are concise)
    let sharedTokensCount = 0;
    for (const token of eventTokens) {
      if (candidateTokenSet.has(token)) {
        sharedTokensCount += 1;
      }
    }

    if (sharedTokensCount >= 3 && candidateTokens.length <= 7 && eventTokens.length <= 7) {
      const reason = `Token overlap (${sharedTokensCount} tokens) exceeds threshold with: "${event.title}"`;
      return {
        isDuplicate: true,
        reason,
        matchedReason: reason,
        matchedStory: event,
      };
    }
  }

  return { isDuplicate: false };
}
