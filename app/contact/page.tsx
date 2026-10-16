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
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16">
      <article className="mx-auto max-w-[65ch]">
        <h1 className="text-[30px] font-semibold leading-[1.2] text-[#171717]">
          Contact
        </h1>
        <div className="mt-6 space-y-6 text-[16px] leading-[1.5] text-[#171717]">
          <p>
            For questions, corrections, or partnership inquiries, reach the
            publisher directly by email:
          </p>
          <p>
            <a
              href="mailto:saimon@ascentraconsulting.co.uk"
              className="text-[#4f46e5] underline"
            >
              saimon@ascentraconsulting.co.uk
            </a>
          </p>
          <p>Replies within a few business days.</p>
        </div>
      </article>
    </main>
  );
}
