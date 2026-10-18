// Algorithmic N-Gram Shingler & Jaccard Originality Floor (D-07, Plan 04-03).
//
// Computes deterministic 5-gram token shingling and Jaccard similarity
// between a candidate draft and existing published corpus posts / SERP snippets.
// Zero external dependencies, pure TypeScript, sub-millisecond execution.
// Any similarity > 0.70 triggers immediate quarantine as a near-duplicate.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface OriginalityResult {
  pass: boolean;
  maxSimilarity: number;
  matchedSource?: string;
  threshold: number;
}

export interface CheckOriginalityOptions {
  postsDir?: string;
  serpSnippets?: string[];
  threshold?: number;
  currentSlug?: string;
  nGramSize?: number;
}

const DEFAULT_POSTS_DIR = 'content/posts';
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_NGRAM_SIZE = 5;

/**
 * Normalizes and tokenizes text for shingling:
 * - Strips frontmatter, markdown code blocks, links, headers, tables
 * - Converts to lowercase and normalizes whitespace
 * - Extracts clean alphanumeric tokens (length >= 2)
 */
export function tokenize(rawMarkdown: string): string[] {
  let text = rawMarkdown;

  // Strip frontmatter fences
  text = text.replace(/^---[\s\S]*?---\r?\n?/, ' ');

  // Strip fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, ' ');

  // Strip inline code
  text = text.replace(/`[^`]+`/g, ' ');

  // Strip markdown image syntax ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');

  // Strip markdown links [anchor](url) -> keep anchor text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Strip markdown headers (#, ##, etc.)
  text = text.replace(/^#+\s+/gm, ' ');

  // Strip markdown bold/italic/strikethrough markers
  text = text.replace(/[*_~]{1,3}/g, ' ');

  // Lowercase and remove punctuation except spaces
  text = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  // Split on whitespace and filter empty or single-character noise
  return text.split(/\s+/).filter((token) => token.length >= 2);
}

/**
 * Generates sliding window n-grams from a token sequence.
 */
export function createShingles(tokens: string[], n = DEFAULT_NGRAM_SIZE): Set<string> {
  const shingles = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length > 0) {
      shingles.add(tokens.join(' '));
    }
    return shingles;
  }

  for (let i = 0; i <= tokens.length - n; i += 1) {
    shingles.add(tokens.slice(i, i + n).join(' '));
  }

  return shingles;
}

/**
 * Computes Jaccard similarity: |A ∩ B| / |A ∪ B|.
 * Returns a float between 0.0 and 1.0 (rounded to 4 decimal places).
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];

  for (const shingle of smaller) {
    if (larger.has(shingle)) {
      intersectionSize += 1;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0;

  return Math.round((intersectionSize / unionSize) * 10000) / 10000;
}

/**
 * Evaluates candidate draft against all corpus posts and SERP snippets (D-07).
 * Any similarity > threshold (default 0.70) fails originality.
 */
export function checkOriginality(
  draftText: string,
  options?: CheckOriginalityOptions,
): OriginalityResult {
  const threshold = options?.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const nGramSize = options?.nGramSize ?? DEFAULT_NGRAM_SIZE;
  const postsDir = resolve(options?.postsDir ?? DEFAULT_POSTS_DIR);
  const currentSlug = options?.currentSlug;

  const candidateTokens = tokenize(draftText);
  const candidateShingles = createShingles(candidateTokens, nGramSize);

  let maxSimilarity = 0;
  let matchedSource: string | undefined;

  // Compare against published posts in content/posts/
  if (existsSync(postsDir)) {
    try {
      const files = readdirSync(postsDir).filter((f) => f.endsWith('.mdx'));
      for (const file of files) {
        const slug = file.replace(/\.mdx$/, '');
        if (currentSlug && slug === currentSlug) {
          // Do not compare against self
          continue;
        }

        const corpusContent = readFileSync(join(postsDir, file), 'utf8');
        const corpusTokens = tokenize(corpusContent);
        const corpusShingles = createShingles(corpusTokens, nGramSize);
        const sim = jaccardSimilarity(candidateShingles, corpusShingles);

        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          matchedSource = file;
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  // Compare against any cached SERP snippets
  if (options?.serpSnippets && options.serpSnippets.length > 0) {
    options.serpSnippets.forEach((snippet, i) => {
      const serpTokens = tokenize(snippet);
      const serpShingles = createShingles(serpTokens, nGramSize);
      const sim = jaccardSimilarity(candidateShingles, serpShingles);

      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        matchedSource = `serp-snippet-${i + 1}`;
      }
    });
  }

  const pass = maxSimilarity <= threshold;

  return {
    pass,
    maxSimilarity,
    matchedSource: maxSimilarity > 0 ? matchedSource : undefined,
    threshold,
  };
}
