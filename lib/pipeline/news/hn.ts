import { createHash } from 'node:crypto';
import type { RawNewsItem } from './types';

export const AI_TECH_REGEX =
  /\b(ai|llm|gpt|claude|gemini|anthropic|openai|deepseek|mistral|meta|nvidia|gpu|chips?|agent|coding|developer|software|model|prompt|open-source|compiler|vector|neural)\b/i;

export interface FetchHackerNewsOptions {
  limit?: number;
  minScore?: number;
  fetchImpl?: typeof fetch;
  fetchFn?: typeof fetch;
  now?: Date;
}

interface HackerNewsRawStory {
  id: number;
  type?: string;
  by?: string;
  time?: number; // Unix timestamp in seconds
  title?: string;
  url?: string;
  score?: number;
  text?: string;
}

/**
 * Fetches top tech/AI stories from Hacker News Firebase REST API.
 * Filtered for score, 24h freshness, and AI/tech relevance.
 */
export async function fetchHackerNewsStories(
  options?: FetchHackerNewsOptions,
): Promise<RawNewsItem[]> {
  const fetcher = options?.fetchFn ?? options?.fetchImpl ?? fetch;
  const limit = options?.limit ?? 40;
  const minScore = options?.minScore ?? 80;
  const referenceTime = options?.now ?? new Date();

  try {
    const topUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const topRes = await fetcher(topUrl, { signal: AbortSignal.timeout(8000) });
    if (!topRes.ok) {
      console.warn(`[HN] Failed to fetch topstories: HTTP ${topRes.status}`);
      return [];
    }

    const storyIds = (await topRes.json()) as number[];
    if (!Array.isArray(storyIds)) {
      return [];
    }

    const targetIds = storyIds.slice(0, limit);
    const results: RawNewsItem[] = [];

    // Process in batches of 10 to avoid overwhelming network
    const chunkSize = 10;
    for (let i = 0; i < targetIds.length; i += chunkSize) {
      const chunk = targetIds.slice(i, i + chunkSize);
      const settled = await Promise.allSettled(
        chunk.map(async (id) => {
          const itemUrl = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
          const itemRes = await fetcher(itemUrl, { signal: AbortSignal.timeout(4000) });
          if (!itemRes.ok) return null;
          return (await itemRes.json()) as HackerNewsRawStory;
        }),
      );

      for (const res of settled) {
        if (res.status !== 'fulfilled' || !res.value) continue;
        const item = res.value;

        if (item.type !== 'story' || !item.url || !item.title) {
          continue;
        }

        const score = item.score ?? 0;
        if (score < minScore) {
          continue;
        }

        const itemDate = item.time ? new Date(item.time * 1000) : null;
        if (!itemDate || Number.isNaN(itemDate.getTime())) {
          continue;
        }

        const ageMs = referenceTime.getTime() - itemDate.getTime();
        const maxAgeMs = 24 * 60 * 60 * 1000;
        if (ageMs < 0 || ageMs > maxAgeMs) {
          continue;
        }

        // Must match AI/Tech keywords
        if (!AI_TECH_REGEX.test(item.title)) {
          continue;
        }

        const idHash = createHash('sha256').update(item.url).digest('hex').slice(0, 16);

        results.push({
          id: idHash,
          title: item.title.trim(),
          link: item.url.trim(),
          pubDate: itemDate.toISOString(),
          source: 'Hacker News',
          summary: item.title.trim().slice(0, 500),
          score,
          author: item.by,
        });
      }
    }

    return results;
  } catch (err) {
    console.warn('[HN] Exception while fetching Hacker News stories:', err);
    return [];
  }
}

// Alias to satisfy both task instructions and plan specifications
export const fetchHackerNewsTop = fetchHackerNewsStories;
