import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Contact ${SITE_NAME} by email. Direct communication desk for technical inquiries and feedback.`,
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
};

export default function ContactPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-bold tracking-tight text-[#09090b] sm:text-4xl">
          Contact the Editorial Desk
        </h1>
        <div className="mt-8 rounded-sm bg-[#f4f4f6] p-6 sm:p-10 space-y-6 text-base leading-relaxed text-[#27272a]">
          <p>
            For editorial questions, technical corrections, research feedback, or model evaluation proposals, contact the publisher directly:
          </p>
          <div>
            <a
              href="mailto:saimon@ascentraconsulting.co.uk"
              className="inline-flex items-center gap-2.5 rounded-sm bg-[#d92b21] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#b91c1c]"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.161V6a2 2 0 00-2-2H3z" />
                <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
              </svg>
              saimon@ascentraconsulting.co.uk
            </a>
          </div>
          <p className="text-xs text-[#71717a]">
            Our editorial desk reviews every message. Responses are typically sent within 24 to 48 hours.
          </p>
        </div>
      </article>
    </main>
  );
}
