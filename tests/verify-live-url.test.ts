import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pollUntilLive,
  extractJsonLd,
  validateJsonLd,
  scanPlaceholders,
  probeInternalLinks,
  verifyLiveUrl,
  type LiveVerificationReport,
} from '../lib/pipeline/publish/verifier';
import { executeAutomatedRollback } from '../lib/pipeline/publish/rollback';
import { runPublishScheduled } from '../scripts/publish-scheduled';
import { loadShard, saveShard } from '../lib/pipeline/registry';
import { readPipelineState } from '../lib/pipeline/qa/circuit-breaker';
import type { RegistryShard, RegistryEntry } from '../lib/pipeline/types';

const VALID_ARTICLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Top 5 AI Code Editors for 2026 - Comprehensive Guide</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Top 5 AI Code Editors for 2026 - Comprehensive Guide",
    "description": "An in-depth review of the best AI-assisted programming tools.",
    "datePublished": "2026-10-18T10:00:00Z",
    "dateModified": "2026-10-18T12:00:00Z",
    "author": {
      "@type": "Person",
      "name": "Musfiqur Rahman Saimon",
      "url": "https://exclusivesources.online/authors/musfiqur-rahman-saimon"
    }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://exclusivesources.online" },
      { "@type": "ListItem", "position": 2, "name": "Coding", "item": "https://exclusivesources.online/coding" },
      { "@type": "ListItem", "position": 3, "name": "AI Code Editors", "item": "https://exclusivesources.online/blog/top-ai-code-editors-2026" }
    ]
  }
  </script>
</head>
<body>
  <main>
    <h1>Top 5 AI Code Editors for 2026</h1>
    <p>Modern software engineering workflows rely increasingly on intelligent pair programmers.</p>
    <a href="/coding">Explore more coding guides</a>
    <a href="https://exclusivesources.online/about">About Us</a>
  </main>
</body>
</html>
`;

test('pollUntilLive: returns ready immediately when HTTP 200 HTML is returned', async () => {
  const mockFetch = async () =>
    new Response('<html><body>Live</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  const res = await pollUntilLive('https://exclusivesources.online/blog/test-slug', {
    maxWaitMs: 1000,
    initialDelayMs: 0,
    fetchFn: mockFetch as any,
  });

  assert.equal(res.ready, true);
  assert.equal(res.status, 200);
  assert.match(res.html, /Live/);
});

test('pollUntilLive: retries on 404 until 200 is available', async () => {
  let attempts = 0;
  const mockFetch = async () => {
    attempts++;
    if (attempts < 3) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response('<html><body>Ready Now</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };

  const res = await pollUntilLive('https://exclusivesources.online/blog/test-slug', {
    maxWaitMs: 5000,
    initialDelayMs: 10,
    fetchFn: mockFetch as any,
  });

  assert.equal(res.ready, true);
  assert.equal(res.status, 200);
  assert.equal(attempts, 3);
});

test('pollUntilLive: times out if server never returns 200 HTML', async () => {
  const mockFetch = async () => new Response('Still deploying...', { status: 503 });

  const res = await pollUntilLive('https://exclusivesources.online/blog/test-slug', {
    maxWaitMs: 150,
    initialDelayMs: 10,
    fetchFn: mockFetch as any,
  });

  assert.equal(res.ready, false);
  assert.equal(res.status, 503);
  assert.match(res.error || '', /timed out/i);
});

test('extractJsonLd: extracts multiple scripts and ignores malformed blocks', () => {
  const html = `
    <script type="application/ld+json">{"@type": "Article", "headline": "Valid"}</script>
    <script type="application/ld+json">{ broken json </script>
    <script type="application/ld+json">{"@type": "BreadcrumbList", "itemListElement": []}</script>
  `;
  const objects = extractJsonLd(html);
  assert.equal(objects.length, 2);
  assert.equal(objects[0]['@type'], 'Article');
  assert.equal(objects[1]['@type'], 'BreadcrumbList');
});

test('validateJsonLd: passes valid Article and BreadcrumbList schemas', () => {
  const result = validateJsonLd(VALID_ARTICLE_HTML);
  assert.equal(result.valid, true);
  assert.equal(result.articleFound, true);
  assert.equal(result.articleValid, true);
  assert.equal(result.breadcrumbFound, true);
  assert.equal(result.breadcrumbValid, true);
  assert.equal(result.errors.length, 0);
});

test('validateJsonLd: validates schema nested inside @graph', () => {
  const graphHtml = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "A Comprehensive Review of Modern Web Tools",
        "author": { "@type": "Person", "name": "Musfiqur Rahman Saimon" },
        "datePublished": "2026-10-18T10:00:00Z"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home" }]
      }
    ]
  }
  </script>
  `;
  const result = validateJsonLd(graphHtml);
  assert.equal(result.valid, true);
  assert.equal(result.articleValid, true);
  assert.equal(result.breadcrumbValid, true);
});

