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
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Editorial Process & Sourcing Standards
        </h1>
        <div className="mt-8 space-y-6">
          <section aria-label="How articles are produced" className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 shadow-xl">
            <h2 className="text-xl font-bold tracking-tight text-white">
              How articles are produced
            </h2>
            <div className="mt-4 space-y-4 text-[15.5px] leading-relaxed text-zinc-300">
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
                  className="font-semibold text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
                >
                  {AUTHOR_NAME}
                </Link>{' '}
                — is personally accountable for everything published here. If
                an article is wrong, the correction goes on the same page it
                appeared on.
              </p>
            </div>
          </section>

          <section aria-label="AI assistance disclosure" className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 shadow-xl">
            <h2 className="text-xl font-bold tracking-tight text-white">
              AI assistance disclosure
            </h2>
            <div className="mt-4 space-y-4 text-[15.5px] leading-relaxed text-zinc-300">
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

          <section aria-label="Sourcing and verification standards" className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 shadow-xl">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Sourcing and verification standards
            </h2>
            <div className="mt-4 space-y-4 text-[15.5px] leading-relaxed text-zinc-300">
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

          <section aria-label="What we do not publish" className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 shadow-xl">
            <h2 className="text-xl font-bold tracking-tight text-white">
              What we don&apos;t publish
            </h2>
            <div className="mt-4 space-y-4 text-[15.5px] leading-relaxed text-zinc-300">
              <p>
                We don&apos;t publish scraped or lightly rewritten content from
                other sites. We don&apos;t publish fabricated authors,
                credentials, or experience — the single real byline on the{' '}
                <Link
                  href={`/authors/${AUTHOR_SLUG}`}
                  className="font-semibold text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
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
