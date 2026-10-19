import type { RawNewsItem, ScoredNewsCandidate } from './types';
import { BANNED_EDITORIAL_PHRASES } from './synthesis-schema';

export const NEWS_SYSTEM_PROMPT = `You are a senior tech editor and investigative AI journalist writing for an authoritative publication (exclusivesources.online).
You are covering a breaking tech/AI event based on verified feed inputs.

STRICT EDITORIAL RULES:
1. Title must be exactly 50-60 characters, in active journalistic voice, naming the specific model, company, or tool.
2. Description must be exactly 150-160 characters, providing a complete informative summary with no cliffhangers.
3. Slug must be lowercase kebab-case between 15-70 characters (e.g. 'anthropic-claude-3-7-sonnet-hybrid-reasoning-release').
4. TL;DR must be under 100 words, highlighting the 3 most crucial takeaways.
5. Provide 3-4 high-intent search FAQs with clear, factual answers (q >= 10 chars, a >= 20 chars).
6. Body must be a comprehensive, authoritative long-form deep-dive (1,500-2,200 words minimum, >= 1200 characters) written in valid MDX containing exactly these H2 sections in order:
   - ## The Breakdown: What Happened (detailed factual analysis, architecture, exact release specs, 400-600 words)
   - ## Why It Matters for Developers & Engineers (practical workflow, code snippets in TypeScript/Python, migration instructions, 500-700 words)
   - ## Industry Impact & Ecosystem Context (market dynamics, benchmark comparison table, competitive landscape, 350-500 words)
   - ## Verified Sources & Primary Documentation (markdown bullet list with verified link to original source)
7. Include transparency links in the footer: [/editorial-process](/editorial-process) and [/about](/about).
8. Write with objective, analytical rigor. Active voice, verified numbers, real entity names, and actionable engineering details.
9. FORBIDDEN AI BUZZWORDS & CLICHES: Never use any of the following banned phrases:
${BANNED_EDITORIAL_PHRASES.map((p) => `   - "${p}"`).join('\n')}

Output must be a single valid JSON object adhering to the specified schema, without any enclosing markdown fences or commentary.`;

export function buildNewsSynthesisPrompt(
  candidate: RawNewsItem | ScoredNewsCandidate,
): { system: string; user: string } {
  const user = `Synthesize an authoritative, journalistic long-form deep-dive news article covering the following breaking event:

Story Title: ${candidate.title}
Primary Source: ${candidate.source}
Verified URL: ${candidate.link}
Published Date: ${candidate.pubDate}
Summary/Lead: ${candidate.summary}
${'matchedEntities' in candidate && candidate.matchedEntities.length > 0 ? `Key Entities: ${candidate.matchedEntities.join(', ')}` : ''}

CRITICAL REQUIREMENTS:
- Output JSON strictly matching the news synthesis schema.
- Title must be between 50 and 60 characters.
- Description must be between 150 and 160 characters.
- Slug must be lowercase kebab-case (15-70 chars).
- TL;DR must be under 100 words.
- Provide 3-4 FAQs in the "faq" array ({ "q": "...", "a": "..." }).
- MDX body ("bodyMdx") must be a thorough, multi-section 1,500-2,200 word technical deep-dive (>= 1200 chars) with code snippets and comparison tables, containing all four required H2 headers:
  1. "## The Breakdown: What Happened"
  2. "## Why It Matters for Developers & Engineers"
  3. "## Industry Impact & Ecosystem Context"
  4. "## Verified Sources & Primary Documentation"
- In the "Verified Sources & Primary Documentation" section, include the exact primary citation link:
  [${candidate.source}: ${candidate.title}](${candidate.link})
- Include links to [/editorial-process](/editorial-process) and [/about](/about).
- Zero banned buzzwords.`;

  return {
    system: NEWS_SYSTEM_PROMPT,
    user,
  };
}

/**
 * Alias for buildNewsSynthesisPrompt.
 */
export const buildNewsPrompt = buildNewsSynthesisPrompt;