test('validateJsonLd: fails when Article schema is missing or invalid', () => {
  const badHtml = `
  <script type="application/ld+json">
  {
    "@type": "Article",
    "headline": "Short",
    "datePublished": "invalid-date"
  }
  </script>
  `;
  const result = validateJsonLd(badHtml);
  assert.equal(result.valid, false);
  assert.equal(result.articleValid, false);
  assert.ok(result.errors.some((e) => e.includes('headline')));
  assert.ok(result.errors.some((e) => e.includes('author')));
  assert.ok(result.errors.some((e) => e.includes('datePublished')));
  assert.ok(result.errors.some((e) => e.includes('BreadcrumbList')));
});

test('scanPlaceholders: passes clean article HTML', () => {
  const result = scanPlaceholders(VALID_ARTICLE_HTML);
  assert.equal(result.passed, true);
  assert.equal(result.clean, true);
  assert.equal(result.matches.length, 0);
});

test('scanPlaceholders: detects [TODO], [Insert], [Draft], [TBD], and lorem ipsum', () => {
  const dirtyHtml = `
  <p>Here is an introduction.</p>
  <p>[TODO: Add comparison table between ChatGPT and Claude]</p>
  <div>[Insert screenshot of configuration here]</div>
  <span>[Draft section on pricing]</span>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
  <!-- TODO: review internal links before publish -->
  `;
  const result = scanPlaceholders(dirtyHtml);
  assert.equal(result.passed, false);
  assert.ok(result.matches.some((m) => /TODO/i.test(m)));
  assert.ok(result.matches.some((m) => /Insert screenshot/i.test(m)));
  assert.ok(result.matches.some((m) => /Draft/i.test(m)));
  assert.ok(result.matches.some((m) => /Lorem ipsum/i.test(m)));
  assert.ok(result.matches.some((m) => /<!-- TODO:/i.test(m)));
});

test('scanPlaceholders: detects undefined, null, and NaN text interpolation bugs', () => {
  const bugHtml = `
  <div>
    <h1>Welcome undefined!</h1>
    <p>The total score is NaN out of 100.</p>
    <span>Value: null</span>
  </div>
  `;
  const result = scanPlaceholders(bugHtml);
  assert.equal(result.passed, false);
  assert.ok(result.matches.includes('undefined'));
  assert.ok(result.matches.includes('NaN'));
  assert.ok(result.matches.includes('null'));
});

test('scanPlaceholders: ignores code snippets containing null or undefined', () => {
  const codeHtml = `
  <pre><code>const value = null; if (typeof value === "undefined") { return; }</code></pre>
  `;
  const result = scanPlaceholders(codeHtml);
  assert.equal(result.passed, true);
});

