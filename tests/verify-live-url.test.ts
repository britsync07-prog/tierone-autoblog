import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pollUntilLive,
  extractJsonLd,
  validateJsonLd,
  scanPlaceholders,
  probeInternalLinks,
  verifyLiveUrl,
} from '../lib/pipeline/publish/verifier';

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
