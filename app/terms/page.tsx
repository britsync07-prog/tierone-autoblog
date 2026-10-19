import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: `Terms of use for ${SITE_NAME}: informational AI-tool guides, AI-assistance disclosure, and the limits of what this content promises.`,
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
};

export default function TermsPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Terms of Use
        </h1>
        <div className="mt-8 space-y-8">
          <section aria-label="Informational content" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Informational content
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              {SITE_NAME} publishes informational AI-tool guides: what tools
              do, what they cost, and how they compare. This content is not
              professional advice — financial, legal, or otherwise — and
              reading it does not create any professional relationship.
            </p>
          </section>

          <section aria-label="How content is made" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              How content is made
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              Drafts on this site are AI-assisted and verified by the
              publisher before publication. Read our{' '}
              <Link
                href="/editorial-process"
                className="font-semibold text-[#fe7141] underline underline-offset-4 decoration-[#fe7141] transition-colors hover:text-white"
              >
                editorial process
              </Link>{' '}
              for the full disclosure, including our sourcing standards and
              what we refuse to publish.
            </p>
          </section>

          <section aria-label="No warranty" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              No warranty
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              Tool features and prices change quickly; we work to keep guides
              accurate at their stated review date but offer no warranty that
              any page is complete, current, or fit for your particular
              purpose. Verify pricing and features with the tool maker before
              you buy.
            </p>
          </section>

          <section aria-label="Outbound links" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Outbound links
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              Articles link out to tool makers, documentation, and publisher
              profiles. We are not responsible for the content, accuracy, or
              practices of third-party sites those links point to.
            </p>
          </section>

          <p className="text-xs text-[#82828e]">
            Last reviewed October 2026; formal counsel review deferred until
            revenue justifies it.
          </p>
        </div>
      </article>
    </main>
  );
}
