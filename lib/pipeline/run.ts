import 'dotenv/config';

// Pipeline orchestrator CLI (PIPE-01, D-10): one command chains the stage
// pipeline seed -> ... -> draft, resumable per stage from registry status;
// every stage is also independently runnable for retries/debugging.
//
// Stage README (contract Stage 3 plans implement exactly):
//   export async function runStage(ctx: StageContext): Promise<StageResult>
// A missing stage module is NOT swallowed: the chain prints an honest FAIL
// line and keeps walking so `npm run pipeline` always reports the full
// surface. Serialization is strictly one stage at a time — idempotent resume
// beats parallel speed (ARCHITECTURE Pattern 1).
//
// Keys live in env only (T-03-05): `import 'dotenv/config'` above is the sole
// env origin; no code in this module prints or logs any credential value.

import {
  type Budget,
  BudgetExhaustedError,
  appendSpend as appendSpendRaw,
  assertSpendable as assertSpendableRaw,
  readBudget as readBudgetRaw,
  type SpendOpInput,
} from './budget';
import {
  advance as advanceRaw,
  listByStage as listByStageRaw,
  listPromotable as listPromotableRaw,
  loadShard as loadShardRaw,
  reject as rejectRaw,
  saveShard as saveShardRaw,
} from './registry';
import { SILO_SLUGS, type SiloSlug } from '../silos';
import type { RegistryEntry, RegistryStage, RegistryShard } from './types';

/** CLI stage chain — top-to-bottom run order. `assets` precedes `draft`
 * because drafts reference the hero/in-article images the assets stage
 * produces (PIPE-05 hero preload/feed contract). */
export const STAGE_ORDER = ['expand', 'brief', 'outline', 'assets', 'draft'] as const;
export type StageName = (typeof STAGE_ORDER)[number];

/** What every stage module returns so the runner can print one summary line. */
export interface StageResult {
  advanced: number;
  rejected: number;
  spentUsd: number;
  notes: string[];
}

/** Registry + budget APIs pre-bound to the resolved --registry directory. */
export interface RegistryApi {
  loadShard(silo: SiloSlug): RegistryShard;
  saveShard(silo: SiloSlug, shard: RegistryShard): void;
  listByStage(stage: RegistryStage): RegistryEntry[];
  listPromotable(from: RegistryStage, to: RegistryStage, limit?: number): RegistryEntry[];
  advance(entry: RegistryEntry, to: RegistryStage): RegistryEntry;
  reject(entry: RegistryEntry, reason: string): RegistryEntry;
  silos: readonly SiloSlug[];
}

export interface BudgetApi {
  readBudget(): Budget;
  appendSpend(op: SpendOpInput): void;
  assertSpendable(maxAddlUsd: number): Budget;
}

export interface StageContext {
  registryDir: string;
  registry: RegistryApi;
  budget: BudgetApi;
  log: (message: string) => void;
}

function makeRegistryApi(registryDir: string): RegistryApi {
  return {
    loadShard: (silo) => loadShardRaw(registryDir, silo),
    saveShard: (silo, shard) => saveShardRaw(registryDir, silo, shard),
    listByStage: (stage) => listByStageRaw(registryDir, stage),
    listPromotable: (from, to, limit) => listPromotableRaw(registryDir, from, to, limit),
    advance: (entry, to) => advanceRaw(entry, to),
    reject: (entry, reason) => rejectRaw(entry, reason),
    silos: SILO_SLUGS,
  };
}

function makeBudgetApi(registryDir: string): BudgetApi {
  return {
    readBudget: () => readBudgetRaw(registryDir),
    appendSpend: (op) => appendSpendRaw(registryDir, op),
    assertSpendable: (maxAddlUsd) => assertSpendableRaw(registryDir, maxAddlUsd),
  };
}

interface CliOptions {
  stages: StageName[];
  registryDir: string;
}

function failLine(): void {
  console.log(
    `usage: npm run pipeline [-- --stage ${STAGE_ORDER.join('|')}] [-- --registry <dir>]`,
  );
  process.exit(1);
}

