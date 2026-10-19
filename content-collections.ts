import { defineCollection, defineConfig } from '@content-collections/core';
import { compileMDX } from '@content-collections/mdx';
import GithubSlugger from 'github-slugger';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';
import { draftSchema } from './lib/pipeline/draft-schema';

// Typed post collection: frontmatter is the single source of truth and the
// build-time QA gate — malformed frontmatter fails the build, never publishes
// silently (Build → publish boundary).
//
// Schema attach note (Plan 03-04, T-03-09 — no schema drift): the post
// schema is imported from lib/pipeline/draft-schema, the deliberate
// single-source zod contract shared with the Phase-3 draft stage. Only
// `content` (the raw MDX body supplied by the frontmatter parser — never
// written in frontmatter files; required by @content-collections/core so
// `document.content` stays typed in the transform) is collection-local.
const posts = defineCollection({
  name: 'posts',
  directory: 'content/posts',
  include: '*.mdx',
  schema: draftSchema.extend({ content: z.string() }),
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
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+)$/.exec(trimmed);
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
