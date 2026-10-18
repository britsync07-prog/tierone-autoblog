import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBlocklist, checkAuthorByline } from '../lib/pipeline/qa/blocklist';
import { crawlLinks } from '../lib/pipeline/qa/link-crawler';
import { checkOriginality } from '../lib/pipeline/qa/shingle';
import { verifyClaims } from '../lib/pipeline/qa/fact-check';
import { quarantineDraft } from '../lib/pipeline/qa/quarantine';
import {
  readPipelineState,
  recordQaFailure,
  resetCircuitBreaker,
} from '../lib/pipeline/qa/circuit-breaker';

test('Red-Team Attack Vector 1: Planted false statistic triggers quarantine', async () => {
  const tmpDir = join(process.cwd(), 'tmp-redteam-test-1');
  const postsDir = join(tmpDir, 'posts');
  const quarantineDir = join(tmpDir, 'quarantine');
  mkdirSync(postsDir, { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });

  const slug = 'planted-stat-article';
  const postFile = join(postsDir, `${slug}.mdx`);
  const plantedContent = `---
title: "AI Development History and Future Horizons"
author: "musfiqur-rahman-saimon"
---
In 1994, 78% of enterprise software was created autonomously by AI assistants.
Learn more [about](/about) and review our [editorial process](/editorial-process).
`;
  writeFileSync(postFile, plantedContent, 'utf8');

  // Verify claims
  const factRes = await verifyClaims({
    draftBody: plantedContent,
    extractViaLlm: false,
  });

  assert.equal(factRes.pass, false, 'Planted false stat must fail claims gate');
  assert.ok(factRes.criticalFailures.length > 0);
  assert.match(factRes.criticalFailures[0], /Planted false statistic detected/);

  // Quarantine action
  quarantineDraft({
    id: 'planted-stat-article',
    slug,
    failedGate: 'fact-check',
    details: factRes.criticalFailures.join('; '),
    postsDir,
    quarantineDir,
  });

  assert.equal(existsSync(postFile), false, 'Source post must be removed from posts dir');
  assert.equal(existsSync(join(quarantineDir, `${slug}.mdx`)), true, 'Post must be in quarantine');
  const report = JSON.parse(readFileSync(join(quarantineDir, `${slug}-report.json`), 'utf8'));
  assert.equal(report.failedGate, 'fact-check');
  assert.match(report.details, /Planted false statistic/);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('Red-Team Attack Vector 2: Near-duplicate draft (> 0.70 Jaccard) triggers quarantine', () => {
  const tmpDir = join(process.cwd(), 'tmp-redteam-test-2');
  const postsDir = join(tmpDir, 'posts');
  const quarantineDir = join(tmpDir, 'quarantine');
  mkdirSync(postsDir, { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });

  const existingSlug = 'chatgpt-vs-claude-guide';
  const existingContent = `---
title: "ChatGPT vs Claude for Software Engineers in 2026"
---
Artificial intelligence has revolutionized modern software engineering workflows across enterprise organizations.
Teams adopt intelligent code completion to accelerate delivery cycles and reduce repetitive boilerplate development.
When evaluating tools like Claude and ChatGPT, developers look for accuracy, latency, and context window capacity.
In our benchmark tests, Claude Code achieved higher completion rates on complex full-stack refactoring tasks.
`;
  writeFileSync(join(postsDir, `${existingSlug}.mdx`), existingContent, 'utf8');

  // Candidate draft with minor synonym swaps (> 0.70 similarity)
  const candidateSlug = 'chatgpt-versus-claude-clone';
  const candidatePostFile = join(postsDir, `${candidateSlug}.mdx`);
  const candidateContent = `---
title: "ChatGPT vs Claude for Software Engineers in 2026"
---
Artificial intelligence has revolutionized modern software engineering workflows across enterprise organizations.
Teams adopt intelligent code completion to accelerate delivery cycles and reduce repetitive boilerplate development.
When evaluating tools like Claude and ChatGPT, developers look for accuracy, latency, and context window capacity.
In our benchmark tests, Claude Code achieved higher completion rates on challenging full-stack refactoring tasks.
`;
  writeFileSync(candidatePostFile, candidateContent, 'utf8');

  const originalityRes = checkOriginality(candidateContent, {
    postsDir,
    currentSlug: candidateSlug,
    threshold: 0.7,
  });

  assert.equal(originalityRes.pass, false, 'Near duplicate must fail originality gate');
  assert.ok(originalityRes.maxSimilarity > 0.7);

  // Quarantine action
  quarantineDraft({
    id: candidateSlug,
    slug: candidateSlug,
    failedGate: 'originality',
    score: originalityRes.maxSimilarity,
    details: `Exceeded similarity threshold: ${originalityRes.maxSimilarity}`,
    postsDir,
    quarantineDir,
  });

  assert.equal(existsSync(candidatePostFile), false, 'Clone must be removed from posts dir');
  assert.equal(existsSync(join(quarantineDir, `${candidateSlug}.mdx`)), true);
  const report = JSON.parse(readFileSync(join(quarantineDir, `${candidateSlug}-report.json`), 'utf8'));
  assert.equal(report.failedGate, 'originality');

  rmSync(tmpDir, { recursive: true, force: true });
});

test('Red-Team Attack Vector 3: Broken internal link triggers quarantine', async () => {
  const tmpDir = join(process.cwd(), 'tmp-redteam-test-3');
  const postsDir = join(tmpDir, 'posts');
  const quarantineDir = join(tmpDir, 'quarantine');
  mkdirSync(postsDir, { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });

  const slug = 'broken-link-article';
  const postFile = join(postsDir, `${slug}.mdx`);
  const draftContent = `---
title: "Best Coding Tools"
---
Check out our [exclusive guide](/posts/non-existent-hallucinated-slug) for deep insights.
Learn more [about](/about) and review our [editorial process](/editorial-process).
`;
  writeFileSync(postFile, draftContent, 'utf8');

  const linkRes = await crawlLinks(draftContent, { postsDir, probeExternal: false });
  assert.equal(linkRes.pass, false, 'Draft with broken internal link must fail');
  assert.ok(linkRes.brokenInternal.includes('/posts/non-existent-hallucinated-slug'));

  // Quarantine action
  quarantineDraft({
    id: slug,
    slug,
    failedGate: 'link-crawler',
    details: `Broken internal routes: ${linkRes.brokenInternal.join(', ')}`,
    postsDir,
    quarantineDir,
  });

  assert.equal(existsSync(postFile), false, 'Draft must be removed from posts dir');
  assert.equal(existsSync(join(quarantineDir, `${slug}.mdx`)), true);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('Red-Team Attack Vector 4: K=3 consecutive failures trips circuit breaker, halts preflight, and resumes cleanly', () => {
  const tmpDir = join(process.cwd(), 'tmp-redteam-test-4');
  const keywordsDir = join(tmpDir, 'keywords');
  const quarantineDir = join(tmpDir, 'quarantine');
  mkdirSync(keywordsDir, { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });

  // Simulate 3 consecutive draft failures
  recordQaFailure({ id: 'bad-draft-1', failedRule: 'blocklist' }, { keywordsDir, quarantineDir, maxConsecutive: 3 });
  recordQaFailure({ id: 'bad-draft-2', failedRule: 'fact-check' }, { keywordsDir, quarantineDir, maxConsecutive: 3 });
  const tripped = recordQaFailure({ id: 'bad-draft-3', failedRule: 'originality' }, { keywordsDir, quarantineDir, maxConsecutive: 3 });

  assert.equal(tripped, true, '3rd consecutive failure must trip the circuit breaker');

  const state = readPipelineState(keywordsDir);
  assert.equal(state.paused, true, 'Pipeline state must be paused: true');
  assert.equal(state.consecutiveFailures, 3);
  assert.ok(state.pausedAt);

  const alertPath = join(quarantineDir, 'ALERT.md');
  assert.equal(existsSync(alertPath), true, 'ALERT.md must be generated on trip');
  const alertText = readFileSync(alertPath, 'utf8');
  assert.match(alertText, /CIRCUIT BREAKER TRIPPED/);
  assert.match(alertText, /bad-draft-3/);

  // Resume recovery
  const resumedState = resetCircuitBreaker(keywordsDir, quarantineDir);
  assert.equal(resumedState.paused, false);
  assert.equal(resumedState.consecutiveFailures, 0);
  assert.equal(existsSync(alertPath), false, 'ALERT.md must be cleared after resume');

  rmSync(tmpDir, { recursive: true, force: true });
});
