// Deterministic Pre-Publish Link Crawler (D-09, Plan 04-02).
//
// Crawls all internal and external links in draft markdown:
// 1. Internal routes must resolve to valid static pages, silo hubs, or published
//    post slugs in content/posts/*.mdx. Any broken internal link fails closed (quarantine).
// 2. External links are probed via 4-second HTTP HEAD requests. Dead external links
//    are sanitized by converting [text](deadUrl) to plain text with a warning.

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SILO_SLUGS } from '../../silos';

export interface LinkCrawlResult {
  pass: boolean;
  brokenInternal: string[];
  brokenExternal: string[];
  sanitizedBody?: string;
}

export interface CrawlLinksOptions {
  postsDir?: string;
  probeExternal?: boolean;
  externalTimeoutMs?: number;
}

const DEFAULT_POSTS_DIR = 'content/posts';
const DEFAULT_TIMEOUT_MS = 4000;

// Known static routes in the Next.js app
const STATIC_ROUTES = new Set([
  '/',
  '/about',
  '/editorial-process',
  '/terms',
  '/privacy',
  '/sitemap.xml',
  '/robots.txt',
]);

/**
 * Builds the complete set of valid internal route paths.
 */
export function buildRouteTable(postsDir?: string): Set<string> {
  const routes = new Set<string>(STATIC_ROUTES);

  // Silo hub routes (e.g. /ai-writing)
  for (const silo of SILO_SLUGS) {
    routes.add(`/${silo}`);
  }

  // Published posts in content/posts/
  const dir = resolve(postsDir ?? DEFAULT_POSTS_DIR);
  if (existsSync(dir)) {
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.mdx'));
      for (const f of files) {
        const slug = f.replace(/\.mdx$/, '');
        routes.add(`/posts/${slug}`);
      }
    } catch {
      // Ignore read errors
    }
  }

  return routes;
}

interface MarkdownLink {
  raw: string;
  text: string;
  url: string;
  isInternal: boolean;
}

/**
 * Extracts markdown links [text](url) and <a href="url">.
 */
export function extractLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  // Match [anchor](url) but avoid image links ![alt](url)
  const mdLinkRegex = /(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = mdLinkRegex.exec(markdown)) !== null) {
    const raw = match[0];
    const text = match[1];
    let url = match[2].trim();

    // Remove surrounding quotes if present in URL
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.slice(1, -1);
    }

    const isInternal = url.startsWith('/') && !url.startsWith('//');
    links.push({ raw, text, url, isInternal });
  }

  return links;
}

/**
 * Fast HTTP HEAD probe for external links with 4s timeout.
 */
async function probeExternalUrl(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TierOneLinkChecker/1.0',
        },
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = (err as Error)?.name === 'AbortError';
      if (isAbort) return false;
      // Some servers reject HEAD — retry with GET and immediate abort
      try {
        const getController = new AbortController();
        const getTimer = setTimeout(() => getController.abort(), timeoutMs);
        const getRes = await fetch(url, {
          method: 'GET',
          signal: getController.signal,
          headers: { 'User-Agent': 'TierOneLinkChecker/1.0' },
        });
        clearTimeout(getTimer);
        return getRes.status < 400;
      } catch {
        return false;
      }
    } finally {
      clearTimeout(timer);
    }

    // If 405 Method Not Allowed, fallback to GET
    if (res.status === 405) {
      try {
        const getController = new AbortController();
        const getTimer = setTimeout(() => getController.abort(), timeoutMs);
        const getRes = await fetch(url, {
          method: 'GET',
          signal: getController.signal,
          headers: { 'User-Agent': 'TierOneLinkChecker/1.0' },
        });
        clearTimeout(getTimer);
        return getRes.status < 400;
      } catch {
        return false;
      }
    }

    return res.status < 400;
  } catch {
    return false;
  }
}

/**
 * Validates all links in markdown content (D-09).
 */
export async function crawlLinks(
  markdown: string,
  options?: CrawlLinksOptions,
): Promise<LinkCrawlResult> {
  const probeExternal = options?.probeExternal ?? true;
  const timeoutMs = options?.externalTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const routes = buildRouteTable(options?.postsDir);

  const links = extractLinks(markdown);
  const brokenInternal: string[] = [];
  const brokenExternal: string[] = [];
  let sanitizedBody = markdown;

  for (const link of links) {
    if (link.isInternal) {
      // Internal route validation
      const cleanPath = link.url.split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
      if (!routes.has(cleanPath)) {
        brokenInternal.push(link.url);
      }
    } else if (probeExternal && (link.url.startsWith('http://') || link.url.startsWith('https://'))) {
      const isAlive = await probeExternalUrl(link.url, timeoutMs);
      if (!isAlive) {
        brokenExternal.push(link.url);
        // Sanitize dead external link: convert [text](brokenUrl) to plain text
        sanitizedBody = sanitizedBody.replace(link.raw, link.text);
      }
    }
  }

  // Any broken internal link is a hard failure that fails closed (quarantine)
  const pass = brokenInternal.length === 0;

  return {
    pass,
    brokenInternal,
    brokenExternal,
    sanitizedBody: brokenExternal.length > 0 ? sanitizedBody : undefined,
  };
}
