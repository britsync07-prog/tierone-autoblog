// Registry + budget integrity gate for the content pipeline (Plan 03-01,
// D-04/D-08/D-02/D-10). Zero dependencies: parses the git-committed JSON
// shards + spend ledger directly, and reads lib/silos.ts / lib/pipeline/
// types.ts as TEXT (never imports the site or pipeline modules — same parity
// idiom as check-crawl.mjs so import order can never couple the gate).
//
// Enforces:
//   - 5 per-silo shards exist and validate (version, stage vocabulary,
//     rejected=>rejectionReason, promoted-stage required fields, slug-safe ids
//     against path traversal — T-03-01)
//   - "no silent discards" (D-04): any rejected entry MUST carry a reason
//   - spend ledger ops are well-formed (month/service/cost) and the
//     current-month USD sum stays within the envelope + $0.01 (T-03-03)
//   - ⚠ fully-free directive (2026-10-17): free.* services must carry
//     cost === 0 + an integer requests >= 1; the current-month request sum
//     stays within monthlyRequestCap (default 4000) — dfs.* services remain
//     valid so the pre-directive audit trail still validates
//   - seed-topics keys equal SILO_SLUGS and total stays in the 25-40 envelope
//     (D-03)
//
// Run: npm run check:registry — exits 0 + "N passed" or 1 with FAIL lines.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

let passed = 0;
let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`FAIL [${name}]${detail ? ` (${detail})` : ''}`);
  }
}

/** Strip block comments and rest-of-line // comments before regex extraction
 * so comment text can never satisfy a grep-gate (self-invalidating-gate
 * hygiene called out in the plan). */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n');
}

function readSource(relPath) {
  return stripComments(readFileSync(join(ROOT, relPath), 'utf8'));
}

// ---- ground truth from source (single-source rule: never hardcode) ----

const SILO_SLUGS = (() => {
  const src = readSource(join('lib', 'silos.ts'));
  const m = /export\s+const\s+SILO_SLUGS\s*=\s*\[([^\]]*)\]\s*as\s*const;/.exec(src);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
})();

