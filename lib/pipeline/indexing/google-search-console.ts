import { google } from 'googleapis';

export interface GscSubmitOptions {
  siteUrl: string;
  sitemapUrl: string;
  clientEmail?: string;
  privateKey?: string;
  searchConsoleClient?: any;
}

export interface GscSubmitResult {
  status: 'submitted' | 'skipped-no-creds' | 'error';
  siteUrl: string;
  sitemapUrl: string;
  message?: string;
}

export async function submitGscSitemap(options: GscSubmitOptions): Promise<GscSubmitResult> {
  const clientEmail = (options.clientEmail ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)?.trim();
  const rawPrivateKey = (options.privateKey ?? process.env.GOOGLE_PRIVATE_KEY)?.trim();

  if (
    !clientEmail ||
    !rawPrivateKey ||
    clientEmail === 'undefined' ||
    rawPrivateKey === 'undefined'
  ) {
    return {
      status: 'skipped-no-creds',
      siteUrl: options.siteUrl,
      sitemapUrl: options.sitemapUrl,
      message: 'Google Search Console credentials not provisioned (skipped-no-creds).',
    };
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  try {
    const formattedSiteUrl = options.siteUrl.endsWith('/')
      ? options.siteUrl
      : `${options.siteUrl}/`;

    if (options.searchConsoleClient) {
      await options.searchConsoleClient.sitemaps.submit({
        siteUrl: formattedSiteUrl,
        feedpath: options.sitemapUrl,
      });
    } else {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/webmasters'],
      });

      const searchconsole = google.searchconsole({ version: 'v1', auth });

      await searchconsole.sitemaps.submit({
        siteUrl: formattedSiteUrl,
        feedpath: options.sitemapUrl,
      });
    }

    return {
      status: 'submitted',
      siteUrl: options.siteUrl,
      sitemapUrl: options.sitemapUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      siteUrl: options.siteUrl,
      sitemapUrl: options.sitemapUrl,
      message,
    };
  }
}
