// QA Quality Gate Stage (Plan 04-05, QA-01..04).
//
// Evaluates landed drafts in content/posts/ across 5 fail-closed quality gates:
//   Gate 1: Topic blocklist regex scanner & EEAT author byline check
//   Gate 2: Deterministic link crawler (internal route validity + external HEAD probe)
//   Gate 3: Algorithmic N-gram Jaccard shingler (<= 0.70 similarity ceiling)
//   Gate 4: Two-tier fact-checking & source citation verification
//   Gate 5: 4-point Information Gain rubric (>= 3/4 passing score)
//
// Any failure physically isolates the draft to content/quarantine/{id}.mdx,
// generates a companion audit report ({id}-report.json), updates SUMMARY.md,
// transitions the registry entry to 'quarantined', and increments the
// circuit breaker counter in pipeline-state.json.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StageContext, StageResult } from '../run';
import { loadShard, saveShard, quarantineEntry } from '../registry';
import { quarantineDraft } from '../qa/quarantine';
import { recordQaFailure, recordQaSuccess } from '../qa/circuit-breaker';
import { checkBlocklist, checkAuthorByline } from '../qa/blocklist';
import { crawlLinks } from '../qa/link-crawler';
import { checkOriginality } from '../qa/shingle';
import { verifyClaims } from '../qa/fact-check';
import { evaluateInformationGain } from '../qa/info-gain';

