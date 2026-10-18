import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkOriginality,
  createShingles,
  jaccardSimilarity,
  tokenize,
} from '../lib/pipeline/qa/shingle';

test('tokenize strips frontmatter, code, formatting, and extracts clean words', () => {
  const mdx = `---
title: "Sample Post Title"
author: "musfiqur-rahman-saimon"
---
# Main Header
Here is a paragraph with [link text](/link) and **bold keywords**.
\`\`\`typescript
const x = 42;
\`\`\`
Another sentence with *italics*.
`;
  const tokens = tokenize(mdx);
  assert.ok(!tokens.includes('title'));
  assert.ok(!tokens.includes('author'));
  assert.ok(!tokens.includes('typescript'));
  assert.ok(!tokens.includes('const'));
  assert.ok(tokens.includes('main'));
  assert.ok(tokens.includes('header'));
  assert.ok(tokens.includes('paragraph'));
  assert.ok(tokens.includes('link'));
  assert.ok(tokens.includes('bold'));
  assert.ok(tokens.includes('keywords'));
  assert.ok(tokens.includes('sentence'));
});

test('jaccardSimilarity returns 1.0 for identical sets and 0.0 for disjoint sets', () => {
  const tokensA = ['artificial', 'intelligence', 'writing', 'assistant', 'software', 'benchmark'];
  const shinglesA = createShingles(tokensA, 3);

  // Identical sets
  const simSelf = jaccardSimilarity(shinglesA, shinglesA);
  assert.equal(simSelf, 1.0);

  // Disjoint sets
  const tokensB = ['baking', 'chocolate', 'cookies', 'recipe', 'kitchen', 'oven'];
  const shinglesB = createShingles(tokensB, 3);
  const simDisjoint = jaccardSimilarity(shinglesA, shinglesB);
  assert.equal(simDisjoint, 0.0);
});

test('checkOriginality flags near-duplicate (> 0.70) and passes original text', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-shingle-posts');
  mkdirSync(tmpDir, { recursive: true });

  const baseText = `
Artificial intelligence has revolutionized modern software engineering workflows across enterprise organizations.
Teams adopt intelligent code completion to accelerate delivery cycles and reduce repetitive boilerplate development.
When evaluating tools like Claude and ChatGPT, developers look for accuracy, latency, and context window capacity.
In our benchmark tests, Claude Code achieved higher completion rates on complex full-stack refactoring tasks.
`;
  writeFileSync(join(tmpDir, 'existing-article.mdx'), baseText, 'utf8');

  // Near-duplicate draft: 85% identical phrasing with minor word changes
  const nearDuplicate = `
Artificial intelligence has revolutionized modern software engineering workflows across enterprise organizations.
Teams adopt intelligent code completion to accelerate delivery cycles and reduce repetitive boilerplate development.
When evaluating tools like Claude and ChatGPT, developers look for accuracy, latency, and context window capacity.
In our benchmark tests, Claude Code achieved higher completion rates on challenging full-stack refactoring tasks.
`;
  const resNearDup = checkOriginality(nearDuplicate, { postsDir: tmpDir, threshold: 0.7 });
  assert.equal(resNearDup.pass, false, 'Near duplicate must fail originality check');
  assert.ok(resNearDup.maxSimilarity > 0.7, `Expected similarity > 0.7, got ${resNearDup.maxSimilarity}`);
  assert.equal(resNearDup.matchedSource, 'existing-article.mdx');

  // Distinct original draft: topic and phrasing are completely different
  const distinctDraft = `
Video generation algorithms have evolved rapidly with diffusion transformer architectures.
Content creators can synthesize cinematic high-definition scenes from simple descriptive natural language prompts.
Rendering pipelines now integrate physics simulations to ensure fluid motion and realistic camera pans.
`;
  const resDistinct = checkOriginality(distinctDraft, { postsDir: tmpDir, threshold: 0.7 });
  assert.equal(resDistinct.pass, true, 'Original draft must pass check');
  assert.ok(resDistinct.maxSimilarity < 0.2, `Expected low similarity, got ${resDistinct.maxSimilarity}`);

  rmSync(tmpDir, { recursive: true, force: true });
});
