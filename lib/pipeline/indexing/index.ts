import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { submitIndexNow, IndexNowResult, IndexNowOptions } from './indexnow';
import { submitGscSitemap, GscSubmitResult, GscSubmitOptions } from './google-search-console';

export * from './indexnow';
export * from './google-search-console';

export interface IndexingLogEntry {
  timestamp: string;
  slug: string;
  postUrl: string;
  sitemapUrl: string;
  indexnow: {
    status: 'submitted' | 'error';
    httpStatus?: number;
    message?: string;
  };
  gsc: {
    status: 'submitted' | 'skipped-no-creds' | 'error';
    message?: string;
  };
}

export interface IndexingRunResult {
  slug: string;
  postUrl: string;
  sitemapUrl: string;
  indexnow: IndexNowResult;
  gsc: GscSubmitResult;
  logEntry: IndexingLogEntry;
}

export interface DualTrackOptions {
  postUrl: string;
  slug: string;
  sitemapUrl: string;
  siteUrl: string;
  keywordsDir?: string;
  indexNowKey?: string;
  fetchFn?: typeof fetch;
  gscClient?: any;
  clientEmail?: string;
  privateKey?: string;
}

export async function dispatchDualTrackIndexing(
  options: DualTrackOptions
): Promise<IndexingRunResult> {
  const { postUrl, slug, sitemapUrl, siteUrl } = options;

  // 1. Submit IndexNow track with both post URL and sitemap URL
  const indexNowPromise = submitIndexNow({
    siteUrl,
    key: options.indexNowKey,
    urlList: [postUrl, sitemapUrl],
    fetchFn: options.fetchFn,
  });

  // 2. Submit Google Search Console sitemap track
  const gscPromise = submitGscSitemap({
    siteUrl,
    sitemapUrl,
    clientEmail: options.clientEmail,
    privateKey: options.privateKey,
    searchConsoleClient: options.gscClient,
  });

  const [indexnowRes, gscRes] = await Promise.all([indexNowPromise, gscPromise]);

  const logEntry: IndexingLogEntry = {
    timestamp: new Date().toISOString(),
    slug,
    postUrl,
    sitemapUrl,
    indexnow: {
      status: indexnowRes.status,
      httpStatus: indexnowRes.httpStatus,
      message: indexnowRes.message,
    },
    gsc: {
      status: gscRes.status,
      message: gscRes.message,
    },
  };

  // 3. Persist to indexing-log.json
  const targetDir = options.keywordsDir ?? join(process.cwd(), 'content', 'keywords');
  const logFilePath = join(targetDir, 'indexing-log.json');

  try {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    let existingLogs: IndexingLogEntry[] = [];
    if (existsSync(logFilePath)) {
      try {
        const raw = readFileSync(logFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          existingLogs = parsed;
        }
      } catch {
        existingLogs = [];
      }
    }

    existingLogs.push(logEntry);
    writeFileSync(logFilePath, JSON.stringify(existingLogs, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[indexing] Warning: failed to write indexing-log.json: ${err}`);
  }

  return {
    slug,
    postUrl,
    sitemapUrl,
    indexnow: indexnowRes,
    gsc: gscRes,
    logEntry,
  };
}
