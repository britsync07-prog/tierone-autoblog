import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import matter from 'gray-matter';
import { draftSchema } from '../draft-schema';
import type { RefreshActionType, RefreshQueueItem } from './types';

export interface ExecuteRefreshOptions {
  postSlug: string;
  actions: RefreshActionType[];
  newFaq?: { q: string; a: string };
  brokenLinks?: string[];
  postsDir?: string;
  dryRun?: boolean;
  probeNetwork?: boolean;
}

export interface RefreshExecutionResult {
  success: boolean;
  applied: boolean;
  actionsApplied: string[];
  modifiedFields: string[];
  warnings: string[];
  filePath?: string;
  error?: string;
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safely unlinks a specific URL from markdown content, preserving anchor text.
 * [Anchor Text](https://broken.com) -> Anchor Text
 */
export function unlinkMarkdownUrl(content: string, url: string): string {
  const escaped = escapeRegex(url);
  const regex = new RegExp(`\\[([^\\]]+)\\]\\(${escaped}\\)`, 'g');
  return content.replace(regex, '$1');
}

/**
 * Probes an external URL to see if it responds with a successful HTTP status.
 */
export async function probeUrl(url: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'TierOneAutoBlog-LinkChecker/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 200 && res.status < 400) {
      return true;
    }
    // If HEAD failed with 405 Method Not Allowed or 403, retry with GET
    if (res.status === 405 || res.status === 403) {
      const getRes = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'TierOneAutoBlog-LinkChecker/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return getRes.status >= 200 && getRes.status < 400;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolves a post file path by slug, checking both direct filename and frontmatter slug.
 */
export function resolvePostFilePath(slug: string, postsDir: string): string | null {
  const dir = isAbsolute(postsDir) ? postsDir : resolve(process.cwd(), postsDir);
  if (!existsSync(dir)) return null;

  // 1. Direct match: {slug}.mdx
  const directPath = join(dir, slug.endsWith('.mdx') ? slug : `${slug}.mdx`);
  if (existsSync(directPath)) {
    return directPath;
  }

  // 2. Scan all .mdx files in postsDir for matching frontmatter slug
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.mdx'));
    for (const file of files) {
      const candidatePath = join(dir, file);
      try {
        const raw = readFileSync(candidatePath, 'utf8');
        const parsed = matter(raw);
        if (parsed.data && parsed.data.slug === slug) {
          return candidatePath;
        }
      } catch {
        // Skip unparseable files
      }
    }
  } catch {
    // Directory unreadable
  }

  return null;
}

/**
 * Executes autonomous, non-destructive refresh actions for an article:
 * - bump-date-modified: Updates frontmatter updatedAt to current ISO timestamp.
 * - inject-faq: Injects striking-distance FAQ strictly obeying the draftSchema 3-5 item limit.
 * - repair-links: Safely unlinks dead external URLs without corrupting prose.
 */
export async function executeRefreshAction(
  target: RefreshQueueItem | ExecuteRefreshOptions,
  maybeOptions?: { postsDir?: string; dryRun?: boolean; probeNetwork?: boolean }
): Promise<RefreshExecutionResult> {
  const warnings: string[] = [];
  const actionsApplied: string[] = [];

  // Normalize parameters
  let postSlug: string;
  let actions: RefreshActionType[];
  let newFaq: { q: string; a: string } | undefined;
  let brokenLinks: string[] | undefined;
  let dryRun: boolean;
  let postsDir: string;
  let probeNetwork: boolean;

  if ('postSlug' in target) {
    postSlug = target.postSlug;
    actions = target.actions;
    newFaq = target.newFaq;
    brokenLinks = target.brokenLinks;
    dryRun = target.dryRun ?? maybeOptions?.dryRun ?? false;
    postsDir = target.postsDir ?? maybeOptions?.postsDir ?? 'content/posts';
    probeNetwork = target.probeNetwork ?? maybeOptions?.probeNetwork ?? false;
  } else {
    // RefreshQueueItem
    postSlug = target.slug;
    actions = target.suggestedActions.map((a) => a.action);
    newFaq = target.suggestedActions.find((a) => a.action === 'inject-faq')?.faqItem;
    brokenLinks = target.diagnostics.brokenLinks;
    dryRun = maybeOptions?.dryRun ?? false;
    postsDir = maybeOptions?.postsDir ?? 'content/posts';
    probeNetwork = maybeOptions?.probeNetwork ?? false;
  }

  const filePath = resolvePostFilePath(postSlug, postsDir);
  if (!filePath) {
    return {
      success: false,
      applied: false,
      actionsApplied: [],
      modifiedFields: [],
      warnings: [`Post file not found for slug '${postSlug}' in '${postsDir}'`],
      error: `Post file not found for slug '${postSlug}'`,
    };
  }

  const fileContent = readFileSync(filePath, 'utf8');
  const parsed = matter(fileContent);
  const data = { ...parsed.data };
  let content = parsed.content;

  // 1. Action: bump-date-modified
  if (actions.includes('bump-date-modified')) {
    data.updatedAt = new Date().toISOString();
    actionsApplied.push('bump-date-modified');
  }

  // 2. Action: inject-faq
  if (actions.includes('inject-faq') && newFaq) {
    const existingFaq = Array.isArray(data.faq) ? [...data.faq] : [];

    if (existingFaq.length < 5) {
      existingFaq.push(newFaq);
      warnings.push(`Injected new FAQ item; count is now ${existingFaq.length}`);
    } else {
      // Guard: strictly obey the 3-5 item limit in draftSchema
      warnings.push(
        `Post already contains ${existingFaq.length} FAQs (maximum allowed is 5). Replacing lowest-value FAQ to prevent draftSchema validation failure.`
      );
      // Replace the last item
      existingFaq[existingFaq.length - 1] = newFaq;
    }

    data.faq = existingFaq;

    // Validate FAQ array specifically against draftSchema
    const faqValidation = draftSchema.shape.faq.safeParse(data.faq);
    if (!faqValidation.success) {
      return {
        success: false,
        applied: false,
        actionsApplied,
        modifiedFields: actionsApplied,
        warnings,
        filePath,
        error: `FAQ validation failed: ${faqValidation.error.message}`,
      };
    }
    actionsApplied.push('inject-faq');
  }

  // 3. Action: repair-links
  if (actions.includes('repair-links')) {
    const deadUrls = new Set<string>(brokenLinks ?? []);

    if (probeNetwork) {
      // Find all external http(s) markdown links in content
      const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
      const discoveredUrls = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(content)) !== null) {
        discoveredUrls.add(match[2]);
      }

      for (const url of discoveredUrls) {
        const isHealthy = await probeUrl(url);
        if (!isHealthy) {
          deadUrls.add(url);
        }
      }
    }

    let linksRepairedCount = 0;
    for (const deadUrl of deadUrls) {
      const before = content;
      content = unlinkMarkdownUrl(content, deadUrl);
      if (content !== before) {
        linksRepairedCount++;
        warnings.push(`Unlinked dead URL: ${deadUrl}`);
      }
    }

    if (linksRepairedCount > 0 || deadUrls.size > 0) {
      actionsApplied.push('repair-links');
    }
  }

  // Re-verify core frontmatter fields with draftSchema.partial()
  const schemaValidation = draftSchema.partial().safeParse(data);
  if (!schemaValidation.success) {
    return {
      success: false,
      applied: false,
      actionsApplied,
      modifiedFields: actionsApplied,
      warnings,
      filePath,
      error: `Frontmatter validation failed: ${schemaValidation.error.message}`,
    };
  }

  // Write file if not dryRun
  if (!dryRun) {
    const updatedFileContent = matter.stringify(content, data);
    writeFileSync(filePath, updatedFileContent, 'utf8');

    // If target was a RefreshQueueItem, mark status as applied
    if ('status' in target) {
      target.status = 'applied';
      target.appliedAt = new Date().toISOString();
    }
  }

  return {
    success: true,
    applied: !dryRun,
    actionsApplied,
    modifiedFields: actionsApplied,
    warnings,
    filePath,
  };
}
