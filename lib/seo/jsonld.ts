// Single-source JSON-LD builders for SEO-02 (Article + BreadcrumbList, FAQPage
// as hygiene). Every post/landing route MUST import these builders — never
// hand-roll structured data (schema-mirror rule: BreadcrumbList mirrors the
// visible crumb, FAQPage emits only when visible FAQs exist).
//
// Typing note: return contracts are next-seo v7 prop fragments, verified
// against the installed `next-seo/dist/index.d.ts` (ArticleJsonLdProps,
// BreadcrumbJsonLdProps `{ items: { name, item? }[] }`, FAQJsonLdProps
// `{ questions }` — v7 exports `FAQJsonLd`, not `FAQPageJsonLd`). next-seo
// v7's bundled vocabulary is the schema-dts-derived surface versioned with
// the renderer that emits it, so spreadability here guarantees the emitted
// JSON matches the parsed schema. Raw schema-dts unions are deliberately not
// used as return types: their broad unions are not assignable to the
// component props, which would break the spreadable contract.
//
// T-02-01: frontmatter is pipeline-written from Phase 3 on, so treat every
// interpolated string as untrusted now — strip `<` before it reaches JSON.
import type {
  ArticleJsonLdProps,
  BreadcrumbJsonLdProps,
  FAQJsonLdProps,
} from 'next-seo';
import type { Post } from 'content-collections';
import { AUTHOR_NAME, AUTHOR_SLUG, SITE_NAME, SITE_URL } from '@/lib/site';

/** Strip `<` so no interpolated string can break out of the JSON script block. */
function clean(value: string): string {
  return value.replace(/</g, '');
}

type ArticleProps = Omit<
  ArticleJsonLdProps,
  'type' | 'scriptId' | 'scriptKey' | 'nonce'
>;

export function getArticleSchemaType(
  silo: string,
): 'NewsArticle' | 'BlogPosting' {
  return silo === 'ai-news' ? 'NewsArticle' : 'BlogPosting';
}

/**
 * Article props for a post, spreadable into `<ArticleJsonLd type={getArticleSchemaType(post.silo)}
 * {...buildArticleJsonLd(post, canonical)} />`. Image is the absolute per-post
 * OG route; mainEntityOfPage is the canonical post URL.
 */
export function buildArticleJsonLd(
  post: Post,
  canonical: string,
): ArticleProps {
  return {
    headline: clean(post.title),
    description: clean(post.description),
    url: canonical,
    author: {
      '@type': 'Person',
      name: AUTHOR_NAME,
      url: `${SITE_URL}/authors/${AUTHOR_SLUG}`,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.svg`,
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    image: `${canonical}/opengraph-image`,
    mainEntityOfPage: canonical,
    isAccessibleForFree: true,
  };
}

/**
 * Standalone NewsArticle JSON-LD builder for Schema.org validation and Google News discovery.
 */
export function buildNewsArticleJsonLd(
  post: Post,
  canonical: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle' as const,
    headline: clean(post.title),
    description: clean(post.description),
    url: canonical,
    author: {
      '@type': 'Person',
      name: AUTHOR_NAME,
      url: `${SITE_URL}/authors/${AUTHOR_SLUG}`,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.svg`,
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    image: `${canonical}/opengraph-image`,
    mainEntityOfPage: canonical,
    isAccessibleForFree: true,
  };
}

export interface Crumb {
  name: string;
  item: string;
}

// NOTE: BreadcrumbJsonLdProps is a union (`items` | `multipleTrails`); Omit
// alone collapses unions, so Extract the single-trail variant first.
type BreadcrumbProps = Omit<
  Extract<BreadcrumbJsonLdProps, { items: unknown }>,
  'scriptId' | 'scriptKey' | 'nonce'
>;

/**
 * BreadcrumbList props mirroring the visible crumb trail, spreadable into
 * `<BreadcrumbJsonLd {...buildBreadcrumbJsonLd(crumbs)} />`. Positions are
 * 1-based and assigned by next-seo's processor in trail order — pass crumbs
 * in visible order (Home → … → current page).
 */
export function buildBreadcrumbJsonLd(crumbs: Crumb[]): BreadcrumbProps {
  return {
    items: crumbs.map((crumb) => ({
      name: clean(crumb.name),
      item: crumb.item,
    })),
  };
}

type FaqProps = Omit<FAQJsonLdProps, 'scriptId' | 'scriptKey' | 'nonce'>;

/**
 * FAQ props spreadable into `<FAQJsonLd {...faqProps} />`. Returns null when
 * the post has no visible FAQs (FAQPage hygiene: never emit phantom schema).
 */
export function buildFaqJsonLd(
  faq: Post['faq'],
): FaqProps | null {
  if (!faq || faq.length === 0) return null;
  return {
    questions: faq.map((entry) => ({
      question: clean(entry.q),
      answer: clean(entry.a),
    })),
  };
}

export interface CollectionPagePost {
  title: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
}

/**
 * Generates Schema.org CollectionPage JSON-LD for elevated Pillar Hubs (Plan 06-04, D-09, GROW-03).
 * Links the central silo topic to all published spoke articles via hasPart.
 */
export function buildCollectionPageJsonLd(
  silo: { landingTitle: string; metaDescription: string; [key: string]: any },
  posts: Array<CollectionPagePost>,
  canonical: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: clean(silo.landingTitle),
    description: clean(silo.metaDescription),
    url: canonical,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    hasPart: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: clean(post.title),
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt,
      ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    })),
  };
}

