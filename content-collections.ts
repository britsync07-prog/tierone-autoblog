import { defineCollection, defineConfig } from '@content-collections/core';
import { compileMDX } from '@content-collections/mdx';
import GithubSlugger from 'github-slugger';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';

// Typed post collection: frontmatter is the single source of truth and the
// build-time QA gate — malformed frontmatter fails the build, never publishes
// silently (Build → publish boundary).
const posts = defineCollection({
  name: 'posts',
  directory: 'content/posts',
  include: '*.mdx',
  schema: z.object({
    title: z.string().min(50).max(60),
    description: z.string().min(150).max(160),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    publishedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    faq: z
      .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
      .min(3)
      .max(5),
    silo: z.string().min(1),
    // Explicit content property (raw markdown body, supplied by the
    // frontmatter parser — never written in frontmatter files). Required by
    // @content-collections/core: omitting it triggers the
    // implicit-content-property deprecation and leaves `document.content`
    // untyped in the transform.
    content: z.string(),
    tldr: z
      .string()
      .min(1)
      .refine((v) => v.split(/\s+/).filter(Boolean).length <= 100, {
        message: 'tldr must be 100 words or fewer',
      }),
  }),
  transform: async (document, context) => {
    // Rehype pipeline (D-07): GFM tables, stable heading ids, anchor links,
    // Shiki server-highlighted code (zero runtime highlighter, T-02-01).
    // github-light keeps token contrast on the light editorial surface.
    const mdx = await compileMDX(context, document, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: {
              className: ['anchor-link'],
              ariaLabel: 'Link to section',
            },
            content: { type: 'text', value: '#' },
          },
        ],
        [rehypePrettyCode, { theme: 'github-light', keepBackground: true }],
      ],
    });
    // True body word count for the homepage "N min read" meta row
    // (UI-SPEC §3). `document.content` is the raw markdown body supplied by
    // the parser (frontmatter already removed); 200 wpm budget, minimum 1.
    const body = document.content.replace(/^---[\s\S]*?---/, '');
    const words = body.split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    return {
      ...document,
      mdx,
      readingMinutes,
      headings: extractHeadings(body),
    };
  },
});

// Build-time heading extraction for the TOC sidebar (D-05).
// Mirrors rehype-slug exactly: one GithubSlugger per document, every heading
// level slugged in order (only h2/h3 are kept), fenced code blocks skipped,
// so ids match the rendered `id` attributes with no client-side DOM scraping.
export type PostHeading = { id: string; text: string; level: 2 | 3 };

function extractHeadings(body: string): PostHeading[] {
  const slugger = new GithubSlugger();
  const headings: PostHeading[] = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const rawText = match[2].replace(/\s+#+$/, '').trim();
    const text = rawText
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim();
    const id = slugger.slug(text);
    if (level === 2 || level === 3) {
      headings.push({ id, text, level: level as 2 | 3 });
    }
  }
  return headings;
}

export default defineConfig({
  content: [posts],
});