const STAGES = (() => {
  const src = readSource(join('lib', 'pipeline', 'types.ts'));
  const m = /export\s+type\s+RegistryStage\s*=\s*([^;]+);/.exec(src);
  if (!m) return [];
  return [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
})();

// ---- group 1: source ground truth shapes ----

check('silo-source', SILO_SLUGS.length === 5, `SILO_SLUGS parsed = [${SILO_SLUGS.join(', ')}]`);
check(
  'stage-vocab',
  STAGES.length === 6 && STAGES.includes('rejected'),
  `RegistryStage parsed = [${STAGES.join(', ')}] (expected 6 values incl. 'rejected')`,
);

// ---- group 2: per-silo shards ----

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const chainIdx = (stage) => ['expanded', 'filtered', 'briefed', 'outlined', 'drafted'].indexOf(stage);

function validateEntry(silo, e, file, i) {
  const ctx = `${file} entry[${i}] (${e?.id ?? '?'})`;
  check('registry:' + silo, typeof e === 'object' && e !== null, `${ctx}: not an object`);
  if (typeof e !== 'object' || e === null) return;
  check(
    'registry:' + silo,
    typeof e.id === 'string' && ID_RE.test(e.id) && e.id.length <= 120,
    `${ctx}: id is not slug-safe (path traversal guard T-03-01)`,
  );
  check('registry:' + silo, typeof e.keyword === 'string' && e.keyword.trim().length > 0, `${ctx}: keyword required`);
  check('registry:' + silo, e.silo === silo, `${ctx}: silo '${e.silo}' != shard '${silo}'`);

  if (e.stage === 'rejected') {
    // D-04: no silent discards — every rejection carries an auditable reason
    check('registry:' + silo, typeof e.rejectionReason === 'string' && e.rejectionReason.trim().length > 0, `${ctx}: rejected without rejectionReason`);
  } else {
    check('registry:' + silo, STAGES.includes(e.stage), `${ctx}: stage '${e.stage}' not in RegistryStage vocabulary`);
    const idx = chainIdx(e.stage);
    if (idx >= chainIdx('briefed')) {
      check('registry:' + silo, typeof e.brief?.completedAt === 'string' && e.brief.completedAt.length > 0, `${ctx}: stage '${e.stage}' requires brief.completedAt`);
    }
    if (idx >= chainIdx('outlined')) {
      check('registry:' + silo, e.outline?.lint === 'pass', `${ctx}: stage '${e.stage}' requires outline.lint === 'pass'`);
    }
    if (e.stage === 'drafted') {
      check('registry:' + silo, typeof e.draft?.slug === 'string' && e.draft.slug.length > 0, `${ctx}: stage 'drafted' requires draft.slug`);
    }
  }
  if (e.images) {
    check(
      'registry:' + silo,
      typeof e.images.hero?.src === 'string' && e.images.hero.src.length > 0 && typeof e.images.hero?.alt === 'string' && e.images.hero.alt.length > 0,
      `${ctx}: images require non-empty hero.src + hero.alt`,
    );
  }
  check('registry:' + silo, typeof e.createdAt === 'string' && !Number.isNaN(Date.parse(e.createdAt)), `${ctx}: createdAt not ISO-parseable`);
  check('registry:' + silo, typeof e.updatedAt === 'string' && !Number.isNaN(Date.parse(e.updatedAt)), `${ctx}: updatedAt not ISO-parseable`);
}

for (const silo of SILO_SLUGS) {
  const file = join('content', 'keywords', silo, 'registry.json');
  let shard = null;
  try {
    shard = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  } catch (err) {
    check('registry:' + silo, false, `unreadable/broken JSON: ${err.message}`);
    continue;
  }
  check('registry:' + silo, shard?.version === 1, `${file}: version must be 1`);
  check('registry:' + silo, typeof shard?.updatedAt === 'string' && !Number.isNaN(Date.parse(shard.updatedAt)), `${file}: updatedAt missing/unparseable`);
  check('registry:' + silo, Array.isArray(shard?.keywords), `${file}: keywords must be an array`);
  if (Array.isArray(shard?.keywords)) shard.keywords.forEach((e, i) => validateEntry(silo, e, file, i));
}

// ---- group 3: spend ledger (D-02 envelope governance) ----

const LEDGER = join('content', 'keywords', 'spend-ledger.json');
let ledger = null;
try {
  ledger = JSON.parse(readFileSync(join(ROOT, LEDGER), 'utf8'));
} catch (err) {
  check('ledger', false, `unreadable/broken JSON: ${err.message}`);
}
const SERVICES = ['dfs.keyword-ideas', 'dfs.serp', 'free.autocomplete', 'free.trends', 'free.serp', 'free.llm'];
const FREE_SERVICES = ['free.autocomplete', 'free.trends', 'free.serp', 'free.llm'];
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

if (ledger) {
  const envelope = typeof ledger.monthlyEnvelopeUsd === 'number' && Number.isFinite(ledger.monthlyEnvelopeUsd) && ledger.monthlyEnvelopeUsd > 0 ? ledger.monthlyEnvelopeUsd : 25;
  const requestCap = typeof ledger.monthlyRequestCap === 'number' && Number.isInteger(ledger.monthlyRequestCap) && ledger.monthlyRequestCap > 0 ? ledger.monthlyRequestCap : 4000;
  check('ledger', Array.isArray(ledger.ops), `${LEDGER}: ops must be an array`);
  let monthCents = 0;
  let monthRequestsSum = 0;
  const ops = Array.isArray(ledger.ops) ? ledger.ops : [];
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    const ctx = `${LEDGER} ops[${i}]`;
    check('ledger', typeof op === 'object' && op !== null, `${ctx}: not an object`);
    if (typeof op !== 'object' || op === null) continue;
    check('ledger', /^(20\d{2})-(0[1-9]|1[0-2])$/.test(op.month), `${ctx}: month '${op.month}' is not YYYY-MM`);
    check('ledger', SERVICES.includes(op.service), `${ctx}: service '${op.service}' not in ${SERVICES.join('|')}`);
    // ⚠ fully-free directive: free.* ops always $0 + truthful integer requests
    if (FREE_SERVICES.includes(op.service)) {
      check('ledger', op.cost === 0, `${ctx}: free service '${op.service}' must record cost exactly 0 — no USD number ever becomes nonzero (owner directive)`);
      check('ledger', Number.isInteger(op.requests) && op.requests >= 1, `${ctx}: free service '${op.service}' must record an integer requests >= 1 (got ${String(op.requests)})`);
    } else {
      check('ledger', typeof op.cost === 'number' && Number.isFinite(op.cost) && op.cost > 0, `${ctx}: cost must be a positive finite number (T-03-03)`);
    }
    check('ledger', typeof op.ts === 'string' && !Number.isNaN(Date.parse(op.ts)), `${ctx}: ts not ISO-parseable`);
    if (op.month === CURRENT_MONTH) {
      monthCents += Math.round(op.cost * 100);
      if (Number.isInteger(op.requests) && op.requests >= 1) monthRequestsSum += op.requests;
    }
  }
  const monthSpend = monthCents / 100;
  check(
    'ledger',
    monthSpend <= envelope + 0.01,
    `${LEDGER}: current-month spend $${monthSpend.toFixed(2)} exceeds envelope $${envelope.toFixed(2)} + $0.01 tolerance (raise monthlyEnvelopeUsd or stop spending — D-02)`,
  );
  check(
    'ledger',
    monthRequestsSum <= requestCap,
    `${LEDGER}: current-month free-source requests ${monthRequestsSum} exceed monthlyRequestCap ${requestCap} (⚠ fully-free directive request-cap governor — raise monthlyRequestCap in the ledger file or wait for monthly rollover)`,
  );
}

// ---- group 4: seed topics (D-03 25-40 envelope, one-time backfill substrate) ----

let seed = null;
try {
  seed = JSON.parse(readFileSync(join(ROOT, 'content', 'keywords', 'seed-topics.json'), 'utf8'));
} catch (err) {
  check('seed-topics', false, `unreadable/broken JSON: ${err.message}`);
}
if (seed) {
  check('seed-topics', seed.version === 1, 'seed-topics.json: version must be 1');
  const keys = Object.keys(seed.topics ?? {}).sort();
  check('seed-topics', JSON.stringify(keys) === JSON.stringify([...SILO_SLUGS].sort()), `topics keys [${keys.join(', ')}] must equal SILO_SLUGS`);
  let total = 0;
  for (const silo of SILO_SLUGS) {
    const list = seed.topics?.[silo];
    check('seed-topics', Array.isArray(list) && list.length > 0, `topics.${silo} must be a non-empty array`);
    if (!Array.isArray(list)) continue;
    total += list.length;
    for (const topic of list) {
      check('seed-topics', typeof topic === 'string' && topic.trim().length > 0, `topics.${silo} contains a non-string/empty topic`);
    }
  }
  check('seed-topics', total >= 25 && total <= 40, `total seed topics ${total} outside the D-03 25-40 envelope`);
}

// ---- report ----

console.log(`${passed} registry checks passed${failed > 0 ? `, ${failed} failed` : ''}`);
process.exit(failed > 0 ? 1 : 0);
