// Assets stage (PIPE-05, plan 03-05) — gives outlined entries their visual
// assets BEFORE they reach the draft stage (chain order set in 03-01:
// outline -> assets -> draft, so a landed post is never missing its images).
//
// ⚠ OWNER FULLY-FREE DIRECTIVE (2026-10-17): image generation is 100% free
// (lib/pipeline/images.ts procedural SVG -> sharp lane; fixture lane for
// deterministic verification) — no paid image API is ever constructed here
// and no credentials exist on this path. Image spend governance (T-03-14)
// is therefore a RUNTIME batch bound, MAX_IMAGES_PER_RUN (default 6), that
// parks excess entries with a visible note; spend is NOT ledgered (D-02's
// ledger is DataForSEO/free-source specific) but reported per-run in the
// StageResult notes where the owner sees it in run summaries.
//
// D-09 INVARIANT: this stage NEVER advances the stage enum. It attaches
// `entry.images = { hero, inArticle, completedAt }` while the entry stays
// 'outlined'; only the 03-06 draft stage advances (and its precondition is:
// outlined entries must carry images.completedAt before drafting — entries
// parked here with a parse-failure note are the ones a real chain must
// regenerate/reprofile the outline for).
//
// Flow per 'outlined' entry WITHOUT entry.images (oldest-updated first):
//   1. Read its committed outline at <briefsDir>/{silo}/{id}-outline.md and
//      parse the `## Image slots` block: hero concept REQUIRED (D-13 hero is
//      ALWAYS), in-article-1/in-article-2 only where flagged (value != none).
//   2. Honest parse gates (park with a clear note, continue others):
//      missing block / missing hero line / brief-captured-none placeholder /
//      any alt text under 10 chars (the cheap-model alt regeneration is the
//      03-06 real-chain path; this deterministic path fails the entry).
//   3. generate + sharp encode + atomic slot writes via prepareAssets,
//      verifying every recorded file exists on disk before touching the
//      registry (registry state follows disk state, never the reverse).
//   4. Record entry.images and saveShard. Stage stays 'outlined'.
//
// Idempotency: entries that already carry entry.images are skipped with a
// logged note — reruns never duplicate generation.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadShard, saveShard } from '../registry';
import {
  createImageProvider,
  DEFAULT_IMAGES_OUT_DIR,
  prepareAssets,
  type GeneratedAsset,
  type ImageConcept,
  type ImageProvider,
} from '../images';
import type { RegistryEntry, ImageSlot } from '../types';
import type { StageResult } from '../run';
import type { SiloSlug } from '../../silos';
import { SILO_SLUGS } from '../../silos';

/** Runtime batch bound (T-03-14): total image SLOTS generated per run, across
 * all entries. Excess entries park at 'outlined' with a visible note and are
 * picked up by the next run (resumable, D-09/D-10 posture). */
export const MAX_IMAGES_PER_RUN = 6;

/** Default committed-brief root (D-11) — outlines live next to their briefs. */
const DEFAULT_BRIEFS_DIR = 'content/briefs';

/** Loose stage context — same contract note as sibling stages: the
 * orchestrated runner passes full APIs; the plan verify + tests pass null,
 * and this stage binds the RAW registry functions to ctx.registryDir. */
export interface AssetsStageContext {
  registryDir: string;
  registry: unknown;
  budget: unknown;
  log: (message: string) => void;
}

interface ParsedSlots {
  hasBlock: boolean;
  hasHeroLine: boolean;
  hero: string;
  inArticle: string[];
}

