import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, AUTHOR_NAME, AUTHOR_SLUG } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Editorial process',
  description:
    'How articles are produced, how AI assistance is disclosed, and the sourcing standards every post must meet before publication.',
  alternates: {
    canonical: `${SITE_URL}/editorial-process`,
  },
};

export default function EditorialProcessPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16">
      <article className="mx-auto max-w-[65ch]">
        <h1 className="text-[30px] font-semibold leading-[1.2] text-[#171717]">
          Editorial process
        </h1>
        <div className="mt-6 space-y-6 text-[16px] leading-[1.5] text-[#171717]">
          <section aria-label="How articles are produced">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              How articles are produced
            </h2>
            <div className="mt-4 space-y-6">
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
                  className="text-[#4f46e5] underline"
                >
                  {AUTHOR_NAME}
                </Link>{' '}
                — is personally accountable for everything published here. If
                an article is wrong, the correction goes on the same page it
                appeared on.
              </p>
            </div>
          </section>
          <section aria-label="AI assistance disclosure">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              AI assistance disclosure
            </h2>
            <div className="mt-4 space-y-6">
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
          <section aria-label="Sourcing and verification standards">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              Sourcing and verification standards
            </h2>
            <div className="mt-4 space-y-6">
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
          <section aria-label="What we do not publish">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              What we don&apos;t publish
            </h2>
            <div className="mt-4 space-y-6">
              <p>
                We don&apos;t publish scraped or lightly rewritten content from
                other sites. We don&apos;t publish fabricated authors,
                credentials, or experience — the single real byline on the{' '}
                <Link
                  href={`/authors/${AUTHOR_SLUG}`}
                  className="text-[#4f46e5] underline"
                >
                  author page
                </Link>{' '}
                is the only voice here, and portraits of people who
                don&apos;t exist will never stand in for a real publisher.
              </p>
              <p>
                We don&apos;t publish unverified claims, paid placements
                disguised as reviews, or professional advice dressed up as
                tool guidance. Our content is informational: it helps you
                evaluate AI tools, nothing more.
              </p>
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
