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

export function getGscAuth(
  clientEmailOrOptions?: string | { clientEmail?: string; privateKey?: string; scopes?: string[] },
  privateKeyArg?: string,
  scopesArg?: string[]
) {
  let email: string | undefined;
  let rawKey: string | undefined;
  let scopes: string[] = ['https://www.googleapis.com/auth/webmasters.readonly'];

  if (typeof clientEmailOrOptions === 'object' && clientEmailOrOptions !== null) {
    email = clientEmailOrOptions.clientEmail;
    rawKey = clientEmailOrOptions.privateKey;
    if (clientEmailOrOptions.scopes) scopes = clientEmailOrOptions.scopes;
  } else {
    email = clientEmailOrOptions;
    rawKey = privateKeyArg;
    if (scopesArg) scopes = scopesArg;
  }

  email = (email ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)?.trim();
  rawKey = (rawKey ?? process.env.GOOGLE_PRIVATE_KEY)?.trim();

  if (
    !email ||
    !rawKey ||
    email === 'undefined' ||
    rawKey === 'undefined'
  ) {
    return null;
  }

  const key = rawKey.replace(/\\n/g, '\n');
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes,
  });
}

export function formatGscSiteUrl(siteUrl: string): string {
  const envUrl = process.env.GSC_SITE_URL?.trim();
  const target = envUrl || siteUrl;
  if (target.startsWith('sc-domain:')) {
    return target.replace(/\/+$/, '');
  }
  return target.endsWith('/') ? target : `${target}/`;
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

  try {
    const formattedSiteUrl = formatGscSiteUrl(options.siteUrl);

    if (options.searchConsoleClient) {
      await options.searchConsoleClient.sitemaps.submit({
        siteUrl: formattedSiteUrl,
        feedpath: options.sitemapUrl,
      });
    } else {
      const auth = getGscAuth({
        clientEmail,
        privateKey: rawPrivateKey,
        scopes: ['https://www.googleapis.com/auth/webmasters'],
      });

      if (!auth) {
        return {
          status: 'skipped-no-creds',
          siteUrl: options.siteUrl,
          sitemapUrl: options.sitemapUrl,
          message: 'Google Search Console credentials not provisioned (skipped-no-creds).',
        };
      }

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