/** Pull the `## Image slots` block out of a committed outline artifact. */
export function parseImageSlots(markdown: string): ParsedSlots {
  const lines = markdown.split(/\r?\n/);
  const parsed: ParsedSlots = { hasBlock: false, hasHeroLine: false, hero: '', inArticle: [] };
  let inBlock = false;
  for (const line of lines) {
    if (/^#{2}\s+image slots\b/i.test(line.trim())) {
      inBlock = true;
      parsed.hasBlock = true;
      continue;
    }
    if (inBlock && /^##\s/.test(line.trim())) break; // next section: block ended
    if (!inBlock) continue;
    const hero = /^-\s*hero:\s*(.+)$/i.exec(line.trim());
    if (hero !== null) {
      parsed.hasHeroLine = true;
      parsed.hero = hero[1].trim().replace(/\s*\(ALWAYS\)\s*$/i, '').trim();
      continue;
    }
    const inline = /^-\s*in-article-([12]):\s*(.*)$/i.exec(line.trim());
    if (inline !== null) {
      const value = inline[2].trim();
      if (value.length === 0 || /^none$/i.test(value)) continue; // not flagged
      parsed.inArticle.push(value);
    }
  }
  return parsed;
}

function persistEntry(registryDir: string, silo: SiloSlug, entry: RegistryEntry): void {
  const shard = loadShard(registryDir, silo);
  const idx = shard.keywords.findIndex((e) => e.id === entry.id);
  if (idx >= 0) shard.keywords[idx] = entry;
  else shard.keywords.push(entry);
  shard.updatedAt = new Date().toISOString();
  saveShard(registryDir, silo, shard);
}

/** Fact-check generated files BEFORE recording registry state. */
function assertFilesOnDisk(slug: string, assets: GeneratedAsset[], outDir: string): void {
  for (const asset of assets) {
    const files = [asset.avifPath, asset.webpPath, ...(asset.ogAvifPath ? [asset.ogAvifPath] : []), ...(asset.ogJpgPath ? [asset.ogJpgPath] : [])];
    for (const path of files) {
      const fileName = path.split('/').pop();
      if (!existsSync(join(outDir, slug, fileName ?? ''))) {
        throw new Error(`image file missing after prepareAssets: ${path} — registry state must follow disk state`);
      }
    }
  }
}

/**
 * Stage entrypoint (03-01 contract): `runStage(ctx) -> StageResult`.
 * `opts.briefsDir` overrides the committed-brief root; `opts.outDir` and
 * `opts.provider` exist for tests to sandbox the image work. Production
 * callers omit all three.
 */
export async function runStage(
  ctx: AssetsStageContext,
  opts: { briefsDir?: string; outDir?: string; provider?: ImageProvider } = {},
): Promise<StageResult> {
  const briefsDir = opts.briefsDir ?? DEFAULT_BRIEFS_DIR;
  const outDir = opts.outDir ?? DEFAULT_IMAGES_OUT_DIR;
  const provider = opts.provider ?? createImageProvider();
  const registryDir = ctx.registryDir;
  const notes: string[] = [];
  const slotsUsed = { current: 0 };
  let stopped = false;

  for (const silo of SILO_SLUGS) {
    if (stopped) break;
    const entries = loadShard(registryDir, silo)
      .keywords.filter((e) => e.stage === 'outlined')
      .sort((a, b) => {
        const byDate = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
        if (!Number.isNaN(byDate) && byDate !== 0) return byDate;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

    for (const entry of entries) {
      if (stopped) break;

      // idempotent lane: already-wired entries are never touched again
      if (entry.images) {
        notes.push(`${entry.id}: assets already wired — skipped (idempotent rerun)`);
        continue;
      }

      // 1) outline artifact + parse gates
      const outlineFile = join(briefsDir, silo, `${entry.id}-outline.md`);
      let markdown: string;
      try {
        markdown = readFileSync(outlineFile, 'utf8');
      } catch {
        notes.push(`${entry.id}: parked — outline artifact missing at ${join(silo, `${entry.id}-outline.md`)} (D-11: assets only attach to committed outlines)`);
        continue;
      }
      const slots = parseImageSlots(markdown);
      if (!slots.hasBlock) {
        notes.push(`${entry.id}: parked — outline has no '## Image slots' section (check:outline rule 7 guarantees it; a missing block means the outline predates or bypasses the gate — regenerate the outline)`);
        continue;
      }
      if (!slots.hasHeroLine) {
        notes.push(`${entry.id}: parked — image slots block has no '- hero:' line (hero is ALWAYS required per D-13)`);
        continue;
      }
      if (/none captured in the brief/i.test(slots.hero)) {
        notes.push(`${entry.id}: parked — hero concept says 'none captured in the brief'; the assets stage never invents image concepts (add a hero concept to the brief + outline first)`);
        continue;
      }
      // alt text = the concept line itself, 10-char floor (PIPE-05 enforced alt;
      // the cheap-model regeneration path belongs to the 03-06 real chain)
      const altFail = (label: string, value: string) =>
        value.trim().length < 10
          ? `${entry.id}: parked — alt text under 10 chars on slot '${label}' ('${value.trim().slice(0, 40)}') — the 03-06 real chain may regenerate alt via the cheap title-desc model`
          : null;
      const heroFail = altFail('hero', slots.hero);
      if (heroFail !== null) {
        notes.push(heroFail);
        continue;
      }
      const inArticle: string[] = [];
      let inlineFail: string | null = null;
      for (const concept of slots.inArticle) {
        const check = altFail('in-article', concept);
        if (check !== null) {
          inlineFail = check;
          break;
        }
        inArticle.push(concept);
      }
      if (inlineFail !== null) {
        notes.push(inlineFail);
        continue;
      }

      // 2) runtime batch bound (T-03-14) — no partial entry through a cap
      const wantedSlots = 1 + inArticle.length;
      if (slotsUsed.current + wantedSlots > MAX_IMAGES_PER_RUN) {
        notes.push(
          `image cap reached: MAX_IMAGES_PER_RUN=${MAX_IMAGES_PER_RUN} (slot budget: ${slotsUsed.current}/${MAX_IMAGES_PER_RUN} used) — ${entry.id} and any remaining entries left at 'outlined' for the next run`,
        );
        stopped = true;
        break;
      }

      // 3) free generate + encode + write (fixture/procedural; zero spend)
      const concepts: ImageConcept[] = [
        { slot: 'hero', concept: slots.hero, alt: slots.hero },
        ...inArticle.map((concept, i) => ({ slot: (i === 0 ? 'in-article-1' : 'in-article-2') as ImageConcept['slot'], concept, alt: concept })),
      ];
      const assets = await prepareAssets(entry.id, concepts, provider, { outDir });
      assertFilesOnDisk(entry.id, assets, outDir);

      // 4) registry state follows disk state; stage stays 'outlined' (D-09)
      const heroAsset = assets.find((a) => a.slot === 'hero');
      if (!heroAsset) throw new Error(`assets run produced no hero asset for '${entry.id}' (invariant bug)`); // unreachable per concepts assembly
      entry.images = {
        hero: { slot: 'hero', alt: slots.hero, src: heroAsset.avifPath },
        ...(inArticle.length > 0
          ? {
              inArticle: assets
                .filter((a) => a.slot.startsWith('in-article'))
                .map((a, i): ImageSlot => ({ slot: a.slot, alt: inArticle[i] ?? '', src: a.avifPath })),
            }
          : {}),
        completedAt: new Date().toISOString(),
      };
      entry.updatedAt = new Date().toISOString();
      persistEntry(registryDir, silo, entry);
      slotsUsed.current += wantedSlots;
      const slotWord = `${wantedSlots} slot${wantedSlots === 1 ? '' : 's'}`;
      ctx.log(`${entry.id}: images wired (${slotWord}: hero + ${inArticle.length} in-article) — stage remains 'outlined'`);
      notes.push(`${entry.id}: images wired (${slotWord}) via ${provider.name} provider — stage remains 'outlined'`);
    }
  }

  if (slotsUsed.current > 0) {
    notes.push(`image batch: ${slotsUsed.current} slot(s) generated this run (cap ${MAX_IMAGES_PER_RUN}) | spend $0.00 (free ${provider.name} provider)`);
  }
  return { advanced: 0, rejected: 0, spentUsd: 0, notes };
}
