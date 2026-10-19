import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { extractThumbnailFromBlock } from '../lib/pipeline/news/parser';
import {
  downloadAndProcessNewsThumbnail,
  extractSourceOgImage,
} from '../lib/pipeline/news/images';
import { assembleNewsPostMdx } from '../lib/pipeline/news/assembler';
import { draftSchema } from '../lib/pipeline/draft-schema';
import type { NewsSynthesisResult } from '../lib/pipeline/news/synthesis-schema';

const sampleSynthesis: NewsSynthesisResult = {
  title: 'Anthropic Unveils Claude 3.7 Sonnet Hybrid Architecture',
  description: 'Anthropic has unveiled Claude 3.7 Sonnet featuring hybrid test-time reasoning compute and instantaneous execution for production software engineering teams.',
  slug: 'anthropic-claude-3-7-sonnet-hybrid-reasoning',
  tldr: 'Anthropic launched Claude 3.7 Sonnet with hybrid reasoning capabilities and state-of-the-art SWE-bench Verified coding scores.',
  faq: [
    { q: 'What is hybrid reasoning in Claude 3.7?', a: 'Hybrid reasoning allows developers to dynamically configure thinking budgets per API request.' },
    { q: 'How does Claude 3.7 perform on SWE-bench?', a: 'Claude 3.7 achieves superior verified benchmarks on complex enterprise repositories.' },
    { q: 'When is Claude 3.7 available to developers?', a: 'Claude 3.7 is available immediately through the Anthropic API and cloud partner consoles.' },
  ],
  whatHappened: 'Anthropic today released Claude 3.7 Sonnet, their newest hybrid reasoning model for developers.',
  whyItMatters: 'Developers no longer need separate reasoning and fast chat models.',
  industryImpact: 'The release establishes a new benchmark for software engineering foundation models.',
};

test('extractThumbnailFromBlock extracts image from RSS enclosure tag', () => {
  const xml = `
    <item>
      <title>Test Story</title>
      <enclosure url="https://techcrunch.com/wp-content/uploads/2026/10/banner.jpg" type="image/jpeg" length="102400" />
    </item>
  `;
  const img = extractThumbnailFromBlock(xml);
  assert.equal(img, 'https://techcrunch.com/wp-content/uploads/2026/10/banner.jpg');
});

test('extractThumbnailFromBlock extracts image from media:content and media:thumbnail', () => {
  const mediaContentXml = `
    <item>
      <media:content url="https://cdn.theverge.com/uploads/photo.png" medium="image" />
    </item>
  `;
  assert.equal(
    extractThumbnailFromBlock(mediaContentXml),
    'https://cdn.theverge.com/uploads/photo.png',
  );

  const mediaThumbnailXml = `
    <item>
      <media:thumbnail url="https://cdn.theverge.com/uploads/thumb.webp" />
    </item>
  `;
  assert.equal(
    extractThumbnailFromBlock(mediaThumbnailXml),
    'https://cdn.theverge.com/uploads/thumb.webp',
  );
});

test('extractThumbnailFromBlock extracts image from HTML img tag in description or CDATA', () => {
  const htmlXml = `
    <item>
      <description><![CDATA[<p>Article intro</p><img src="https://images.example.com/lead-photo.jpg" alt="Photo" />]]></description>
    </item>
  `;
  assert.equal(
    extractThumbnailFromBlock(htmlXml),
    'https://images.example.com/lead-photo.jpg',
  );
});

test('extractThumbnailFromBlock returns undefined when no image is present', () => {
  const noImageXml = `
    <item>
      <title>Plain Story Without Media</title>
      <description>Simple text summary</description>
    </item>
  `;
  assert.equal(extractThumbnailFromBlock(noImageXml), undefined);
});

test('extractSourceOgImage parses og:image meta tag from HTML page', async () => {
  const mockFetch: typeof fetch = async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:image" content="https://techcrunch.com/featured-lead.png" />
          <title>News Story</title>
        </head>
        <body></body>
      </html>
    `;
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  };

  const ogUrl = await extractSourceOgImage('https://techcrunch.com/story-1', mockFetch);
  assert.equal(ogUrl, 'https://techcrunch.com/featured-lead.png');
});

test('downloadAndProcessNewsThumbnail optimizes image to 1280x720 WebP', async () => {
  const tmpOutDir = join(process.cwd(), '.test-tmp', 'news-images');
  if (existsSync(tmpOutDir)) {
    rmSync(tmpOutDir, { recursive: true, force: true });
  }

  // Create a minimal 200x200 PNG buffer
  const samplePng = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 217, g: 43, b: 33, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const mockFetch: typeof fetch = async () => {
    return new Response(samplePng, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  };

  const result = await downloadAndProcessNewsThumbnail({
    imageUrl: 'https://example.com/remote-hero.png',
    slug: 'anthropic-claude-3-7-sonnet-hybrid-reasoning',
    headline: 'Anthropic Unveils Claude 3.7 Sonnet Hybrid Architecture',
    outDir: tmpOutDir,
    fetchFn: mockFetch,
  });

  assert.ok(result);
  assert.equal(
    result.src,
    '/images/anthropic-claude-3-7-sonnet-hybrid-reasoning/hero.webp',
  );
  assert.ok(existsSync(result.localPath));

  // Inspect generated WebP properties via sharp using in-memory buffer
  const fileBytes = readFileSync(result.localPath);
  const metadata = await sharp(fileBytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);

  // Cleanup
  rmSync(tmpOutDir, { recursive: true, force: true });
});

test('assembleNewsPostMdx serializes heroImage and satisfies draftSchema', () => {
  const heroImage = {
    src: '/images/anthropic-claude-3-7-sonnet-hybrid-reasoning/hero.webp',
    alt: 'Anthropic Claude 3.7 Sonnet architecture thumbnail',
  };

  const assembled = assembleNewsPostMdx(
    sampleSynthesis,
    'https://www.anthropic.com/news/claude-3-7-sonnet',
    {
      silo: 'ai-news',
      heroImage,
    },
  );

  // Assert schema compliance
  const parsed = draftSchema.parse(assembled.frontmatter);
  assert.ok(parsed.heroImage);
  assert.equal(parsed.heroImage?.src, heroImage.src);
  assert.equal(parsed.heroImage?.alt, heroImage.alt);

  // Assert MDX serialization includes heroImage block
  assert.ok(assembled.mdxContent.includes('heroImage:'));
  assert.ok(assembled.mdxContent.includes(heroImage.src));
});
