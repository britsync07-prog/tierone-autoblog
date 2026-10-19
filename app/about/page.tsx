import type { Metadata } from 'next';
import Link from 'next/link';
import {
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  AUTHOR_NAME,
  AUTHOR_SLUG,
  CONTACT_EMAIL,
} from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `About ${SITE_NAME}: ${SITE_TAGLINE}.`,
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-bold tracking-tight text-[#09090b] sm:text-4xl">
          About {SITE_NAME}
        </h1>
        <div className="mt-8 rounded-sm bg-[#f4f4f6] p-6 sm:p-10 space-y-6 text-base leading-relaxed text-[#27272a]">
          <p>
            <span className="font-semibold text-[#09090b]">{SITE_NAME} — </span>
            {SITE_TAGLINE}. Every guide is written for engineers and technical leaders across Tier-1 markets (US, UK, Canada, and Australia).
          </p>
          <p>
            This publication is founded and edited by{' '}
            <Link
              href={`/authors/${AUTHOR_SLUG}`}
              className="font-semibold text-[#d92b21] underline underline-offset-4 decoration-[#d92b21] transition-colors hover:text-[#09090b]"
            >
              {AUTHOR_NAME}
            </Link>
            , a Full-Stack Product Engineer based in Bangladesh. There is one accountable publisher behind every release — zero anonymous content farms or scraped reposts.
          </p>
          <p>
            Every dispatch starts with code analysis or benchmark testing, passes structured information gain rubrics, and publishes only when technical claims are verified against primary documentation. Review our{' '}
            <Link
              href="/editorial-process"
              className="font-semibold text-[#d92b21] underline underline-offset-4 decoration-[#d92b21] transition-colors hover:text-[#09090b]"
            >
              editorial process
            </Link>
            , including our transparent disclosure on machine assistance.
          </p>
          <p>
            Direct inquiries, corrections, and benchmark pitches:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-[#d92b21] underline underline-offset-4 decoration-[#d92b21] transition-colors hover:text-[#09090b]"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </article>
    </main>
  );
}