test('probeInternalLinks: verifies 200 OK for internal links and catches broken links', async () => {
  const mockFetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/coding')) {
      return new Response(null, { status: 200 });
    }
    if (url.includes('/broken-route')) {
      return new Response(null, { status: 404 });
    }
    return new Response(null, { status: 200 });
  };

  const html = `
    <a href="/coding">Coding</a>
    <a href="/broken-route">Broken</a>
    <a href="https://external.com/docs">External</a>
    <a href="#section">Anchor</a>
    <a href="/_next/static/chunk.js">Asset</a>
  `;

  const result = await probeInternalLinks(html, 'https://exclusivesources.online', mockFetch as any);
  assert.equal(result.allPassed, false);
  assert.equal(result.probedCount, 2);
  assert.equal(result.brokenLinks.length, 1);
  assert.equal(result.brokenLinks[0].href, '/broken-route');
  assert.equal(result.brokenLinks[0].status, 404);
});

test('verifyLiveUrl: completes full verification successfully for compliant live page', async () => {
  const mockFetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/blog/top-ai-code-editors-2026')) {
      return new Response(VALID_ARTICLE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }
    return new Response(null, { status: 200 });
  };

  const report = await verifyLiveUrl('https://exclusivesources.online/blog/top-ai-code-editors-2026', {
    maxWaitMs: 1000,
    initialDelayMs: 0,
    fetchFn: mockFetch as any,
  });

  assert.equal(report.passed, true);
  assert.equal(report.status, 200);
  assert.equal(report.jsonLd.valid, true);
  assert.equal(report.placeholders.passed, true);
  assert.equal(report.links.allPassed, true);
  assert.match(report.summary, /^PASSED:/);
});

test('verifyLiveUrl: reports failure when live page contains placeholders and broken link', async () => {
  const dirtyHtml = VALID_ARTICLE_HTML
    .replace('Modern software', 'Modern software [TODO: finish this]')
    .replace('href="/coding"', 'href="/dead-link-404"');

  const mockFetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/dead-link-404')) {
      return new Response(null, { status: 404 });
    }
    return new Response(dirtyHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };

  const report = await verifyLiveUrl('https://exclusivesources.online/blog/top-ai-code-editors-2026', {
    maxWaitMs: 1000,
    initialDelayMs: 0,
    fetchFn: mockFetch as any,
  });

  assert.equal(report.passed, false);
  assert.equal(report.placeholders.passed, false);
  assert.equal(report.links.allPassed, false);
  assert.match(report.summary, /^FAILED:/);
});

function setupTestEnv(testDir: string) {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(join(testDir, 'posts'), { recursive: true });
  mkdirSync(join(testDir, 'quarantine'), { recursive: true });
  for (const s of ['ai-writing', 'ai-coding', 'ai-image', 'ai-productivity', 'ai-guides']) {
    mkdirSync(join(testDir, 'keywords', s), { recursive: true });
    writeFileSync(
      join(testDir, 'keywords', s, 'registry.json'),
      JSON.stringify({ version: 1, updatedAt: '2026-10-18T00:00:00.000Z', keywords: [] }),
      'utf8',
    );
  }
}

