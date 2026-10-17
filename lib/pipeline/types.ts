import type { SiloSlug } from '../silos';

/** Registry stage vocabulary (D-09). `rejected` is terminal; the other five
 * advance left-to-right when the stage that produces them succeeds. */
export type RegistryStage =
  | 'expanded'
  | 'filtered'
  | 'briefed'
  | 'outlined'
  | 'drafted'
  | 'rejected';
export type GeoCode = 'us' | 'uk' | 'ca' | 'au';
export const GEO_CODES: GeoCode[] = ['us', 'uk', 'ca', 'au'];

export interface GeoMetrics {
  volume: number;
  kd?: number;
  cpc?: number;
}

export interface SerpResult {
  url: string;
  title: string;
  position: number;
}

export interface ImageSlot {
  slot: string;
  alt: string;
  src: string;
}

/** One registry entry = one keyword candidate (D-04 visible data trail: every
 * entry persists; rejected entries stay with a reason, never silently dropped). */
export interface RegistryEntry {
  id: string; // slug-safe id: /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/ trimmed to <=120 chars
  keyword: string; // raw keyword/query string
  silo: SiloSlug;
  stage: RegistryStage;
  seedTopic?: string; // seed topic string from seed-topics.json that expanded to this entry
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  /** Per-geo metrics (D-07: US/UK/CA/AU captured, single-locale en-US publish). */
  geo?: Partial<Record<GeoCode, GeoMetrics>>;
  metricsAsOf?: string; // ISO — freshness gate for D-06 on-promotion refresh
  serpTop3?: SerpResult[]; // captured during expansion cannibalization check (D-05)
  serpAsOf?: string;
  paa?: string[]; // People-Also-Ask questions captured from SERP features
  rejectionReason?: string; // required when stage === 'rejected' (D-04)
  /** ⚠ OWNER FULLY-FREE DIRECTIVE (2026-10-17) — free-signal expansion evidence.
   * Absolute volume/KD are not free, so the expand stage captures keyless
   * public-signal proxies instead. ADDITIVE ONLY: the frozen fields above
   * (geo, metricsAsOf, serpTop3, serpAsOf, paa) were never renamed/removed.
   * Ranks hold real positions in the per-geo public suggestion lists (1-based,
   * captured when the suggestion list delivered them); breadth is how many
   * long-tail suggestions the topic's list produced; trend records either a
   * measured Google-Trends interest figure (asOf-stamped) or an honest absence
   * note — missing sources are never fabricated (D-04/D-06 honesty). */
  freeSignal?: {
    autocomplete?: Partial<Record<GeoCode, { rank: number }>>;
    breadth?: number;
    trend?: { interest: number; asOf: string } | { note: string };
  };
  brief?: { completedAt: string };
  outline?: { completedAt: string; lint: 'pass' };
  /** landedAt is OPTIONAL: failed attempts persist the trail (D-04) while the
   * entry is still 'outlined' — it only gains a landedAt once the gate passes. */
  draft?: { slug: string; landedAt?: string; attempts: number; lastError?: string };
  images?: { hero: ImageSlot; inArticle?: ImageSlot[]; completedAt: string };
}

/** Per-silo shard file (D-08): content/keywords/{silo}/registry.json */
export interface RegistryShard {
  version: 1;
  updatedAt: string;
  keywords: RegistryEntry[];
}
