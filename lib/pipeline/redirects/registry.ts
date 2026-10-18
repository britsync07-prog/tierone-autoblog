// 301 Permanent Redirect Registry & Hygiene Validator (D-06, GROW-02).
//
// Manages declarative 301 redirects stored in content/redirects.json, providing
// validation against self-referential loops, circular pairs, and multi-hop chains,
// and formatting rules for Next.js App Router redirects() config.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface RedirectEntry {
  source: string;       // e.g. "/blog/chatgpt-vs-claude-2024"
  destination: string;  // e.g. "/blog/chatgpt-vs-claude"
  permanent: boolean;   // true for 301 Permanent Redirect
  reason?: string;      // e.g. "Consolidation into updated guide"
  retiredAt?: string;   // ISO datetime string
}

export interface RedirectValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  resolvedDestination?: string;
}

export const DEFAULT_REDIRECTS_PATH = 'content/redirects.json';

/**
 * Loads redirects from the given JSON file path.
 * Fails softly to an empty array if the file is missing, corrupt, or invalid.
 */
export function loadRedirects(filePath: string = DEFAULT_REDIRECTS_PATH): RedirectEntry[] {
  const targetPath = resolve(filePath);
  if (!existsSync(targetPath)) {
    return [];
  }

  try {
    const raw = readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        source: String(item.source || '').trim(),
        destination: String(item.destination || '').trim(),
        permanent: item.permanent !== false,
        reason: typeof item.reason === 'string' ? item.reason : undefined,
        retiredAt: typeof item.retiredAt === 'string' ? item.retiredAt : undefined,
      }))
      .filter((item) => item.source.length > 0 && item.destination.length > 0);
  } catch (err) {
    console.warn(`[redirects] Failed to load ${filePath}:`, err);
    return [];
  }
}

/**
 * Persists redirect entries atomically to content/redirects.json.
 */
export function saveRedirects(entries: RedirectEntry[], filePath: string = DEFAULT_REDIRECTS_PATH): void {
  const targetPath = resolve(filePath);
  const targetDir = dirname(targetPath);
  mkdirSync(targetDir, { recursive: true });

  const tmpPath = `${targetPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  writeFileSync(tmpPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  renameSync(tmpPath, targetPath);
}

/**
 * Validates a redirect entry against existing rules to prevent:
 * 1. Missing leading slash format.
 * 2. Self-referential loop (source === destination).
 * 3. Duplicate source redirect (source already redirected).
 * 4. Circular pair (destination === existing.source AND existing.destination === source).
 * 5. Transitive cycles (A -> B -> C -> A).
 * 6. Multi-hop chains (warns / resolves destination A -> B -> C).
 */
export function validateRedirectEntry(
  entry: RedirectEntry,
  existing: RedirectEntry[] = [],
): RedirectValidationResult {
  const source = entry.source.trim();
  const destination = entry.destination.trim();

  // 1. Path format validation
  if (!source.startsWith('/')) {
    return { valid: false, error: `Source path must start with '/': '${source}'` };
  }
  if (!destination.startsWith('/')) {
    return { valid: false, error: `Destination path must start with '/': '${destination}'` };
  }

  // 2. Self-referential loop
  if (source === destination) {
    return {
      valid: false,
      error: `Self-referential redirect loop detected: source '${source}' cannot redirect to itself.`,
    };
  }

  // 3. Duplicate source check
  const duplicate = existing.find((e) => e.source === source);
  if (duplicate) {
    return {
      valid: false,
      error: `Duplicate redirect source '${source}': already redirects to '${duplicate.destination}'.`,
    };
  }

  // 4. Circular pair check (A -> B when B -> A exists)
  const circularPair = existing.find((e) => e.source === destination && e.destination === source);
  if (circularPair) {
    return {
      valid: false,
      error: `Circular redirect pair detected: '${source}' -> '${destination}' contradicts existing rule '${circularPair.source}' -> '${circularPair.destination}'.`,
    };
  }

  // 5. Transitive cycle detection (A -> B -> ... -> A)
  const visited = new Set<string>([source]);
  let currentDestination = destination;
  let chainDetected = false;

  while (currentDestination) {
    if (visited.has(currentDestination)) {
      return {
        valid: false,
        error: `Circular redirect chain detected: redirect from '${source}' to '${destination}' eventually loops back to '${currentDestination}'.`,
      };
    }
    visited.add(currentDestination);

    const nextHop = existing.find((e) => e.source === currentDestination);
    if (nextHop) {
      chainDetected = true;
      currentDestination = nextHop.destination;
    } else {
      break;
    }
  }

  // Also check if any existing redirect points to `source`, and whether `destination` loops into that
  for (const prev of existing) {
    if (prev.destination === source) {
      // Check if `destination` leads to `prev.source`
      let check = destination;
      const seen = new Set<string>([source, prev.source]);
      while (check) {
        if (check === prev.source) {
          return {
            valid: false,
            error: `Circular redirect chain detected: existing '${prev.source}' -> '${source}' with new '${source}' -> '${destination}' creates a loop.`,
          };
        }
        seen.add(check);
        const hop = existing.find((e) => e.source === check);
        if (hop) {
          check = hop.destination;
        } else {
          break;
        }
      }
    }
  }

  // 6. Multi-hop chain warning & resolution
  if (chainDetected) {
    return {
      valid: true,
      warning: `Multi-hop redirect chain detected: '${source}' -> '${destination}' -> '${currentDestination}'. Recommend updating destination directly to '${currentDestination}'.`,
      resolvedDestination: currentDestination,
    };
  }

  return { valid: true };
}

/**
 * Formats redirect entries for Next.js App Router redirects() config in next.config.mjs.
 */
export function formatForNextConfig(
  entries: RedirectEntry[],
): Array<{ source: string; destination: string; permanent: boolean }> {
  return entries.map((entry) => ({
    source: entry.source,
    destination: entry.destination,
    permanent: entry.permanent,
  }));
}
