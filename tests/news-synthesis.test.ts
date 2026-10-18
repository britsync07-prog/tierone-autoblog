import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  newsSynthesisSchema,
  validateNewsBodySections,
  checkBannedPhrases,
  sanitizeBannedPhrases,
  REQUIRED_NEWS_SECTIONS,
  BANNED_EDITORIAL_PHRASES,
} from '../lib/pipeline/news/synthesis-schema';
import { buildNewsSynthesisPrompt, buildNewsPrompt } from '../lib/pipeline/news/prompts';
import { assembleNewsPostMdx } from '../lib/pipeline/news/assembler';
import { synthesizeNewsArticle } from '../lib/pipeline/news/synthesizer';
import { draftSchema } from '../lib/pipeline/draft-schema';
import { checkAuthorByline } from '../lib/pipeline/qa/blocklist';
import type { RawNewsItem } from '../lib/pipeline/news/types';

const FIXTURE_PATH = join(
  process.cwd(),
  'tests',
  'fixtures',
  'news',
  'mock-synthesis.json',
);
const mockFixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const sampleCandidate: RawNewsItem = {
  id: 'a1b2c3d4e5f60718',
  title: 'Anthropic Launches Claude 3.7 Sonnet With Hybrid Reasoning',
  link: 'https://www.anthropic.com/news/claude-3-7-sonnet',
  pubDate: '2026-10-18T18:00:00.000Z',
  source: 'Anthropic',
  summary:
    'Anthropic announced Claude 3.7 Sonnet, introducing hybrid reasoning architecture and setting new benchmarks for code synthesis.',
};

test('mock-synthesis.json strictly validates against newsSynthesisSchema', () => {
  const parsed = newsSynthesisSchema.parse(mockFixture);
  assert.equal(parsed.title, mockFixture.title);
  assert.equal(parsed.slug, mockFixture.slug);
  assert.ok(parsed.faq && parsed.faq.length >= 3);
  assert.ok(parsed.bodyMdx && parsed.bodyMdx.length >= 1200);
});

test('title boundary enforcement (50-60 chars)', () => {
  const base = { ...mockFixture };

  // 49 characters: fails
  const shortTitle = 'A'.repeat(49);
  assert.equal(shortTitle.length, 49);
  assert.throws(
    () => newsSynthesisSchema.parse({ ...base, title: shortTitle }),
    /Title must be >= 50 chars/,
  );

  // 55 characters: passes
  const validTitle = 'Anthropic Claude 3.7 Sonnet Released for All Teams 2026';
  assert.equal(validTitle.length, 55);
  const parsedValid = newsSynthesisSchema.parse({ ...base, title: validTitle });
  assert.equal(parsedValid.title, validTitle);

  // 61 characters: fails
  const longTitle = 'B'.repeat(61);
  assert.equal(longTitle.length, 61);
  assert.throws(
    () => newsSynthesisSchema.parse({ ...base, title: longTitle }),
    /Title must be <= 60 chars/,
  );
});

test('description boundary enforcement (150-160 chars)', () => {
  const base = { ...mockFixture };

  // 149 characters: fails
  const shortDesc = 'C'.repeat(149);
  assert.equal(shortDesc.length, 149);
  assert.throws(
    () => newsSynthesisSchema.parse({ ...base, description: shortDesc }),
    /Description must be >= 150 chars/,
  );

  // 152 characters: passes
  const validDesc = mockFixture.description;
  assert.ok(validDesc.length >= 150 && validDesc.length <= 160);
  const parsedValid = newsSynthesisSchema.parse({ ...base, description: validDesc });
  assert.equal(parsedValid.description, validDesc);

  // 161 characters: fails
  const longDesc = 'D'.repeat(161);
  assert.equal(longDesc.length, 161);
  assert.throws(
    () => newsSynthesisSchema.parse({ ...base, description: longDesc }),
    /Description must be <= 160 chars/,
  );
});

test('tldr boundary enforcement (<= 100 words)', () => {
  const base = { ...mockFixture };

  // 90 words: passes
  const words90 = Array.from({ length: 90 }, (_, i) => `word${i}`).join(' ');
  const parsedValid = newsSynthesisSchema.parse({ ...base, tldr: words90 });
  assert.equal(parsedValid.tldr, words90);

  // 101 words: fails
  const words101 = Array.from({ length: 101 }, (_, i) => `word${i}`).join(' ');
  assert.throws(
    () => newsSynthesisSchema.parse({ ...base, tldr: words101 }),
    /TL;DR must be 100 words or fewer/,
  );
});

test('validateNewsBodySections verifies mandatory journalistic H2 headers', () => {
  const completeBody = `
## The Breakdown: What Happened
Details of what happened.

## Why It Matters for Developers & Engineers
Practical impact on developers.

## Industry Impact & Ecosystem Context
Ecosystem shifts.

## Verified Sources & Primary Documentation
- [Source](https://example.com)
`;
  const resultComplete = validateNewsBodySections(completeBody);
  assert.equal(resultComplete.valid, true);
  assert.equal(resultComplete.missingSections.length, 0);

  const missingWhy = `
## The Breakdown: What Happened
Details of what happened.

## Industry Impact & Ecosystem Context
Ecosystem shifts.

## Verified Sources & Primary Documentation
- [Source](https://example.com)
`;
  const resultMissing = validateNewsBodySections(missingWhy);
  assert.equal(resultMissing.valid, false);
  assert.ok(
    resultMissing.missingSections.includes(
      '## Why It Matters for Developers & Engineers',
    ),
  );
});

