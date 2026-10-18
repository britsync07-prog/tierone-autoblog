export type RefreshActionType =
  | 'bump-date-modified'
  | 'inject-faq'
  | 'repair-links'
  | 'consolidate-301';

export type RefreshItemType = 'striking-distance' | 'content-decay';

export interface StrikingDistanceQuery {
  query: string;
  page: string;
  slug?: string;
  position: number;
  impressions: number;
  clicks: number;
  opportunityScore: number;
  suggestedFaq?: {
    q: string;
    a: string;
  };
}

export interface ContentDecayResult {
  page: string;
  slug: string;
  silo?: string;
  publishedAt: string;
  ageDays: number;
  currentImpressions: number;
  priorImpressions: number;
  currentClicks: number;
  priorClicks: number;
  dropImpressionsPct: number;
  dropClicksPct: number;
  decayScore: number;
}

export interface RefreshQueueItem {
  id: string; // e.g. "refresh-slug-YYYY-MM"
  slug: string;
  silo: string;
  type: RefreshItemType;
  priority: number; // 1-10 (10 highest)
  detectedAt: string;
  status: 'pending' | 'applied' | 'quarantined';
  appliedAt?: string;
  diagnostics: {
    currentImpressions: number;
    priorImpressions?: number;
    impressionsDropPct?: number;
    queries?: Array<{
      query: string;
      position: number;
      impressions: number;
      clicks: number;
    }>;
    brokenLinks?: string[];
  };
  suggestedActions: Array<{
    action: RefreshActionType;
    faqItem?: { q: string; a: string };
    targetDestination?: string;
    details?: string;
  }>;
}

export interface RefreshQueueFile {
  version: number | string;
  updatedAt: string;
  items: RefreshQueueItem[];
}
