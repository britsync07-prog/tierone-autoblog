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
  brief?: { completedAt: string };
  outline?: { completedAt: string; lint: 'pass' };
  draft?: { slug: string; landedAt: string; attempts: number; lastError?: string };
  images?: { hero: ImageSlot; inArticle?: ImageSlot[]; completedAt: string };
}

/** Per-silo shard file (D-08): content/keywords/{silo}/registry.json */
export interface RegistryShard {
  version: 1;
  updatedAt: string;
  keywords: RegistryEntry[];
}
