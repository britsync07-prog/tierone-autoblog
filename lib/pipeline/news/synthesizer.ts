import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { completeJson } from '../llm';
import type { DraftFrontmatter } from '../draft-schema';
import type { SiloSlug } from '../../silos';
import type { RawNewsItem, ScoredNewsCandidate } from './types';
import {
  newsSynthesisSchema,
  type NewsSynthesisResult,
  checkBannedPhrases,
  sanitizeBannedPhrases,
  validateNewsBodySections,
  buildBodyMdxFromSections,
} from './synthesis-schema';
import { buildNewsSynthesisPrompt } from './prompts';
import { assembleNewsPostMdx } from './assembler';

export interface SynthesizeNewsOptions {
  mock?: boolean;
  model?: string;
  apiKey?: string;
  llmAdapter?: typeof completeJson;
  jsonFixture?: unknown;
  publishedAt?: string;
  silo?: SiloSlug | 'ai-news';
}

export interface NewsSynthesisOutput extends NewsSynthesisResult {
  post: DraftFrontmatter;
  frontmatter: DraftFrontmatter;
  rawJson: string;
  mdxContent: string;
}

function loadDefaultMock(): NewsSynthesisResult {
  const fixturePath = join(
    process.cwd(),
    'tests',
    'fixtures',
    'news',
    'mock-synthesis.json',
  );
  const raw = readFileSync(fixturePath, 'utf8');
  return newsSynthesisSchema.parse(JSON.parse(raw));
}

/**
 * Synthesizes a journalistic news article from a raw or scored candidate story.
 * Incorporates anti-buzzword filtering, strict section validation, and MDX assembly.
 */
export async function synthesizeNewsArticle(
  candidate: RawNewsItem | ScoredNewsCandidate,
  options?: SynthesizeNewsOptions,
): Promise<NewsSynthesisOutput> {
  let synthesized: NewsSynthesisResult;
  let rawJson = '';

  const isMockMode =
    options?.mock === true ||
    (!process.env.LLM_BASE_URL && !process.env.LLM_API_KEY);

  if (options?.jsonFixture !== undefined) {
    const complete = options?.llmAdapter ?? completeJson;
    const res = await complete<NewsSynthesisResult>({
      task: 'generic-structured',
      zodSchema: newsSynthesisSchema,
      messages: [],
      jsonFixture: options.jsonFixture,
    });
    synthesized = res.parsed;
    rawJson = res.raw;
  } else if (isMockMode && !options?.llmAdapter) {
    synthesized = loadDefaultMock();
    rawJson = JSON.stringify(synthesized);
  } else {
    const prompt = buildNewsSynthesisPrompt(candidate);
    const complete = options?.llmAdapter ?? completeJson;
    const res = await complete<NewsSynthesisResult>({
      task: 'generic-structured',
      maxTokens: 6000,
      zodSchema: newsSynthesisSchema,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });
    synthesized = res.parsed;
    rawJson = res.raw;
  }

  // Anti-buzzword check and automatic sanitization
  const fieldsToCheck = [
    synthesized.title,
    synthesized.description,
    synthesized.tldr,
    synthesized.bodyMdx ?? '',
    synthesized.whatHappened ?? '',
    synthesized.whyItMatters ?? '',
    synthesized.industryImpact ?? '',
  ].join(' ');

  const violations = checkBannedPhrases(fieldsToCheck);
  if (violations.length > 0) {
    synthesized = {
      ...synthesized,
      title: sanitizeBannedPhrases(synthesized.title),
      description: sanitizeBannedPhrases(synthesized.description),
      tldr: sanitizeBannedPhrases(synthesized.tldr),
      bodyMdx: synthesized.bodyMdx
        ? sanitizeBannedPhrases(synthesized.bodyMdx)
        : undefined,
      whatHappened: synthesized.whatHappened
        ? sanitizeBannedPhrases(synthesized.whatHappened)
        : undefined,
      whyItMatters: synthesized.whyItMatters
        ? sanitizeBannedPhrases(synthesized.whyItMatters)
        : undefined,
      industryImpact: synthesized.industryImpact
        ? sanitizeBannedPhrases(synthesized.industryImpact)
        : undefined,
    };
  }

  // Ensure body markdown is fully generated
  if (!synthesized.bodyMdx || synthesized.bodyMdx.trim().length < 1200) {
    synthesized.bodyMdx = buildBodyMdxFromSections(synthesized);
  }

  // Verify mandatory journalistic H2 headers
  const sectionCheck = validateNewsBodySections(synthesized.bodyMdx);
  if (!sectionCheck.valid) {
    // Reconstruct body from sections to guarantee missing headers
    synthesized.bodyMdx = buildBodyMdxFromSections(synthesized);
    const retryCheck = validateNewsBodySections(synthesized.bodyMdx);
    if (!retryCheck.valid) {
      throw new Error(
        `Generated news article is missing mandatory sections: ${retryCheck.missingSections.join(', ')}`,
      );
    }
  }

  // Assemble frontmatter and final MDX
  const assembled = assembleNewsPostMdx(synthesized, candidate.link, {
    publishedAt: options?.publishedAt,
    silo: options?.silo,
  });

  return {
    ...synthesized,
    post: assembled.frontmatter,
    frontmatter: assembled.frontmatter,
    rawJson,
    mdxContent: assembled.mdxContent,
  };
}
