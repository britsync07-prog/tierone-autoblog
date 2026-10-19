import { draftSchema, type DraftFrontmatter } from '../draft-schema';
import type { SiloSlug } from '../../silos';
import {
  type NewsSynthesisResult,
  normalizeFaq,
  buildBodyMdxFromSections,
} from './synthesis-schema';

export interface AssembleNewsOptions {
  publishedAt?: string;
  updatedAt?: string;
  silo?: SiloSlug | 'ai-news';
  author?: string;
  canonical?: string;
  heroImage?: {
    src: string;
    alt: string;
  };
}

/**
 * Escapes strings for safe inclusion in YAML frontmatter double quotes.
 */
function escapeYamlString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Assembles an MDX document and typed frontmatter conforming strictly to draftSchema.
 */
export function assembleNewsPostMdx(
  synthesized: NewsSynthesisResult,
  sourceUrl: string,
  options?: AssembleNewsOptions,
): { mdxContent: string; frontmatter: DraftFrontmatter } {
  const publishedAt = options?.publishedAt ?? new Date().toISOString();
  const updatedAt = options?.updatedAt ?? publishedAt;
  const silo = (options?.silo ?? 'ai-news') as SiloSlug;

  const normalizedFaq = normalizeFaq(synthesized);

  const frontmatter: DraftFrontmatter = {
    title: synthesized.title,
    description: synthesized.description,
    slug: synthesized.slug,
    publishedAt,
    updatedAt,
    silo,
    tldr: synthesized.tldr,
    faq: normalizedFaq,
    ...(options?.heroImage ? { heroImage: options.heroImage } : {}),
  };

  // Fail-closed validation against single-source draftSchema
  draftSchema.parse(frontmatter);

  // Resolve body markdown
  let body = buildBodyMdxFromSections(synthesized);

  // Ensure primary source citation URL is present
  if (sourceUrl && !body.includes(sourceUrl)) {
    const citation = `- [Primary Source Document](${sourceUrl})`;
    if (body.includes('## Verified Sources & Primary Documentation')) {
      body = body.replace(
        '## Verified Sources & Primary Documentation',
        `## Verified Sources & Primary Documentation\n\n${citation}`,
      );
    } else {
      body += `\n\n## Verified Sources & Primary Documentation\n\n${citation}`;
    }
  }

  // Ensure EEAT editorial policy links are present
  if (!body.includes('/editorial-process')) {
    body += '\n\n*Read our [/editorial-process](/editorial-process) guidelines for full disclosure.*';
  }
  if (!body.includes('/about')) {
    body += '\n\n*Learn more [/about](/about) our editorial team.*';
  }

  // Serialize YAML frontmatter
  const faqYaml = frontmatter.faq
    .map(
      (item) =>
        `  - q: "${escapeYamlString(item.q)}"\n    a: "${escapeYamlString(item.a)}"`,
    )
    .join('\n');

  const heroImageYaml = frontmatter.heroImage
    ? `heroImage:\n  src: "${frontmatter.heroImage.src}"\n  alt: "${escapeYamlString(frontmatter.heroImage.alt)}"\n`
    : '';

  const mdxContent = `---
title: "${escapeYamlString(frontmatter.title)}"
description: "${escapeYamlString(frontmatter.description)}"
slug: "${frontmatter.slug}"
publishedAt: "${frontmatter.publishedAt}"
updatedAt: "${frontmatter.updatedAt}"
silo: "${frontmatter.silo}"
tldr: "${escapeYamlString(frontmatter.tldr)}"
${heroImageYaml}faq:
${faqYaml}
---

${body}
`;

  return {
    mdxContent,
    frontmatter,
  };
}
