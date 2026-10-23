import { google } from 'googleapis';
import { getGscAuth, formatGscSiteUrl } from '../indexing/google-search-console';
import {
  GSC_TIER1_MAP,
  type GscSearchRow,
  type SitemapRatioData,
  type Tier1Geo,
} from './types';

export function normalizeGscCountry(code: string): string {
  const trimmed = (code || '').trim().toLowerCase();
  if (trimmed in GSC_TIER1_MAP) {
    return GSC_TIER1_MAP[trimmed];
  }
  return trimmed.toUpperCase();
}

export interface FetchGscSearchAnalyticsOptions {
  siteUrl: string;
  startDate: string;
  endDate: string;
  clientEmail?: string;
  privateKey?: string;
  searchConsoleClient?: any;
}

export async function fetchGscSearchAnalytics(
  options: FetchGscSearchAnalyticsOptions
): Promise<{ rows: GscSearchRow[]; sitemapRatio: SitemapRatioData } | null> {
  let searchconsole: any;

  if (options.searchConsoleClient) {
    searchconsole = options.searchConsoleClient;
  } else {
    const auth = getGscAuth({
      clientEmail: options.clientEmail,
      privateKey: options.privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    if (!auth) {
      return null;
    }

    searchconsole = google.searchconsole({ version: 'v1', auth });
  }

  const formattedSiteUrl = formatGscSiteUrl(options.siteUrl);

  try {
    const queryRes = await searchconsole.searchanalytics.query({
      siteUrl: formattedSiteUrl,
      requestBody: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: ['country', 'page', 'query'],
        rowLimit: 5000,
      },
    });

    const rows: GscSearchRow[] = (queryRes.data?.rows || []).map((row: any) => {
      const [countryKey, pageKey, queryKey] = row.keys || [];
      return {
        country: normalizeGscCountry(countryKey || ''),
        page: pageKey || '',
        query: queryKey || '',
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
      };
    });

    const sitemapsList: Array<{ path: string; submitted: number; indexed: number }> = [];
    let totalSubmitted = 0;
    let totalIndexed = 0;

    try {
      const smRes = await searchconsole.sitemaps.list({ siteUrl: formattedSiteUrl });
      for (const sm of smRes.data?.sitemap || []) {
        let smSubmitted = 0;
        let smIndexed = 0;
        for (const c of sm.contents || []) {
          if (c.type === 'web' || !c.type) {
            smSubmitted += Number(c.submitted || 0);
            smIndexed += Number(c.indexed || 0);
          }
        }
        totalSubmitted += smSubmitted;
        totalIndexed += smIndexed;
        sitemapsList.push({
          path: sm.path || '',
          submitted: smSubmitted,
          indexed: smIndexed,
        });
      }
    } catch (smErr) {
      console.warn(
        '[gsc] Warning querying sitemaps.list:',
        smErr instanceof Error ? smErr.message : String(smErr)
      );
    }

    const ratio = totalSubmitted > 0 ? totalIndexed / totalSubmitted : 0;
    const sitemapRatio: SitemapRatioData = {
      submitted: totalSubmitted,
      indexed: totalIndexed,
      ratio,
      sitemaps: sitemapsList,
    };

    return { rows, sitemapRatio };
  } catch (err) {
    console.warn(
      '[gsc] Error fetching GSC search analytics:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