function parseArgs(argv: readonly string[]): CliOptions {
  let stages: StageName[] | null = null;
  let registryDir = 'content/keywords';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--stage') {
      const name = argv[i + 1];
      if (typeof name !== 'string' || !(STAGE_ORDER as readonly string[]).includes(name)) {
        console.log(`FAIL: --stage expects one of ${STAGE_ORDER.join(' | ')} (got '${String(name)}')`);
        failLine();
      }
      if (stages) {
        console.log('FAIL: --stage given more than once — one stage per invocation (D-10 single-slot rule)');
        failLine();
      }
      stages = [name as StageName];
      i += 1;
    } else if (arg === '--registry') {
      const dir = argv[i + 1];
      if (typeof dir !== 'string' || dir.length === 0) {
        console.log('FAIL: --registry expects a directory path');
        failLine();
      }
      registryDir = dir;
      i += 1;
    } else {
      console.log(`FAIL: unknown argument '${arg}'`);
      failLine();
    }
  }
  return { stages: stages ?? [...STAGE_ORDER], registryDir };
}

/** True when an import failure means the stage module does not exist yet
 * (vs. a stage module that exists but threw during import). */
function isMissingStageModule(err: unknown, stage: StageName): boolean {
  const code = (err as { code?: string } | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  const seg = new RegExp(`stages[\\\\/]+${stage}\\b`, 'i');
  return (
    (code === 'ERR_MODULE_NOT_FOUND' || /cannot find (module|package)/i.test(message)) &&
    seg.test(message)
  );
}

async function runPipeline(options: CliOptions): Promise<number> {
  const { stages, registryDir } = options;
  let anyFailure = false;
  let aborted = false;

  for (const stage of stages) {
    // Budget preflight (key link run.ts -> budget.ts): never proceed from an
    // over-spent envelope (D-02). assertSpendable(dir, 0) throws only when
    // already over; stages themselves gate their own planned spend.
    try {
      assertSpendableRaw(registryDir, 0);
    } catch (err) {
      if (err instanceof BudgetExhaustedError) {
        console.log(`FAIL: aborting before stage '${stage}' — ${err.message}`);
        aborted = true;
        break;
      }
      throw err;
    }

    try {
      const mod = await import(`./stages/${stage}.ts`);
      const runStage = (mod as Record<string, unknown>).runStage;
      if (typeof runStage !== 'function') {
        console.log(
          `FAIL: stage '${stage}' declares no runStage(ctx) export (expected lib/pipeline/stages/${stage}.ts)`,
        );
        anyFailure = true;
        continue;
      }
      const ctx: StageContext = {
        registryDir,
        registry: makeRegistryApi(registryDir),
        budget: makeBudgetApi(registryDir),
        log: (message) => console.log(`[${stage}] ${message}`),
      };
      const result = (await (
        runStage as (c: StageContext) => Promise<StageResult>
      )(ctx)) as StageResult;
      console.log(
        `${stage}: advanced=${result.advanced} rejected=${result.rejected} spent=$${result.spentUsd.toFixed(2)}`,
      );
      if (result.notes?.length) console.log(`  notes: ${result.notes.join('; ')}`);
    } catch (err) {
      // Budget exhaustion mid-stage is a D-02 hard stop for the whole run.
      if (err instanceof BudgetExhaustedError) {
        console.log(`FAIL: stage '${stage}' — ${err.message}`);
        aborted = true;
        break;
      }
      if (isMissingStageModule(err, stage)) {
        console.log(
          `FAIL: stage '${stage}' is not implemented yet (expected lib/pipeline/stages/${stage}.ts)`,
        );
      } else {
        console.log(
          `FAIL: stage '${stage}' threw — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      anyFailure = true;
      // keep walking: the full chain must report every stage's true state
    }
  }

  return aborted || anyFailure ? 1 : 0;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  process.exitCode = await runPipeline(options);
}

void main();