export async function runStage(ctx: StageContext): Promise<StageResult> {
  let advanced = 0;
  let rejected = 0;
  const notes: string[] = [];

  const postsDir = 'content/posts';
  const briefsDir = 'content/briefs';

  for (const silo of ctx.registry.silos) {
    const shard = loadShard(ctx.registryDir, silo);
    let shardDirty = false;

    for (const entry of shard.keywords) {
      // Find entries that are drafted but haven't passed QA yet
      if (entry.stage !== 'drafted' || entry.qa?.passedAt) {
        continue;
      }

      const slug = entry.draft?.slug;
      if (!slug) continue;

      const postPath = join(postsDir, `${slug}.mdx`);
      if (!existsSync(postPath)) {
        notes.push(`[${entry.id}] Draft file ${postPath} not found on disk`);
        continue;
      }

      ctx.log(`Evaluating draft for keyword '${entry.keyword}' (${entry.id})`);
      let rawMdx = readFileSync(postPath, 'utf8');

      // -------------------------------------------------------------
      // Gate 1: Topic Blocklist & EEAT Byline Pre-Filter (D-06)
      // -------------------------------------------------------------
      const blocklistRes = checkBlocklist(rawMdx);
      if (!blocklistRes.pass) {
        const details = `Blocked YMYL category '${blocklistRes.category}' detected: [${blocklistRes.violatingTerms.join(', ')}]`;
        ctx.log(`FAIL Gate 1: ${details}`);
        quarantineDraft({
          id: entry.id,
          slug,
          failedGate: 'blocklist',
          score: blocklistRes.category,
          details,
          postsDir,
        });
        quarantineEntry(entry, {
          failedRule: `blocklist:${blocklistRes.category ?? 'unknown'}`,
          reportPath: `content/quarantine/${entry.id}-report.json`,
          quarantinedAt: new Date().toISOString(),
        });
        recordQaFailure({ id: entry.id, failedRule: 'blocklist' }, { keywordsDir: ctx.registryDir });
        shardDirty = true;
        rejected += 1;
        notes.push(`[${entry.id}] Quarantined: ${details}`);
        continue;
      }

      const bylineRes = checkAuthorByline(rawMdx);
      if (!bylineRes.pass) {
        const details = `Byline/EEAT failure: ${bylineRes.reasons.join('; ')}`;
        ctx.log(`FAIL Gate 1: ${details}`);
        quarantineDraft({
          id: entry.id,
          slug,
          failedGate: 'byline-eeat',
          details,
          postsDir,
        });
        quarantineEntry(entry, {
          failedRule: 'byline-eeat',
          reportPath: `content/quarantine/${entry.id}-report.json`,
          quarantinedAt: new Date().toISOString(),
        });
        recordQaFailure({ id: entry.id, failedRule: 'byline-eeat' }, { keywordsDir: ctx.registryDir });
        shardDirty = true;
        rejected += 1;
        notes.push(`[${entry.id}] Quarantined: ${details}`);
        continue;
      }

      // -------------------------------------------------------------
      // Gate 2: Deterministic Link Crawler (D-09)
      // -------------------------------------------------------------
      const linkRes = await crawlLinks(rawMdx, { postsDir });
      if (!linkRes.pass) {
        const details = `Broken internal route(s) detected: [${linkRes.brokenInternal.join(', ')}]`;
        ctx.log(`FAIL Gate 2: ${details}`);
        quarantineDraft({
          id: entry.id,
          slug,
          failedGate: 'link-crawler',
          details,
          postsDir,
        });
        quarantineEntry(entry, {
          failedRule: 'link-crawler:broken-internal',
          reportPath: `content/quarantine/${entry.id}-report.json`,
          quarantinedAt: new Date().toISOString(),
        });
        recordQaFailure({ id: entry.id, failedRule: 'link-crawler' }, { keywordsDir: ctx.registryDir });
        shardDirty = true;
        rejected += 1;
        notes.push(`[${entry.id}] Quarantined: ${details}`);
        continue;
      }

      // If dead external links were stripped, update working markdown
      if (linkRes.sanitizedBody) {
        rawMdx = linkRes.sanitizedBody;
      }

      // -------------------------------------------------------------
      // Gate 3: Algorithmic N-Gram Shingler & Originality Floor (D-07)
      // -------------------------------------------------------------
      const serpSnippets = (entry.serpTop3 ?? []).map((s) => `${s.title} ${s.url}`);
      const originalityRes = checkOriginality(rawMdx, {
        postsDir,
        currentSlug: slug,
        serpSnippets,
        threshold: 0.7,
      });

      if (!originalityRes.pass) {
        const details = `Originality failure: Jaccard similarity ${originalityRes.maxSimilarity} exceeds 0.70 threshold (matched: ${originalityRes.matchedSource})`;
        ctx.log(`FAIL Gate 3: ${details}`);
        quarantineDraft({
          id: entry.id,
          slug,
          failedGate: 'originality',
          score: originalityRes.maxSimilarity,
          details,
          postsDir,
        });
        quarantineEntry(entry, {
          failedRule: 'originality:near-duplicate',
          score: originalityRes.maxSimilarity,
          reportPath: `content/quarantine/${entry.id}-report.json`,
          quarantinedAt: new Date().toISOString(),
        });
        recordQaFailure({ id: entry.id, failedRule: 'originality' }, { keywordsDir: ctx.registryDir });
        shardDirty = true;
        rejected += 1;
        notes.push(`[${entry.id}] Quarantined: ${details}`);
        continue;
      }

      // -------------------------------------------------------------
      // Gate 4: Two-Tier Fact-Checking & Claims Verification (D-04/D-05)
      // -------------------------------------------------------------
      let briefContent = '';
      const briefFile = join(briefsDir, `${entry.id}.md`);
      if (existsSync(briefFile)) {
        try {
          briefContent = readFileSync(briefFile, 'utf8');
        } catch {
          // Ignore
        }
      }

      const factRes = await verifyClaims({
        draftBody: rawMdx,
        briefFacts: briefContent ? [briefContent] : undefined,
        serpSnippets,
      });

      if (!factRes.pass) {
        const failureReasons = [...factRes.criticalFailures, ...factRes.unverifiedStats];
        const details = `Fact-checking failure: ${failureReasons.join('; ')}`;
        ctx.log(`FAIL Gate 4: ${details}`);
        quarantineDraft({
          id: entry.id,
          slug,
          failedGate: 'fact-check',
          details,
          postsDir,
        });
        quarantineEntry(entry, {
          failedRule: 'fact-check:unverified-or-false-claim',
          reportPath: `content/quarantine/${entry.id}-report.json`,
          quarantinedAt: new Date().toISOString(),
        });
        recordQaFailure({ id: entry.id, failedRule: 'fact-check' }, { keywordsDir: ctx.registryDir });
        shardDirty = true;
        rejected += 1;
        notes.push(`[${entry.id}] Quarantined: ${details}`);
        continue;
      }

      // Apply Tier 1 fluff sanitization if any fluff was excised
      if (factRes.sanitizedBody) {
        rawMdx = factRes.sanitizedBody;
      }

      // -------------------------------------------------------------
      // Gate 5: 4-Point Information Gain Rubric (D-08)
      // -------------------------------------------------------------
      const infoGainRes = await evaluateInformationGain({
        draftBody: rawMdx,
        briefContent,
        serpSnippets,
      });

      if (!infoGainRes.pass) {
        const details = `Information gain failure: scored ${infoGainRes.result.totalScore}/4 (requires >= 3). Summary: ${infoGainRes.result.summary}`;
        ctx.log(`FAIL Gate 5: ${details}`);
        quarantineDraft({
          id: entry.id,
          slug,
          failedGate: 'information-gain',
          score: `${infoGainRes.result.totalScore}/4`,
          details,
          postsDir,
        });
        quarantineEntry(entry, {
          failedRule: 'information-gain:thin-gain',
          score: infoGainRes.result.totalScore,
          reportPath: `content/quarantine/${entry.id}-report.json`,
          quarantinedAt: new Date().toISOString(),
        });
        recordQaFailure({ id: entry.id, failedRule: 'information-gain' }, { keywordsDir: ctx.registryDir });
        shardDirty = true;
        rejected += 1;
        notes.push(`[${entry.id}] Quarantined: ${details}`);
        continue;
      }

      // -------------------------------------------------------------
      // ALL 5 GATES PASSED!
      // -------------------------------------------------------------
      // Write sanitized MDX if any dead links or fluff were excised
      writeFileSync(postPath, rawMdx, 'utf8');

      entry.qa = {
        passedAt: new Date().toISOString(),
        informationGainScore: infoGainRes.result.totalScore,
        claimsChecked: 1,
      };

      recordQaSuccess(ctx.registryDir);
      shardDirty = true;
      advanced += 1;
      ctx.log(`PASS: Draft for '${entry.keyword}' passed all 5 quality gates (Gain: ${infoGainRes.result.totalScore}/4).`);
      notes.push(`[${entry.id}] QA passed (Gain ${infoGainRes.result.totalScore}/4)`);
    }

    if (shardDirty) {
      saveShard(ctx.registryDir, silo, shard);
    }
  }

  return {
    advanced,
    rejected,
    spentUsd: 0,
    notes,
  };
}
