// Live URL verifier & multi-point post-publish DOM validator (D-04/D-05, Plan 05-03).
//
// Verifies live production deployments after publishing:
// 1. Exponential backoff polling until HTTP 200 with text/html is served (up to 180s).
// 2. Strict JSON-LD validation: Article (headline, author, datePublished) and BreadcrumbList.
// 3. Zero-tolerance scan for hallucination/placeholder tokens ([TODO], [Insert], lorem ipsum, undefined, NaN).
// 4. Probes extracted internal links to prevent 404 crawl waste.

export interface PollUntilLiveOptions {
  maxWaitMs?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  customFetch?: typeof fetch;
}

export interface PollUntilLiveResult {
  ready: boolean;
  ok: boolean;
  status: number;
  html: string;
  durationMs: number;
  error?: string;
}

export interface JsonLdValidationResult {
  valid: boolean;
  articleFound: boolean;
  articleValid: boolean;
  breadcrumbFound: boolean;
  breadcrumbValid: boolean;
  errors: string[];
}

export interface PlaceholderScanResult {
  passed: boolean;
  clean: boolean;
  matches: string[];
}

export interface InternalLinkProbeResult {
  allPassed: boolean;
  probedCount: number;
  brokenLinks: { href: string; status: number }[];
}

export interface VerificationCheckResult {
  name: string;
  passed: boolean;
  message?: string;
  details?: unknown;
}

export interface LiveVerificationOptions {
  timeoutMs?: number;
  maxWaitMs?: number;
  initialDelayMs?: number;
  probeLinks?: boolean;
  siteUrl?: string;
  fetchFn?: typeof fetch;
  customFetch?: typeof fetch;
}

export interface LiveVerificationReport {
  passed: boolean;
  url: string;
  durationMs: number;
  status: number;
  checks: VerificationCheckResult[];
  jsonLd: JsonLdValidationResult;
  placeholders: PlaceholderScanResult;
  links: InternalLinkProbeResult;
  summary: string;
  htmlSnippet?: string;
}

const DEFAULT_MAX_WAIT_MS = 180000; // 3 minutes
const DEFAULT_INITIAL_DELAY_MS = 10000; // 10 seconds

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls the live URL with exponential backoff until HTTP 200 HTML is returned or timeout expires.
 */
