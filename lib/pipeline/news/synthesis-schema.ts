import { z } from 'zod';

export const BANNED_EDITORIAL_PHRASES = [
  'game-changer',
  'revolutionize',
  'revolutionary',
  'dive into',
  'delve into',
  'delve',
  "in today's fast-paced",
  'fast-paced world',
  'beacon of hope',
  'tapestry',
  'testament to',
  'only time will tell',
  'at the end of the day',
  'seamlessly integrates',
  'groundbreaking paradigm',
] as const;

export const BANNED_PHRASE_REPLACEMENTS: Record<string, string> = {
  'game-changer': 'significant release',
  'revolutionize': 'transform',
  'revolutionary': 'innovative',
  'dive into': 'examine',
  'delve into': 'analyze',
  'delve': 'explore',
  "in today's fast-paced": 'in modern',
  'fast-paced world': 'industry landscape',
  'beacon of hope': 'notable development',
  'tapestry': 'network',
  'testament to': 'demonstration of',
  'only time will tell': 'future benchmarks will determine',
  'at the end of the day': 'ultimately',
  'seamlessly integrates': 'integrates',
  'groundbreaking paradigm': 'novel architecture',
};

export const REQUIRED_NEWS_SECTIONS = [
  '## The Breakdown: What Happened',
  '## Why It Matters for Developers & Engineers',
  '## Industry Impact & Ecosystem Context',
  '## Verified Sources & Primary Documentation',
] as const;

const countWords = (v: string): number => v.split(/\s+/).filter(Boolean).length;

export const newsFaqItemSchema = z.object({
  q: z.string().min(10, 'FAQ question must be >= 10 chars'),
  a: z.string().min(20, 'FAQ answer must be >= 20 chars'),
});

export const newsFaqAltItemSchema = z.object({
  question: z.string().min(10, 'FAQ question must be >= 10 chars'),
  answer: z.string().min(20, 'FAQ answer must be >= 20 chars'),
});

export const newsPrimarySourceSchema = z.object({
  label: z.string().min(1, 'Source label required'),
  url: z.string().url('Source URL must be valid'),
});

export const newsSynthesisSchema = z
  .object({
    title: z
      .string()
      .min(50, 'Title must be >= 50 chars')
      .max(60, 'Title must be <= 60 chars'),
    description: z
      .string()
      .min(150, 'Description must be >= 150 chars')
      .max(160, 'Description must be <= 160 chars'),
    slug: z
      .string()
      .min(15, 'Slug must be >= 15 chars')
      .max(70, 'Slug must be <= 70 chars')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
    tldr: z
      .string()
      .min(10, 'TL;DR must be >= 10 chars')
      .refine((v) => countWords(v) <= 100, {
        message: 'TL;DR must be 100 words or fewer',
      }),
    faq: z
      .array(newsFaqItemSchema)
      .min(3, 'Must have at least 3 FAQs')
      .max(4, 'Must have at most 4 FAQs')
      .optional(),
    faqs: z
      .array(newsFaqAltItemSchema)
      .min(3, 'Must have at least 3 FAQs')
      .max(4, 'Must have at most 4 FAQs')
      .optional(),
    whatHappened: z.string().optional(),
    whyItMatters: z.string().optional(),
    industryImpact: z.string().optional(),
    primarySources: z.array(newsPrimarySourceSchema).min(1).max(3).optional(),
    comparisonTable: z.any().optional(),
    bodyMdx: z.string().min(1200, 'MDX body must be >= 1200 characters').optional(),
  })
  .refine(
    (data) => Boolean((data.faq && data.faq.length >= 3) || (data.faqs && data.faqs.length >= 3)),
    { message: 'Must have at least 3 FAQs via faq or faqs' },
  )
  .refine(
    (data) =>
      Boolean(
        data.bodyMdx ||
          (data.whatHappened && data.whyItMatters && data.industryImpact),
      ),
    {
      message:
        'Must provide either bodyMdx (>=1200 chars) or structured sections (whatHappened, whyItMatters, industryImpact)',
    },
  );

export type NewsSynthesisResult = z.infer<typeof newsSynthesisSchema>;

/**
 * Checks for presence of exact required H2 headings in the MDX body.
 */
export function validateNewsBodySections(bodyMdx: string): {
  valid: boolean;
  missingSections: string[];
} {
  const missingSections = REQUIRED_NEWS_SECTIONS.filter(
    (section) => !bodyMdx.includes(section),
  );
  return {
    valid: missingSections.length === 0,
    missingSections,
  };
}

/**
 * Returns any banned phrases found in the generated text (case-insensitive).
 */
export function checkBannedPhrases(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const phrase of BANNED_EDITORIAL_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  return found;
}

/**
 * Deterministically replaces banned clichés with objective alternatives.
 */
export function sanitizeBannedPhrases(text: string): string {
  let cleaned = text;
  for (const [phrase, replacement] of Object.entries(BANNED_PHRASE_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned;
}

/**
 * Normalizes FAQs into standard `{ q: string; a: string }[]`.
 */
export function normalizeFaq(data: {
  faq?: Array<{ q: string; a: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}): Array<{ q: string; a: string }> {
  if (data.faq && data.faq.length > 0) {
    return data.faq;
  }
  if (data.faqs && data.faqs.length > 0) {
    return data.faqs.map((f) => ({ q: f.question, a: f.answer }));
  }
  return [];
}

/**
 * Assembles a complete MDX body from section components if bodyMdx is not already formatted.
 */
export function buildBodyMdxFromSections(data: {
  tldr?: string;
  whatHappened?: string;
  whyItMatters?: string;
  industryImpact?: string;
  primarySources?: Array<{ label: string; url: string }>;
  faq?: Array<{ q: string; a: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  bodyMdx?: string;
}): string {
  if (data.bodyMdx && data.bodyMdx.trim().length >= 1200) {
    return data.bodyMdx;
  }
  const sources =
    data.primarySources && data.primarySources.length > 0
      ? data.primarySources.map((s) => `- [${s.label}](${s.url})`).join('\n')
      : '- [Primary Report Documentation](https://exclusivesources.online)';

  const normalized = normalizeFaq(data);
  const faqsBlock =
    normalized.length > 0
      ? `## Frequently Asked Questions\n\n` +
        normalized.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n') +
        '\n\n'
      : '';

  return `${data.tldr ? `<Tldr items={["${data.tldr.replace(/"/g, '\\"')}"]} />\n\n` : ''}## The Breakdown: What Happened

${data.whatHappened ?? ''}

## Why It Matters for Developers & Engineers

${data.whyItMatters ?? ''}

## Industry Impact & Ecosystem Context

${data.industryImpact ?? ''}

${faqsBlock}## Verified Sources & Primary Documentation

${sources}

---
*For our editorial methodology and AI disclosure, read our [/editorial-process](/editorial-process) and learn [/about](/about) our publishing mission.*
`.trim();
}
