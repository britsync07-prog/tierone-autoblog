// Single source of truth for ALL post frontmatter (Plan 03-04, D-14).
// T-03-09: content-collections.ts imports draftSchema at BUILD time and the
// Phase-3 draft stage imports the SAME module — one contract, never
// re-declared, so build and pipeline always validate the identical shape.
// T-03-08: untrusted pipeline-authored frontmatter is untrusted input at the
// build boundary — malformed comparison rows, wrong image path shapes, and
// bad silo enums all fail the build loudly, never render silently.
//
// Dependency direction (locked, Phase-3 interfaces): this module is the ONE
// deliberate lib/pipeline edge the site build may consume. It must stay PURE
// zod — its only import beyond zod is lib/silos (the registry/pipeline side
// never flows into the site bundle through here).
import { z } from 'zod';
import { SILO_SLUGS } from '../silos';

// D-14: a comparison table is frontmatter DATA — structured columns and rows
// validated here and rendered by the shared <ComparisonTable> component.
// Inline-JSX table markup in post bodies is rejected; structured frontmatter
// rows are the contract the draft stage (03-06) fills.
export const comparisonColumnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const comparisonRowSchema = z.object({
  // Row width is intentionally NOT fixed here: the comparisonSchema refine
  // below enforces one cell per column against the sibling columns array.
  cells: z.array(z.string().min(1)),
  best: z.boolean().optional(),
});

export const comparisonSchema = z
  .object({
    title: z.string().min(1).optional(),
    columns: z.array(comparisonColumnSchema).min(2).max(6),
    rows: z.array(comparisonRowSchema).min(2).max(12),
    note: z.string().optional(),
  })
  .refine((c) => c.rows.every((r) => r.cells.length === c.columns.length), {
    message: 'every comparison row must have one cell per column',
  });

/** Image slots (Plan 03-05 populates them; optional for seeds and drafts
 * until 03-05 runs). The path shape is enforced NOW so every future asset
 * lands in the controlled /images/{silo-slug}/{name}.avif|webp layout. */
export const heroImageSchema = z.object({
  src: z.string().regex(
    /^\/images\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:avif|webp)$/,
  ),
  alt: z.string().min(10),
});

/** The full post frontmatter contract. Existing fields are byte-compatible
 * with the Phase-1 collection schema (title 50-60, description 150-160,
 * slug regex, ISO datetimes, faq 3-5, tldr <=100 words). The T-02-02 silo
 * enum gate lives HERE now — an undeclared silo fails the build loudly
 * instead of rendering a landing-less orphan (landings derive from
 * SILO_SLUGS, which is imported, never re-declared). */
export const draftSchema = z.object({
  title: z.string().min(50).max(60),
  description: z.string().min(150).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  faq: z
    .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
    .min(3)
    .max(5),
  silo: z.union([z.enum(SILO_SLUGS), z.literal('ai-news')]),
  tldr: z
    .string()
    .min(1)
    .refine((v) => v.split(/\s+/).filter(Boolean).length <= 100, {
      message: 'tldr must be 100 words or fewer',
    }),
  heroImage: heroImageSchema.optional(),
  comparison: comparisonSchema.optional(),
});

export type DraftFrontmatter = z.infer<typeof draftSchema>;
