import { submitGscSitemap } from '../lib/pipeline/indexing/google-search-console';
import { submitIndexNow } from '../lib/pipeline/indexing/indexnow';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://exclusivesources.online').replace(/\/+$/, '');
const sitemapUrl = `${siteUrl}/sitemap.xml`;

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

async function fetchSitemapUrls(): Promise<string[]> {
  const indexResponse = await fetch(sitemapUrl);
  if (!indexResponse.ok) {
    throw new Error(`Could not fetch sitemap index: HTTP ${indexResponse.status}`);
  }

  const shardUrls = sitemapLocations(await indexResponse.text());
  const pages = await Promise.all(
    shardUrls.map(async (shardUrl) => {
      const response = await fetch(shardUrl);
      if (!response.ok) {
        throw new Error(`Could not fetch sitemap shard ${shardUrl}: HTTP ${response.status}`);
      }
      return sitemapLocations(await response.text());
    }),
  );

  const host = new URL(siteUrl).hostname;
  return [...new Set(pages.flat())].filter((url) => new URL(url).hostname === host);
}

async function main() {
  const urlList = await fetchSitemapUrls();
  const [indexNow, gsc] = await Promise.all([
    submitIndexNow({ siteUrl, urlList }),
    submitGscSitemap({ siteUrl, sitemapUrl }),
  ]);

  console.log(JSON.stringify({ sitemapUrl, submittedUrls: urlList.length, indexNow, gsc }, null, 2));

  if (!indexNow.success || gsc.status !== 'submitted') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
