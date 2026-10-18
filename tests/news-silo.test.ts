import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SILO_SLUGS, SILOS, getSilo } from '../lib/silos';
import {
  buildArticleJsonLd,
  buildNewsArticleJsonLd,
  getArticleSchemaType,
} from '../lib/seo/jsonld';
import { draftSchema } from '../lib/pipeline/draft-schema';
import { SITE_NAME, SITE_URL } from '../lib/site';

function parseFrontmatter(content: string): Record<string, any> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) throw new Error('Missing frontmatter');
  const yaml = match[1];
  const lines = yaml.split(/\r?\n/);
  const result: Record<string, any> = {};
  let currentKey = '';
  let inFaq = false;
  let currentFaq: { q?: string; a?: string } | null = null;

  for (const line of lines) {
    if (line.trim().startsWith('faq:')) {
      inFaq = true;
      result.faq = [];
      continue;
    }
    if (inFaq) {
      if (/^\s*-\s*q:\s*"(.*)"\s*$/.test(line)) {
        const q = line.match(/^\s*-\s*q:\s*"(.*)"\s*$/)![1];
        currentFaq = { q };
        result.faq.push(currentFaq);
        continue;
      }
      if (/^\s*a:\s*"(.*)"\s*$/.test(line) && currentFaq) {
        currentFaq.a = line.match(/^\s*a:\s*"(.*)"\s*$/)![1];
        continue;
      }
      if (!/^\s+/.test(line)) {
        inFaq = false;
      }
    }
    const kv = /^([a-zA-Z0-9_-]+):\s*"(.*)"\s*$/.exec(line);
    if (kv) {
      result[kv[1]] = kv[2];
      continue;
    }
    const kvPlain = /^([a-zA-Z0-9_-]+):\s*(.*)\s*$/.exec(line);
    if (kvPlain && !inFaq) {
      result[kvPlain[1]] = kvPlain[2].replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

test('news silo: SILO_SLUGS includes ai-news as 6th silo', () => {
  assert.equal(SILO_SLUGS.length, 6);
  assert.ok(SILO_SLUGS.includes('ai-news'));
});

test('news silo: getSilo("ai-news") returns authoritative taxonomy metadata', () => {
  const silo = getSilo('ai-news');
  assert.ok(silo, 'Silo definition for ai-news must exist');
  assert.equal(silo.slug, 'ai-news');
  assert.equal(silo.label, 'AI & Tech News');
  assert.ok(silo.landingTitle.length > 0);
  assert.ok(silo.metaDescription.length >= 150 && silo.metaDescription.length <= 160, `metaDescription length ${silo.metaDescription.length} must be 150-160`);

  const introWords = silo.intro.split(/\s+/).filter(Boolean).length;
  assert.ok(introWords >= 120 && introWords <= 160, `intro words ${introWords} must be 120-160`);
});

test('news silo: getArticleSchemaType discriminates between news and evergreen articles', () => {
  assert.equal(getArticleSchemaType('ai-news'), 'NewsArticle');
  assert.equal(getArticleSchemaType('ai-coding'), 'BlogPosting');
  assert.equal(getArticleSchemaType('ai-writing'), 'BlogPosting');
  assert.equal(getArticleSchemaType('ai-image'), 'BlogPosting');
  assert.equal(getArticleSchemaType('ai-productivity'), 'BlogPosting');
  assert.equal(getArticleSchemaType('ai-guides'), 'BlogPosting');
});

test('news silo: buildNewsArticleJsonLd produces valid Schema.org NewsArticle', () => {
  const mockPost: any = {
    title: 'Anthropic Launches Claude 3.7 Sonnet With Hybrid Reasoning',
    description: 'Anthropic has released Claude 3.7 Sonnet, introducing hybrid reasoning architecture for developers and enterprise software engineering teams worldwide.',
    slug: 'anthropic-claude-3-7-sonnet-hybrid-reasoning-release',
    publishedAt: '2026-10-18T06:00:00.000Z',
    updatedAt: '2026-10-18T06:00:00.000Z',
    silo: 'ai-news',
  };
  const canonical = `${SITE_URL}/blog/${mockPost.slug}`;
  const jsonLd = buildNewsArticleJsonLd(mockPost, canonical);

  assert.equal(jsonLd['@context'], 'https://schema.org');
  assert.equal(jsonLd['@type'], 'NewsArticle');
  assert.equal(jsonLd.headline, mockPost.title);
  assert.equal(jsonLd.description, mockPost.description);
  assert.equal(jsonLd.url, canonical);
  assert.equal(jsonLd.datePublished, mockPost.publishedAt);
  assert.equal(jsonLd.dateModified, mockPost.updatedAt);
  assert.equal(jsonLd.publisher['@type'], 'Organization');
  assert.equal(jsonLd.publisher.name, SITE_NAME);
  assert.equal(jsonLd.author['@type'], 'Person');
  assert.equal(jsonLd.mainEntityOfPage, canonical);
});

test('news silo: seed news post anthropic-claude-3-7-sonnet-hybrid-reasoning-release validates with draftSchema', () => {
  const filePath = join(process.cwd(), 'content/posts/anthropic-claude-3-7-sonnet-hybrid-reasoning-release.mdx');
  assert.ok(existsSync(filePath), 'Seed news post file must exist');
  const raw = readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(raw);

  const parsed = draftSchema.parse(fm);
  assert.equal(parsed.silo, 'ai-news');
  assert.equal(parsed.slug, 'anthropic-claude-3-7-sonnet-hybrid-reasoning-release');
  assert.ok(parsed.title.length >= 50 && parsed.title.length <= 60);
  assert.ok(parsed.description.length >= 150 && parsed.description.length <= 160);
  assert.ok(parsed.faq.length >= 3);

  // Check required H2 sections in body
  assert.ok(raw.includes('## The Breakdown: What Happened'));
  assert.ok(raw.includes('## Why It Matters for Developers & Engineers'));
  assert.ok(raw.includes('## Industry Impact & Ecosystem Context'));
  assert.ok(raw.includes('## Verified Sources & Primary Documentation'));
});

test('news silo: seed news post openai-unveils-gpt-5-preview-developers validates with draftSchema', () => {
  const filePath = join(process.cwd(), 'content/posts/openai-unveils-gpt-5-preview-developers.mdx');
  assert.ok(existsSync(filePath), 'Seed news post file must exist');
  const raw = readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(raw);

  const parsed = draftSchema.parse(fm);
  assert.equal(parsed.silo, 'ai-news');
  assert.equal(parsed.slug, 'openai-unveils-gpt-5-preview-developers');
  assert.ok(parsed.title.length >= 50 && parsed.title.length <= 60);
  assert.ok(parsed.description.length >= 150 && parsed.description.length <= 160);
  assert.ok(parsed.faq.length >= 3);
});

test('news silo: site header navigation includes AI News linking to /ai-news', () => {
  const headerPath = join(process.cwd(), 'components/site-header.tsx');
  const headerSrc = readFileSync(headerPath, 'utf8');
  assert.ok(headerSrc.includes("href: '/ai-news'"));
  assert.ok(headerSrc.includes("label: 'AI News'"));
});

test('news silo: keyword shard and seed-topics files are valid', () => {
  const shardPath = join(process.cwd(), 'content/keywords/ai-news/registry.json');
  assert.ok(existsSync(shardPath), 'Shard must exist');
  const shard = JSON.parse(readFileSync(shardPath, 'utf8'));
  assert.equal(shard.version, 1);
  assert.ok(Array.isArray(shard.keywords));

  const seedPath = join(process.cwd(), 'content/keywords/seed-topics.json');
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  assert.ok(Array.isArray(seed.topics['ai-news']));
  assert.ok(seed.topics['ai-news'].length >= 3);
});
