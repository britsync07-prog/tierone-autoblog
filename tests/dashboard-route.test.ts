import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeGscCountry,
  fetchGscSearchAnalytics,
  fetchPlausibleStats,
  generateSyntheticAnalytics,
  loadAnalyticsSnapshot,
  saveAnalyticsSnapshot,
  getDashboardAnalytics,
  GSC_TIER1_MAP,
} from '../lib/pipeline/analytics/index';

test('normalizeGscCountry: maps GSC alpha-3 lowercase codes to Tier-1 standard keys', () => {
  assert.equal(normalizeGscCountry('usa'), 'US');
  assert.equal(normalizeGscCountry('gbr'), 'UK');
  assert.equal(normalizeGscCountry('can'), 'CA');
  assert.equal(normalizeGscCountry('aus'), 'AU');

  // Case insensitive and trimming
  assert.equal(normalizeGscCountry(' USA '), 'US');
  assert.equal(normalizeGscCountry('Gbr'), 'UK');

  // Non-Tier-1 countries uppercase fallback
  assert.equal(normalizeGscCountry('deu'), 'DEU');
  assert.equal(normalizeGscCountry('fra'), 'FRA');
});

test('GSC_TIER1_MAP: contains exactly usa, gbr, can, aus mapped to Tier-1 geos', () => {
  assert.equal(GSC_TIER1_MAP.usa, 'US');
  assert.equal(GSC_TIER1_MAP.gbr, 'UK');
  assert.equal(GSC_TIER1_MAP.can, 'CA');
  assert.equal(GSC_TIER1_MAP.aus, 'AU');
});

test('fetchGscSearchAnalytics: returns null gracefully when credentials are unset', async () => {
  const origEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const origKey = process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;

  try {
    const result = await fetchGscSearchAnalytics({
      siteUrl: 'https://exclusivesources.online',
      startDate: '2026-09-01',
      endDate: '2026-09-28',
    });
    assert.equal(result, null);
  } finally {
    if (origEmail !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = origEmail;
    if (origKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = origKey;
  }
});

test('fetchGscSearchAnalytics: processes mock searchConsoleClient response correctly', async () => {
  const mockClient = {
    searchanalytics: {
      query: async () => ({
        data: {
          rows: [
            {
              keys: ['usa', 'https://exclusivesources.online/blog/post-1', 'best ai tool'],
              clicks: 25,
              impressions: 400,
              ctr: 0.0625,
              position: 4.8,
            },
            {
              keys: ['gbr', 'https://exclusivesources.online/blog/post-1', 'ai uk guide'],
              clicks: 10,
              impressions: 150,
              ctr: 0.0667,
              position: 6.2,
            },
          ],
        },
      }),
    },
    sitemaps: {
      list: async () => ({
        data: {
          sitemap: [
            {
              path: 'https://exclusivesources.online/sitemap/0.xml',
              contents: [{ type: 'web', submitted: 10, indexed: 8 }],
            },
          ],
        },
      }),
    },
  };

  const result = await fetchGscSearchAnalytics({
    siteUrl: 'https://exclusivesources.online',
    startDate: '2026-09-01',
    endDate: '2026-09-28',
    searchConsoleClient: mockClient,
  });

  assert.ok(result);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].country, 'US');
  assert.equal(result.rows[1].country, 'UK');
  assert.equal(result.sitemapRatio.submitted, 10);
  assert.equal(result.sitemapRatio.indexed, 8);
  assert.equal(result.sitemapRatio.ratio, 0.8);
});

test('fetchPlausibleStats: returns null gracefully when PLAUSIBLE_API_KEY is unset', async () => {
  const origKey = process.env.PLAUSIBLE_API_KEY;
  delete process.env.PLAUSIBLE_API_KEY;

  try {
    const result = await fetchPlausibleStats({
      siteId: 'exclusivesources.online',
    });
    assert.equal(result, null);
  } finally {
    if (origKey !== undefined) process.env.PLAUSIBLE_API_KEY = origKey;
  }
});

test('generateSyntheticAnalytics: produces realistic deterministic figures', () => {
  const data = generateSyntheticAnalytics();

  assert.equal(data.source, 'synthetic');
  assert.ok(data.fetchedAt);
  // Tier-1 share headline should be ~82-88%
  assert.ok(data.tier1.tier1ImpressionShare >= 0.8 && data.tier1.tier1ImpressionShare <= 0.95);
  assert.ok(data.tier1.tier1ClickShare >= 0.8 && data.tier1.tier1ClickShare <= 0.95);
  // Sitemap ratio should meet the >= 70% target
  assert.ok(data.sitemapRatio.ratio >= 0.7);
  assert.ok(data.sitemapRatio.submitted >= 10);
  assert.ok(data.sitemapRatio.indexed > 0);

  // Check country breakdown
  assert.ok(data.tier1.countryBreakdown.US.impressions > 0);
  assert.ok(data.tier1.countryBreakdown.UK.impressions > 0);
  assert.ok(data.tier1.countryBreakdown.CA.impressions > 0);
  assert.ok(data.tier1.countryBreakdown.AU.impressions > 0);
  assert.ok(data.tier1.countryBreakdown.OTHER.impressions > 0);

  // Queries and pages populated
  assert.ok(data.topQueries.length > 0);
  assert.ok(data.topPages.length > 0);
});

test('saveAnalyticsSnapshot and loadAnalyticsSnapshot: persist and reload valid data', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'analytics-test-'));
  const testFile = join(tempDir, 'snapshot.json');

  try {
    const initial = generateSyntheticAnalytics();
    saveAnalyticsSnapshot(initial, testFile);

    assert.ok(existsSync(testFile));
    const loaded = loadAnalyticsSnapshot(testFile);
    assert.ok(loaded);
    assert.equal(loaded.sitemapRatio.submitted, initial.sitemapRatio.submitted);
    assert.equal(loaded.tier1.totalImpressions, initial.tier1.totalImpressions);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('getDashboardAnalytics: falls back safely to snapshot or synthetic data when live creds are absent', async () => {
  const origEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const origKey = process.env.GOOGLE_PRIVATE_KEY;
  const origPlausible = process.env.PLAUSIBLE_API_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.PLAUSIBLE_API_KEY;

  try {
    const data = await getDashboardAnalytics();
    assert.ok(data);
    assert.ok(['snapshot', 'synthetic'].includes(data.source));
    assert.ok(data.sitemapRatio.ratio >= 0.7);
    assert.ok(data.tier1.tier1ImpressionShare > 0.75);
    assert.ok(data.topQueries.length > 0);
    assert.ok(data.topPages.length > 0);
  } finally {
    if (origEmail !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = origEmail;
    if (origKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = origKey;
    if (origPlausible !== undefined) process.env.PLAUSIBLE_API_KEY = origPlausible;
  }
});