export async function pollUntilLive(
  url: string,
  optionsOrTimeout?: PollUntilLiveOptions | number,
  customFetchArg?: typeof fetch,
): Promise<PollUntilLiveResult> {
  const startTime = Date.now();

  let maxWaitMs = DEFAULT_MAX_WAIT_MS;
  let delayMs = DEFAULT_INITIAL_DELAY_MS;
  let fetchFn: typeof fetch = typeof fetch !== 'undefined' ? fetch : (null as unknown as typeof fetch);

  if (typeof optionsOrTimeout === 'number') {
    maxWaitMs = optionsOrTimeout;
    if (customFetchArg) {
      fetchFn = customFetchArg;
      delayMs = 0;
    }
  } else if (optionsOrTimeout && typeof optionsOrTimeout === 'object') {
    if (optionsOrTimeout.maxWaitMs !== undefined) maxWaitMs = optionsOrTimeout.maxWaitMs;
    else if (optionsOrTimeout.timeoutMs !== undefined) maxWaitMs = optionsOrTimeout.timeoutMs;

    if (optionsOrTimeout.fetchFn) fetchFn = optionsOrTimeout.fetchFn;
    else if (optionsOrTimeout.customFetch) fetchFn = optionsOrTimeout.customFetch;

    if (optionsOrTimeout.initialDelayMs !== undefined) {
      delayMs = optionsOrTimeout.initialDelayMs;
    } else if (optionsOrTimeout.fetchFn || optionsOrTimeout.customFetch) {
      delayMs = 0;
    }
  }

  if (delayMs > 0) {
    await sleep(delayMs);
  }

  let lastStatus = 0;
  let lastError: string | undefined;

  while (Date.now() - startTime <= maxWaitMs) {
    try {
      const res = await fetchFn(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'TierOne-LiveVerifier/1.0 (Autonomous Post-Publish Verification)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      lastStatus = res.status;
      const contentType = res.headers.get('content-type') || '';

      if (res.status === 200 && (contentType.includes('text/html') || !contentType)) {
        const html = await res.text();
        return {
          ready: true,
          ok: true,
          status: 200,
          html,
          durationMs: Date.now() - startTime,
        };
      } else {
        lastError = `Received HTTP ${res.status} with content-type: ${contentType}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitMs) {
      break;
    }

    // Step backoff: min 100ms, increase delay by 1.5x up to 45s cap
    delayMs = Math.min(Math.max(delayMs * 1.5, 100), 45000);
    const nextWait = Math.min(delayMs, Math.max(maxWaitMs - elapsed, 0));
    if (nextWait <= 0) break;
    await sleep(nextWait);
  }

  return {
    ready: false,
    ok: false,
    status: lastStatus,
    html: '',
    durationMs: Date.now() - startTime,
    error: `Deployment polling timed out after ${maxWaitMs}ms. Last response: ${lastError || 'No response'}`,
  };
}

/**
 * Extracts and parses all application/ld+json script blocks from the rendered HTML.
 */
export function extractJsonLd(html: string): any[] {
  const jsonObjects: any[] = [];
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const rawContent = match[1].trim();
    if (!rawContent) continue;
    try {
      const parsed = JSON.parse(rawContent);
      if (Array.isArray(parsed)) {
        jsonObjects.push(...parsed);
      } else {
        jsonObjects.push(parsed);
      }
    } catch {
      // Corrupted JSON script block
    }
  }

  return jsonObjects;
}

/**
 * Validates parsed JSON-LD objects or raw HTML for Article and BreadcrumbList schemas.
 */
export function validateJsonLd(htmlOrObjects: string | any[]): JsonLdValidationResult {
  const objects: any[] =
    typeof htmlOrObjects === 'string' ? extractJsonLd(htmlOrObjects) : htmlOrObjects;

  // Flatten @graph if present
  const allNodes: any[] = [];
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    if (Array.isArray(obj['@graph'])) {
      allNodes.push(...obj['@graph']);
    } else {
      allNodes.push(obj);
    }
  }

  const errors: string[] = [];
  let articleFound = false;
  let articleValid = false;
  let breadcrumbFound = false;
  let breadcrumbValid = false;

  for (const node of allNodes) {
    if (!node || typeof node !== 'object') continue;
    const rawType = node['@type'];
    const types: string[] = Array.isArray(rawType) ? rawType : [rawType];

    // Check Article / BlogPosting schema
    if (types.some((t) => ['Article', 'BlogPosting', 'NewsArticle'].includes(t))) {
      articleFound = true;
      const articleErrors: string[] = [];

      if (!node.headline || typeof node.headline !== 'string' || node.headline.trim().length < 10) {
        articleErrors.push('Article schema missing valid headline (min 10 characters)');
      }

      const author = node.author;
      const hasAuthorName =
        (typeof author === 'string' && author.trim().length > 0) ||
        (author && typeof author === 'object' && typeof author.name === 'string' && author.name.trim().length > 0) ||
        (Array.isArray(author) && author.length > 0);

      if (!hasAuthorName) {
        articleErrors.push('Article schema missing valid author name');
      }

      if (!node.datePublished || isNaN(Date.parse(node.datePublished))) {
        articleErrors.push('Article schema missing valid datePublished ISO string');
      }

      if (articleErrors.length === 0) {
        articleValid = true;
      } else {
        errors.push(...articleErrors);
      }
    }

    // Check BreadcrumbList schema
    if (types.includes('BreadcrumbList')) {
      breadcrumbFound = true;
      const breadcrumbErrors: string[] = [];
      const items = node.itemListElement || node.items;

      if (!Array.isArray(items) || items.length === 0) {
        breadcrumbErrors.push('BreadcrumbList schema missing itemListElement items');
      }

      if (breadcrumbErrors.length === 0) {
        breadcrumbValid = true;
      } else {
        errors.push(...breadcrumbErrors);
      }
    }
  }

  if (!articleFound) {
    errors.push('No Article or BlogPosting JSON-LD schema found in document');
  }
  if (!breadcrumbFound) {
    errors.push('No BreadcrumbList JSON-LD schema found in document');
  }

  const valid = articleFound && articleValid && breadcrumbFound && breadcrumbValid && errors.length === 0;

  return {
    valid,
    articleFound,
    articleValid,
    breadcrumbFound,
    breadcrumbValid,
    errors,
  };
}

/**
 * Scans HTML for prohibited placeholder tokens, unrendered template tags, or draft artifacts.
 */
export function scanPlaceholders(html: string): PlaceholderScanResult {
  const matches: string[] = [];

  // 1. Check for HTML comments with TODO before stripping comments
  const commentTodoRegex = /<!--\s*(?:TODO|FIXME|PLACEHOLDER)[^>]*-->/gi;
  let commentMatch: RegExpExecArray | null;
  while ((commentMatch = commentTodoRegex.exec(html)) !== null) {
    matches.push(commentMatch[0].trim());
  }

  // 2. Strip <script>, <style>, and HTML comments to avoid false flags in JS/CSS payloads
  const cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 3. Scan for banned editorial markers
  const explicitMarkers = [
    /\[TODO\b[^\]]*\]?/gi,
    /\[Insert\b[^\]]*\]?/gi,
    /\[Draft\b[^\]]*\]?/gi,
    /\[TBD\b[^\]]*\]?/gi,
    /lorem\s+ipsum/gi,
    /\b(?:FIXME|PLACEHOLDER)\b/i,
  ];

  for (const regex of explicitMarkers) {
    const hits = cleanHtml.match(regex);
    if (hits) {
      matches.push(...hits.map((h) => h.trim()));
    }
  }

  // 4. Scan for interpolation bugs (undefined, NaN, null) outside of <pre>/<code> blocks
  const nonCodeHtml = cleanHtml
    .replace(/<pre\b[^<]*(?:(?!<\/pre>)<[^<]*)*<\/pre>/gi, '')
    .replace(/<code\b[^<]*(?:(?!<\/code>)<[^<]*)*<\/code>/gi, '');

  // Check for undefined / NaN / null appearing in text nodes or attribute values
  const textBugRegex = /(?:>|\b)(?:undefined|NaN|null)(?:<|\b)/g;
  let bugMatch: RegExpExecArray | null;
  while ((bugMatch = textBugRegex.exec(nonCodeHtml)) !== null) {
    const hit = bugMatch[0].replace(/[><]/g, '').trim();
    if (['undefined', 'NaN', 'null'].includes(hit)) {
      matches.push(hit);
    }
  }

  const uniqueMatches = Array.from(new Set(matches));
  const passed = uniqueMatches.length === 0;

  return {
    passed,
    clean: passed,
    matches: uniqueMatches,
  };
}

/**
 * Probes all internal links found in the HTML to guarantee zero 404 dead ends.
 */
export async function probeInternalLinks(
  html: string,
  siteUrl: string,
  fetchFn: typeof fetch = typeof fetch !== 'undefined' ? fetch : (null as unknown as typeof fetch),
): Promise<InternalLinkProbeResult> {
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const linkRegex = /href=["']([^"']+)["']/gi;
  const rawLinks: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    rawLinks.push(match[1]);
  }

  const internalHrefs = new Set<string>();

  for (const href of rawLinks) {
    const trimmed = href.trim();
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('javascript:')
    ) {
      continue;
    }

    if (trimmed.startsWith('/')) {
      // Exclude Next.js asset chunks and static files
      if (
        trimmed.startsWith('/_next') ||
        trimmed.startsWith('/favicon.ico') ||
        /\.(png|jpe?g|svg|webp|gif|css|js|ico|woff2?)$/i.test(trimmed)
      ) {
        continue;
      }
      internalHrefs.add(trimmed);
    } else if (trimmed.startsWith(cleanSiteUrl)) {
      const rel = trimmed.slice(cleanSiteUrl.length) || '/';
      if (!rel.startsWith('/_next') && !/\.(png|jpe?g|svg|webp|gif|css|js|ico|woff2?)$/i.test(rel)) {
        internalHrefs.add(rel);
      }
    }
  }

  const brokenLinks: { href: string; status: number }[] = [];

  for (const href of internalHrefs) {
    const targetUrl = `${cleanSiteUrl}${href}`;
    try {
      let res = await fetchFn(targetUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'TierOne-LiveVerifier/1.0 (Link Probe)' },
      });

      // If HEAD is not allowed (405), fallback to GET
      if (res.status === 405) {
        res = await fetchFn(targetUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'TierOne-LiveVerifier/1.0 (Link Probe)' },
        });
      }

      if (res.status < 200 || res.status >= 400) {
        brokenLinks.push({ href, status: res.status });
      }
    } catch {
      brokenLinks.push({ href, status: 0 });
    }
  }

  return {
    allPassed: brokenLinks.length === 0,
    probedCount: internalHrefs.size,
    brokenLinks,
  };
}

/**
 * Executes full post-publish verification suite against a live URL.
 */
export async function verifyLiveUrl(
  url: string,
  options: LiveVerificationOptions = {},
): Promise<LiveVerificationReport> {
  const startTime = Date.now();
  const fetchFn = options.fetchFn ?? options.customFetch ?? fetch;
  const siteUrl = options.siteUrl ?? new URL(url).origin;

  const pollResult = await pollUntilLive(url, {
    maxWaitMs: options.maxWaitMs ?? options.timeoutMs,
    initialDelayMs: options.initialDelayMs,
    fetchFn,
  });

  const durationMs = Date.now() - startTime;

  if (!pollResult.ready) {
    return {
      passed: false,
      url,
      durationMs,
      status: pollResult.status,
      checks: [
        {
          name: 'http_polling',
          passed: false,
          message: pollResult.error || `Deployment polling failed with status ${pollResult.status}`,
        },
      ],
      jsonLd: {
        valid: false,
        articleFound: false,
        articleValid: false,
        breadcrumbFound: false,
        breadcrumbValid: false,
        errors: ['Document could not be fetched'],
      },
      placeholders: {
        passed: false,
        clean: false,
        matches: [],
      },
      links: {
        allPassed: false,
        probedCount: 0,
        brokenLinks: [],
      },
      summary: `FAILED: Live URL not reachable (Status: ${pollResult.status}). ${pollResult.error || ''}`,
    };
  }

  const jsonLd = validateJsonLd(pollResult.html);
  const placeholders = scanPlaceholders(pollResult.html);

  let links: InternalLinkProbeResult = {
    allPassed: true,
    probedCount: 0,
    brokenLinks: [],
  };

  if (options.probeLinks !== false) {
    links = await probeInternalLinks(pollResult.html, siteUrl, fetchFn);
  }

  const checks: VerificationCheckResult[] = [
    {
      name: 'http_status',
      passed: pollResult.status === 200,
      message: `HTTP ${pollResult.status} received with valid HTML payload`,
    },
    {
      name: 'json_ld_article',
      passed: jsonLd.articleFound && jsonLd.articleValid,
      message: jsonLd.articleValid
        ? 'Article JSON-LD schema validated'
        : `Article schema errors: ${jsonLd.errors.filter((e) => e.includes('Article')).join('; ') || 'missing'}`,
    },
    {
      name: 'json_ld_breadcrumb',
      passed: jsonLd.breadcrumbFound && jsonLd.breadcrumbValid,
      message: jsonLd.breadcrumbValid
        ? 'BreadcrumbList JSON-LD schema validated'
        : `BreadcrumbList schema errors: ${jsonLd.errors.filter((e) => e.includes('Breadcrumb')).join('; ') || 'missing'}`,
    },
    {
      name: 'banned_placeholders',
      passed: placeholders.passed,
      message: placeholders.passed
        ? 'Zero placeholder or hallucination tokens found'
        : `Banned tokens found: ${placeholders.matches.join(', ')}`,
      details: placeholders.matches,
    },
    {
      name: 'internal_links',
      passed: links.allPassed,
      message: links.allPassed
        ? `All ${links.probedCount} internal links responded 200 OK`
        : `Found ${links.brokenLinks.length} broken internal links: ${links.brokenLinks.map((l) => `${l.href} (${l.status})`).join(', ')}`,
      details: links.brokenLinks,
    },
  ];

  const passed = checks.every((c) => c.passed);
  const failedChecks = checks.filter((c) => !c.passed);

  const summary = passed
    ? `PASSED: Live URL ${url} verified in ${durationMs}ms (HTTP 200, valid schemas, 0 placeholders, ${links.probedCount} healthy links)`
    : `FAILED: Live URL ${url} failed verification: ${failedChecks.map((c) => `${c.name}: ${c.message}`).join(' | ')}`;

  const htmlSnippet = !passed ? pollResult.html.slice(0, 1000) : undefined;

  return {
    passed,
    url,
    durationMs,
    status: pollResult.status,
    checks,
    jsonLd,
    placeholders,
    links,
    summary,
    htmlSnippet,
  };
}