test('executeAutomatedRollback: moves post to quarantine, updates registry, records circuit-breaker, and calls git unpublish commands', async () => {
  const testDir = join(process.cwd(), 'tests', 'tmp-rollback-exec');
  setupTestEnv(testDir);
  const postsDir = join(testDir, 'posts');
  const quarantineDir = join(testDir, 'quarantine');
  const keywordsDir = join(testDir, 'keywords');

  // Create post file
  const postFile = join(postsDir, 'sample-failing-post.mdx');
  writeFileSync(postFile, '# Sample Corrupted Post\n[TODO: fix]', 'utf8');

  // Create registry shard
  const initialEntry: RegistryEntry = {
    id: 'kw-rollback-test',
    keyword: 'sample rollback keyword',
    silo: 'ai-coding',
    stage: 'published',
    createdAt: '2026-10-18T01:00:00.000Z',
    updatedAt: '2026-10-18T01:00:00.000Z',
    draft: { slug: 'sample-failing-post', attempts: 1 },
    qa: { passedAt: '2026-10-18T01:00:00.000Z' },
  };
  const shard: RegistryShard = {
    version: 1,
    updatedAt: '2026-10-18T01:00:00.000Z',
    keywords: [initialEntry],
  };
  saveShard(keywordsDir, 'ai-coding', shard);

  const mockFailureReport: LiveVerificationReport = {
    passed: false,
    url: 'https://exclusivesources.online/blog/sample-failing-post',
    durationMs: 450,
    status: 200,
    checks: [{ name: 'banned_placeholders', passed: false, message: 'Found [TODO: fix]' }],
    jsonLd: {
      valid: false,
      articleFound: false,
      articleValid: false,
      breadcrumbFound: false,
      breadcrumbValid: false,
      errors: ['Missing Article schema'],
    },
    placeholders: { passed: false, clean: false, matches: ['[TODO: fix]'] },
    links: { allPassed: true, probedCount: 0, brokenLinks: [] },
    summary: 'FAILED: Live URL failed verification: banned_placeholders: Found [TODO: fix]',
  };

  const executedGitCommands: string[] = [];
  const mockExecGit = async (cmd: string) => {
    executedGitCommands.push(cmd);
  };

  const rollbackResult = await executeAutomatedRollback({
    entryId: 'kw-rollback-test',
    slug: 'sample-failing-post',
    silo: 'ai-coding',
    failureReport: mockFailureReport,
    postsDir,
    quarantineDir,
    keywordsDir,
    dryRun: false,
    execGit: mockExecGit,
  });

  assert.equal(rollbackResult.rolledBack, true);
  assert.equal(existsSync(postFile), false);
  assert.equal(existsSync(join(quarantineDir, 'kw-rollback-test.mdx')), true);
  assert.equal(existsSync(rollbackResult.reportPath), true);

  // Verify incident report content
  const incidentReport = JSON.parse(readFileSync(rollbackResult.reportPath, 'utf8'));
  assert.equal(incidentReport.entryId, 'kw-rollback-test');
  assert.equal(incidentReport.slug, 'sample-failing-post');
  assert.equal(incidentReport.reason, 'live_verification_failed');

  // Verify registry entry transitioned to 'quarantined'
  const updatedShard = loadShard(keywordsDir, 'ai-coding');
  const updatedEntry = updatedShard.keywords.find((k) => k.id === 'kw-rollback-test');
  assert.equal(updatedEntry?.stage, 'quarantined');
  assert.equal(updatedEntry?.quarantine?.failedRule, 'live_verification_failed');

  // Verify circuit breaker logged failure
  const state = readPipelineState(keywordsDir);
  assert.equal(state.consecutiveFailures, 1);
  assert.equal(state.failureHistory[0].id, 'kw-rollback-test');
  assert.equal(state.failureHistory[0].failedRule, 'live_verification_failed');

  // Verify git rollback commands were issued
  assert.equal(executedGitCommands.length, 3);
  assert.match(executedGitCommands[0], /git add/);
  assert.match(executedGitCommands[1], /git commit -m "\[auto-unpublish\] sample-failing-post: live verification failed \[skip ci\]"/);
  assert.match(executedGitCommands[2], /git push origin master/);

  rmSync(testDir, { recursive: true, force: true });
});

