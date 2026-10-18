import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { submitGscSitemap } from '../lib/pipeline/indexing/google-search-console';
import { dispatchDualTrackIndexing } from '../lib/pipeline/indexing/index';

test('submitGscSitemap: returns skipped-no-creds when credentials are missing', async () => {
  const origEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const origKey = process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;

  try {
    const res = await submitGscSitemap({
      siteUrl: 'https://exclusivesources.online',
      sitemapUrl: 'https://exclusivesources.online/sitemap/0.xml',
    });

    assert.equal(res.status, 'skipped-no-creds');
    assert.equal(res.siteUrl, 'https://exclusivesources.online');
    assert.equal(res.sitemapUrl, 'https://exclusivesources.online/sitemap/0.xml');
    assert.ok(res.message?.includes('skipped-no-creds'));
  } finally {
    if (origEmail !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = origEmail;
    else delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (origKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = origKey;
    else delete process.env.GOOGLE_PRIVATE_KEY;
  }
});

test('submitGscSitemap: sanitizes literal \\n in private key and submits via client', async () => {
  let capturedSiteUrl = '';
  let capturedFeedpath = '';

  const mockClient = {
    sitemaps: {
      submit: async (params: { siteUrl: string; feedpath: string }) => {
        capturedSiteUrl = params.siteUrl;
        capturedFeedpath = params.feedpath;
        return { status: 200 };
      },
    },
  };

  const rawKeyWithEscapedNewlines =
    '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...\\n-----END PRIVATE KEY-----';

  const res = await submitGscSitemap({
    siteUrl: 'https://exclusivesources.online',
    sitemapUrl: 'https://exclusivesources.online/sitemap/0.xml',
    clientEmail: 'service-account@project.iam.gserviceaccount.com',
    privateKey: rawKeyWithEscapedNewlines,
    searchConsoleClient: mockClient,
  });

  assert.equal(res.status, 'submitted');
  assert.equal(capturedSiteUrl, 'https://exclusivesources.online/');
  assert.equal(capturedFeedpath, 'https://exclusivesources.online/sitemap/0.xml');
});

test('submitGscSitemap: catches API submission errors and returns status error without throwing', async () => {
  const mockClient = {
    sitemaps: {
      submit: async () => {
        throw new Error('Google Search Console 403 Forbidden: User does not own site');
      },
    },
  };

  const res = await submitGscSitemap({
    siteUrl: 'https://exclusivesources.online',
    sitemapUrl: 'https://exclusivesources.online/sitemap/0.xml',
    clientEmail: 'service-account@project.iam.gserviceaccount.com',
    privateKey: 'some-private-key',
    searchConsoleClient: mockClient,
  });

  assert.equal(res.status, 'error');
  assert.ok(res.message?.includes('User does not own site'));
});

test('dispatchDualTrackIndexing: coordinates IndexNow and GSC and writes to indexing-log.json', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'indexing-test-'));

  try {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };

    const mockGscClient = {
      sitemaps: {
        submit: async () => ({ status: 200 }),
      },
    };

    const result = await dispatchDualTrackIndexing({
      postUrl: 'https://exclusivesources.online/blog/chatgpt-vs-claude-coding-2026',
      slug: 'chatgpt-vs-claude-coding-2026',
      sitemapUrl: 'https://exclusivesources.online/sitemap/0.xml',
      siteUrl: 'https://exclusivesources.online',
      keywordsDir: tempDir,
      indexNowKey: 'testkey1234567890',
      fetchFn: mockFetch,
      gscClient: mockGscClient,
      clientEmail: 'service@account.com',
      privateKey: 'valid-key',
    });

    assert.equal(result.slug, 'chatgpt-vs-claude-coding-2026');
    assert.equal(result.indexnow.status, 'submitted');
    assert.equal(result.gsc.status, 'submitted');

    // Verify written log file
    const logPath = join(tempDir, 'indexing-log.json');
    assert.ok(existsSync(logPath));

    const content = JSON.parse(readFileSync(logPath, 'utf8'));
    assert.ok(Array.isArray(content));
    assert.equal(content.length, 1);
    assert.equal(content[0].slug, 'chatgpt-vs-claude-coding-2026');
    assert.equal(content[0].indexnow.status, 'submitted');
    assert.equal(content[0].gsc.status, 'submitted');

    // Run a second dispatch to verify append behavior
    await dispatchDualTrackIndexing({
      postUrl: 'https://exclusivesources.online/blog/second-post',
      slug: 'second-post',
      sitemapUrl: 'https://exclusivesources.online/sitemap/0.xml',
      siteUrl: 'https://exclusivesources.online',
      keywordsDir: tempDir,
      indexNowKey: 'testkey1234567890',
      fetchFn: mockFetch,
      // no GSC credentials this time -> skipped-no-creds
    });

    const updatedContent = JSON.parse(readFileSync(logPath, 'utf8'));
    assert.equal(updatedContent.length, 2);
    assert.equal(updatedContent[1].slug, 'second-post');
    assert.equal(updatedContent[1].gsc.status, 'skipped-no-creds');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
