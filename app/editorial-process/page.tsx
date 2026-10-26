import type { Metadata } from 'next';
import Link from 'next/link';
import { AUTHOR_NAME, AUTHOR_SLUG } from '@/lib/site';
import { canonicalFor, localeAlternates } from '@/lib/seo/canonical';

const canonical = canonicalFor('/editorial-process');

export const metadata: Metadata = {
  title: 'Editorial Process & Standards',
  description:
    'How articles are produced, verified against source documentation, and how AI assistance is disclosed with full human publisher accountability.',
  alternates: {
    ...localeAlternates(canonical),
  },
};

export default function EditorialProcessPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-bold tracking-tight text-[#09090b] sm:text-4xl">
          Editorial Process & Sourcing Standards
        </h1>
        <div className="mt-8 space-y-8">
          <section aria-label="How articles are produced" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              How articles are produced
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-[#27272a]">
              <p>
                Each article starts with a topic chosen for builders who want
                practical answers about AI tools — what a tool does, what it
                costs, and whether it is worth their time.
              </p>
              <p>
                The draft is written from hands-on research of the tool itself:
                official documentation, current pricing pages, and real usage
                notes. A verification pass follows, checking every factual
                claim against its source before anything is published.
              </p>
              <p>
                The publisher —{' '}
                <Link
                  href={`/authors/${AUTHOR_SLUG}`}
                  className="font-semibold text-[#d92b21] underline underline-offset-4 decoration-[#d92b21] transition-colors hover:text-[#09090b]"
                >
                  {AUTHOR_NAME}
                </Link>{' '}
                — is personally accountable for everything published here. If
                an article is wrong, the correction goes on the same page it
                appeared on.
              </p>
            </div>
          </section>

          <section aria-label="AI assistance disclosure" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              AI assistance disclosure
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-[#27272a]">
              <p>
                Drafts on this site are AI-assisted: writing tools help with
                research synthesis and first drafts, but every article is
                reviewed, verified, and approved by the publisher before it
                ships. AI assistance never removes human accountability.
              </p>
              <p>
                Look for the AI-assistance badge at the top of every article —
                it links to this page so the disclosure travels with the
                content, not just the process description.
              </p>
            </div>
          </section>

          <section aria-label="Sourcing and verification standards" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              Sourcing and verification standards
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-[#27272a]">
              <p>
                Every statistic, price, and feature claim carries a named
                source with a date. Where possible, claims are verified against
                primary sources — the tool maker&apos;s own documentation or
                pricing page — rather than second-hand roundups.
              </p>
              <p>
                Claims that cannot be verified are cut, not softened. A missing
                fact never becomes a confident sentence.
              </p>
            </div>
          </section>

          <section aria-label="What we do not publish" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              What we don&apos;t publish
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-[#27272a]">
              <p>
                We don&apos;t publish scraped or lightly rewritten content from
                other sites. We don&apos;t publish fabricated authors,
                credentials, or experience — the single real byline on the{' '}
                <Link
                  href={`/authors/${AUTHOR_SLUG}`}
                  className="font-semibold text-[#d92b21] underline underline-offset-4 decoration-[#d92b21] transition-colors hover:text-[#09090b]"
                >
                  author page
                </Link>{' '}
                is who stands behind the work.
              </p>
              <p>
                We don&apos;t accept payment to review or rank a tool favourably.
                If an affiliate link is ever added to an existing article, its
                presence will be disclosed on the page itself in clear language.
              </p>
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