test('runPublishScheduled with verifyLive: executes automated rollback when live verification fails', async () => {
  const testDir = join(process.cwd(), 'tests', 'tmp-rollback-fail');
  setupTestEnv(testDir);
  const postsDir = join(testDir, 'posts');
  const quarantineDir = join(testDir, 'quarantine');
  const keywordsDir = join(testDir, 'keywords');

  // Create post file
  const postFile = join(postsDir, 'bad-live-post.mdx');
  writeFileSync(postFile, '# Bad Post\n[TODO]', 'utf8');

  // Create drafted candidate
  const entry: RegistryEntry = {
    id: 'kw-verify-fail',
    keyword: 'bad keyword candidate',
    silo: 'ai-coding',
    stage: 'drafted',
    createdAt: '2026-10-18T01:00:00.000Z',
    updatedAt: '2026-10-18T01:00:00.000Z',
    brief: { completedAt: '2026-10-18T01:00:00.000Z' },
    outline: { completedAt: '2026-10-18T01:00:00.000Z', lint: 'pass' },
    draft: { slug: 'bad-live-post', attempts: 1 },
    qa: { passedAt: '2026-10-18T01:00:00.000Z' },
  };
  const shard: RegistryShard = {
    version: 1,
    updatedAt: '2026-10-18T01:00:00.000Z',
    keywords: [entry],
  };
  saveShard(keywordsDir, 'ai-coding', shard);

  // Mock fetch that returns placeholder in HTML
  const mockFetch = async () =>
    new Response('<html><body><h1>Bad</h1><p>[TODO: unfinished draft]</p></body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

  const executedGitCommands: string[] = [];
  const mockExecGit = async (cmd: string) => {
    executedGitCommands.push(cmd);
  };

  await assert.rejects(
    async () => {
      await runPublishScheduled({
        candidateId: 'kw-verify-fail',
        verifyLive: true,
        keywordsDir,
        quarantineDir,
        postsDir,
        siteUrl: 'https://exclusivesources.online',
        fetchFn: mockFetch as any,
        execGit: mockExecGit,
      });
    },
    (err: Error) => {
      assert.match(err.message, /Live verification failed/);
      return true;
    },
  );

  // Post should be moved to quarantine
  assert.equal(existsSync(postFile), false);
  assert.equal(existsSync(join(quarantineDir, 'kw-verify-fail.mdx')), true);

  // Registry entry should be quarantined
  const finalShard = loadShard(keywordsDir, 'ai-coding');
  assert.equal(finalShard.keywords[0].stage, 'quarantined');
  assert.equal(finalShard.keywords[0].quarantine?.failedRule, 'live_verification_failed');

  // Rollback git commit should have been called
  assert.ok(executedGitCommands.some((c) => c.includes('[auto-unpublish] bad-live-post')));

  rmSync(testDir, { recursive: true, force: true });
});

test('runPublishScheduled with verifyLive: succeeds and publishes candidate when live verification passes', async () => {
  const testDir = join(process.cwd(), 'tests', 'tmp-rollback-pass');
  setupTestEnv(testDir);
  const postsDir = join(testDir, 'posts');
  const quarantineDir = join(testDir, 'quarantine');
  const keywordsDir = join(testDir, 'keywords');

  // Create post file
  const postFile = join(postsDir, 'good-live-post.mdx');
  writeFileSync(postFile, '# Good Post\nClean content', 'utf8');

  // Create drafted candidate
  const entry: RegistryEntry = {
    id: 'kw-verify-pass',
    keyword: 'good keyword candidate',
    silo: 'ai-coding',
    stage: 'drafted',
    createdAt: '2026-10-18T01:00:00.000Z',
    updatedAt: '2026-10-18T01:00:00.000Z',
    brief: { completedAt: '2026-10-18T01:00:00.000Z' },
    outline: { completedAt: '2026-10-18T01:00:00.000Z', lint: 'pass' },
    draft: { slug: 'good-live-post', attempts: 1 },
    qa: { passedAt: '2026-10-18T01:00:00.000Z' },
  };
  const shard: RegistryShard = {
    version: 1,
    updatedAt: '2026-10-18T01:00:00.000Z',
    keywords: [entry],
  };
  saveShard(keywordsDir, 'ai-coding', shard);

  // Mock fetch that returns VALID_ARTICLE_HTML
  const mockFetch = async () =>
    new Response(VALID_ARTICLE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

  const res = await runPublishScheduled({
    candidateId: 'kw-verify-pass',
    verifyLive: true,
    keywordsDir,
    quarantineDir,
    postsDir,
    siteUrl: 'https://exclusivesources.online',
    fetchFn: mockFetch as any,
  });

  assert.equal(res.status, 'published');
  assert.equal(res.slug, 'good-live-post');

  // Shard should be published
  const finalShard = loadShard(keywordsDir, 'ai-coding');
  assert.equal(finalShard.keywords[0].stage, 'published');
  assert.ok(finalShard.keywords[0].publishedAt);

  rmSync(testDir, { recursive: true, force: true });
});
