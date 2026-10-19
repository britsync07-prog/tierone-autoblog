import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `Privacy policy for ${SITE_NAME}: no accounts, no tracking cookies, cookie-less analytics, and a direct email channel for data requests.`,
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Privacy Policy
        </h1>
        <div className="mt-8 space-y-8">
          <section aria-label="Information we collect" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Information we collect
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              Almost nothing. {SITE_NAME} has no accounts, no user content,
              and no contact forms, so there is no database of visitor
              information to collect, store, or lose. If you email us, we see
              only what you choose to send — and we use it only to reply.
            </p>
          </section>

          <section aria-label="Analytics" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Analytics
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              We measure readership with Plausible, a privacy-focused analytics
              tool that is cookie-less by design: it records aggregate page
              views and country-level traffic without personal data, without
              cross-site tracking, and without a consent banner.
            </p>
          </section>

          <section aria-label="Cookies" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Cookies
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              This site sets no tracking or advertising cookies in v1. There
              are no advertising cookies, no social widgets, and no third-party
              scripts beyond the single cookie-less analytics snippet
              described above.
            </p>
          </section>

          <section aria-label="Data requests" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Data requests
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#d1d1d6]">
              Because we hold no visitor accounts or profiles, there is
              generally nothing to access or delete. For any privacy question
              or request, contact:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-[#fe7141] underline underline-offset-4 decoration-[#fe7141] transition-colors hover:text-white"
              >
                {CONTACT_EMAIL}
              </a>
              .
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
