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
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16">
      <article className="mx-auto max-w-[65ch]">
        <h1 className="text-[30px] font-semibold leading-[1.2] text-[#171717]">
          Privacy policy
        </h1>
        <div className="mt-6 space-y-6 text-[16px] leading-[1.5] text-[#171717]">
          <section aria-label="Information we collect">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              Information we collect
            </h2>
            <p className="mt-4">
              Almost nothing. {SITE_NAME} has no accounts, no user content,
              and no contact forms, so there is no database of visitor
              information to collect, store, or lose. If you email us, we see
              only what you choose to send — and we use it only to reply.
            </p>
          </section>
          <section aria-label="Analytics">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              Analytics
            </h2>
            <p className="mt-4">
              We measure readership with Plausible, a privacy-focused analytics
              tool that is cookie-less by design: it records aggregate page
              views and country-level traffic without personal data, without
              cross-site tracking, and without a consent banner.
            </p>
          </section>
          <section aria-label="Cookies">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              Cookies
            </h2>
            <p className="mt-4">
              This site sets no tracking or advertising cookies in v1. There
              are no advertising cookies, no social widgets, and no third-party
              scripts beyond the single cookie-less analytics snippet
              described above.
            </p>
          </section>
          <section aria-label="Data requests">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              Data requests
            </h2>
            <p className="mt-4">
              Because we hold no visitor accounts or profiles, there is
              generally nothing to access or delete. For any privacy question
              or request, contact:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[#4f46e5] underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
          <p className="text-[14px] text-slate-600">
            Last reviewed October 2026; formal counsel review deferred until
            revenue justifies it.
          </p>
        </div>
      </article>
    </main>
  );
}
