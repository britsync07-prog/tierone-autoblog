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
        <h1 className="text-3xl font-bold tracking-tight text-[#09090b] sm:text-4xl">
          Privacy Policy
        </h1>
        <div className="mt-8 space-y-8">
          <section aria-label="Information we collect" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              Information we collect
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#27272a]">
              Almost nothing. {SITE_NAME} has no accounts, no user content,
              and no contact forms, so there is no database of visitor
              information to collect, store, or lose. If you email us, we see
              only what you choose to send — and we use it only to reply.
            </p>
          </section>

          <section aria-label="Analytics" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              Analytics
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#27272a]">
              We measure readership with Plausible, a privacy-focused analytics
              tool that is cookie-less by design: it records aggregate page
              views and country-level traffic without personal data, without
              cross-site tracking, and without a consent banner.
            </p>
          </section>

          <section aria-label="Cookies" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              Cookies
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#27272a]">
              This site sets no tracking or advertising cookies in v1. There
              are no advertising cookies, no social widgets, and no third-party
              scripts beyond the single cookie-less analytics snippet
              described above.
            </p>
          </section>

          <section aria-label="Data requests" className="rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
              Data requests
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#27272a]">
              Because we hold no visitor accounts or profiles, there is
              generally nothing to access or delete. For any privacy question
              or request, contact:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-[#d92b21] underline underline-offset-4 decoration-[#d92b21] transition-colors hover:text-[#09090b]"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <p className="text-xs text-[#71717a]">
            Last reviewed October 2026; formal counsel review deferred until
            revenue justifies it.
          </p>
        </div>
      </article>
    </main>
  );
}
