import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { quarantineDraft, updateQuarantineSummary } from '../lib/pipeline/qa/quarantine';

test('quarantineDraft moves file, writes report JSON, and generates SUMMARY.md', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-quarantine');
  const postsDir = join(tmpDir, 'posts');
  const quarantineDir = join(tmpDir, 'quarantine');

  mkdirSync(postsDir, { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });

  const slug = 'test-failed-post';
  const postFile = join(postsDir, `${slug}.mdx`);
  writeFileSync(postFile, '---\ntitle: "Test Post"\n---\nBody content', 'utf8');

  assert.equal(existsSync(postFile), true);

  const report = quarantineDraft({
    id: 'test-failed-post',
    slug,
    failedGate: 'originality',
    score: 0.85,
    details: 'Jaccard similarity exceeded 0.70 threshold',
    postsDir,
    quarantineDir,
  });

  // Source post was moved out of postsDir
  assert.equal(existsSync(postFile), false, 'Source post must be removed from posts dir');

  // Quarantined file exists in quarantineDir
  const quarantinedPost = join(quarantineDir, 'test-failed-post.mdx');
  assert.equal(existsSync(quarantinedPost), true, 'Post must exist in quarantine dir');

  // Report JSON exists
  const reportPath = join(quarantineDir, 'test-failed-post-report.json');
  assert.equal(existsSync(reportPath), true, 'Report JSON must exist');
  const reportContent = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(reportContent.id, 'test-failed-post');
  assert.equal(reportContent.failedGate, 'originality');
  assert.equal(reportContent.score, 0.85);

  // SUMMARY.md exists and contains markdown table
  const summaryPath = join(quarantineDir, 'SUMMARY.md');
  assert.equal(existsSync(summaryPath), true, 'SUMMARY.md must exist');
  const summaryContent = readFileSync(summaryPath, 'utf8');
  assert.match(summaryContent, /test-failed-post/);
  assert.match(summaryContent, /originality/);
  assert.match(summaryContent, /0\.85/);

  // Cleanup
  rmSync(tmpDir, { recursive: true, force: true });
});
