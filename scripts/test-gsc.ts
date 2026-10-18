import 'dotenv/config';
import { google } from 'googleapis';
import { submitGscSitemap } from '../lib/pipeline/indexing/google-search-console';
import { fetchGscSearchAnalytics } from '../lib/pipeline/analytics/gsc';

async function main() {
  console.log('=== Testing Live GSC Operations ===');

  // Test 1: Sitemaps list on domain property
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/webmasters'],
  });
  const client = google.searchconsole({ version: 'v1', auth });

  console.log('1. Checking Sitemaps for sc-domain:exclusivesources.online:');
  const sitemaps = await client.sitemaps.list({ siteUrl: 'sc-domain:exclusivesources.online' });
  console.log('Existing sitemaps in GSC:', sitemaps.data.sitemap || 'None submitted yet');

  // Test 2: Submitting a sitemap via API
  console.log('2. Submitting /sitemap/0.xml:');
  const submitRes = await submitGscSitemap({
    siteUrl: 'sc-domain:exclusivesources.online',
    sitemapUrl: 'https://exclusivesources.online/sitemap/0.xml',
  });
  console.log('Submit Result:', submitRes);

  // Test 3: Search Analytics query
  console.log('3. Running Search Analytics Query:');
  const analyticsRes = await fetchGscSearchAnalytics({
    siteUrl: 'sc-domain:exclusivesources.online',
    startDate: '2026-09-01',
    endDate: '2026-10-18',
  });
  console.log('Analytics Result:', {
    rowsCount: analyticsRes?.rows?.length ?? 0,
    sitemapRatio: analyticsRes?.sitemapRatio,
  });
}

main().catch(console.error);