test('checkBannedPhrases flags prohibited AI buzzwords and cliches', () => {
  const cleanText =
    'Anthropic released a significant update to its Sonnet model today, improving coding benchmarks.';
  assert.deepEqual(checkBannedPhrases(cleanText), []);

  const contaminatedText =
    "This game-changer will revolutionize AI in today's fast-paced world, providing a tapestry of innovation and a testament to modern engineering.";
  const violations = checkBannedPhrases(contaminatedText);
  assert.ok(violations.includes('game-changer'));
  assert.ok(violations.includes('revolutionize'));
  assert.ok(violations.includes("in today's fast-paced"));
  assert.ok(violations.includes('tapestry'));
  assert.ok(violations.includes('testament to'));
});

test('sanitizeBannedPhrases replaces cliches with analytical phrasing', () => {
  const text = 'This game-changer will revolutionize developer workflows.';
  const sanitized = sanitizeBannedPhrases(text);
  assert.ok(!sanitized.includes('game-changer'));
  assert.ok(!sanitized.includes('revolutionize'));
  assert.ok(sanitized.includes('significant release'));
  assert.ok(sanitized.includes('transform'));
});

test('assembleNewsPostMdx produces valid frontmatter and satisfies draftSchema', () => {
  const result = assembleNewsPostMdx(
    mockFixture,
    'https://www.anthropic.com/news/claude-3-7-sonnet',
  );

  // Must validate against the single-source draftSchema
  const validatedFrontmatter = draftSchema.parse(result.frontmatter);
  assert.equal(validatedFrontmatter.title, mockFixture.title);
  assert.equal(validatedFrontmatter.silo, 'ai-news');
  assert.ok(validatedFrontmatter.faq.length >= 3);

  // Must contain mandatory H2 sections in markdown
  for (const section of REQUIRED_NEWS_SECTIONS) {
    assert.ok(
      result.mdxContent.includes(section),
      `MDX output missing mandatory section: ${section}`,
    );
  }

  // Must contain the verified source URL
  assert.ok(
    result.mdxContent.includes('https://www.anthropic.com/news/claude-3-7-sonnet'),
    'MDX output missing verified source citation link',
  );

  // Must satisfy checkAuthorByline EEAT compliance
  const bylineCheck = checkAuthorByline(result.mdxContent);
  assert.equal(bylineCheck.pass, true, bylineCheck.reasons.join('; '));
});

test('buildNewsSynthesisPrompt generates structured editorial instructions', () => {
  const prompt = buildNewsSynthesisPrompt(sampleCandidate);
  assert.ok(prompt.system.includes('senior tech editor'));
  assert.ok(prompt.system.includes('The Breakdown: What Happened'));
  assert.ok(prompt.user.includes(sampleCandidate.title));
  assert.ok(prompt.user.includes(sampleCandidate.link));

  // buildNewsPrompt is an alias
  const aliasPrompt = buildNewsPrompt(sampleCandidate);
  assert.equal(aliasPrompt.system, prompt.system);
});

test('synthesizeNewsArticle executes deterministic mock synthesis matching constraints', async () => {
  const output = await synthesizeNewsArticle(sampleCandidate, { mock: true });

  assert.equal(output.title, mockFixture.title);
  assert.equal(output.slug, mockFixture.slug);
  assert.ok(output.post);
  assert.equal(output.post.silo, 'ai-news');
  assert.ok(output.mdxContent.includes('<Tldr'));
  assert.ok(output.mdxContent.includes('## The Breakdown: What Happened'));
  assert.ok(output.mdxContent.includes('## Why It Matters for Developers & Engineers'));
  assert.ok(output.mdxContent.includes('## Industry Impact & Ecosystem Context'));
  assert.ok(output.mdxContent.includes('## Verified Sources & Primary Documentation'));

  // Frontmatter validation
  const fm = draftSchema.parse(output.frontmatter);
  assert.equal(fm.title, output.title);
});

test('synthesizeNewsArticle handles custom jsonFixture deterministic mode', async () => {
  const customFixture = {
    ...mockFixture,
    title: 'Google DeepMind Unveils Next Generation Gemini Robotics',
    slug: 'google-deepmind-gemini-robotics-next-gen',
  };

  const output = await synthesizeNewsArticle(sampleCandidate, {
    jsonFixture: customFixture,
  });

  assert.equal(
    output.title,
    'Google DeepMind Unveils Next Generation Gemini Robotics',
  );
  assert.equal(output.slug, 'google-deepmind-gemini-robotics-next-gen');
  assert.ok(output.mdxContent.length > 1000);
});
