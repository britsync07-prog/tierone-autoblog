import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Contact ${SITE_NAME} by email. No forms, no accounts — one direct email link.`,
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
};

// Email-link only (D-13). No form, no inputs, no API route, no client JS —
// there is nothing here that can collect data, so there is nothing to breach.
export default function ContactPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Contact Us
        </h1>
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 space-y-6 text-[15.5px] leading-relaxed text-zinc-300 shadow-xl">
          <p>
            For questions, editorial corrections, or partnership inquiries, reach the
            publisher directly by email:
          </p>
          <div>
            <a
              href="mailto:saimon@ascentraconsulting.co.uk"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.161V6a2 2 0 00-2-2H3z" />
                <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
              </svg>
              saimon@ascentraconsulting.co.uk
            </a>
          </div>
          <p className="text-sm text-zinc-400">Replies usually within 1–2 business days.</p>
        </div>
      </article>
    </main>
  );
}
