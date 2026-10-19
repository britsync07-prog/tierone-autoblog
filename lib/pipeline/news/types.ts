export interface RawNewsItem {
  id: string;              // Deterministic SHA-256 hash (16 chars)
  title: string;           // Clean text title
  link: string;            // Direct destination URL
  pubDate: string;         // ISO 8601 UTC date string
  source: string;          // 'Hacker News' | 'Google News' | 'TechCrunch' | 'The Verge' | 'Ars Technica' | string
  summary: string;         // Clean text excerpt (max 500 chars)
  score?: number;          // HN points or upvotes (if applicable)
  author?: string;         // Original author or reporting publication
  imageUrl?: string;       // Original source or RSS enclosure thumbnail URL
}

export interface CoveredEvent {
  id: string;
  title: string;
  normalizedTitle: string;
  sourceUrl: string;
  canonicalDomain: string;
  publishedDate: string;
  coveredAt: string;
  postSlug: string;
  keywords: string[];
}

export type CoveredStoryEntry = CoveredEvent;

export interface CoveredLedger {
  version: number | string;
  updatedAt: string;
  events: CoveredEvent[];
}

export type NewsCoveredLedger = CoveredLedger;

export interface NewsScoreDetails {
  baseScore: number;
  hnPoints: number;
  crossFeedMentions: number;
  entityBonus: number;
  recencyBonus: number;
  totalScore: number;
}

export interface ScoredNewsCandidate extends RawNewsItem {
  scoreDetails: NewsScoreDetails;
  matchedEntities: string[];
}

export type ScoredNewsItem = ScoredNewsCandidate;

export interface NewsFeedSource {
  name: string;
  url: string;
}
