import { readFile } from 'node:fs/promises';
import { defineCollection, defineConfig } from '@content-collections/core';
import { compileMDX } from '@content-collections/mdx';
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
    tldr: z
      .string()
      .min(1)
      .refine((v) => v.split(/\s+/).filter(Boolean).length <= 100, {
        message: 'tldr must be 100 words or fewer',
      }),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document);
    // True body word count for the homepage "N min read" meta row
    // (UI-SPEC §3). Frontmatter stripped; 200 wpm budget, minimum 1 minute.
    const raw = await readFile(document._meta.filePath, 'utf-8');
    const body = raw.replace(/^---[\s\S]*?---/, '');
    const words = body.split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    return { ...document, mdx, readingMinutes };
  },
});

export default defineConfig({
  content: [posts],
});
