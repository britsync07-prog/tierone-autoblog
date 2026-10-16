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
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16">
      <article className="mx-auto max-w-[65ch]">
        <h1 className="text-[30px] font-semibold leading-[1.2] text-[#171717]">
          About
        </h1>
        <div className="mt-6 space-y-6 text-[16px] leading-[1.5] text-[#171717]">
          <p>
            <span className="font-semibold">{SITE_NAME} — </span>
            {SITE_TAGLINE}. Every guide is written for builders in the US, UK,
            Canada, and Australia, in en-US.
          </p>
          <p>
            This site is published by{' '}
            <Link
              href={`/authors/${AUTHOR_SLUG}`}
              className="text-[#4f46e5] underline"
            >
              {AUTHOR_NAME}
            </Link>
            , a Full-Stack Product Engineer based in Bangladesh. There is one
            real publisher behind every article — no guest posts, no anonymous
            bylines.
          </p>
          <p>
            Every article starts as a hands-on draft, is checked against our
            sourcing standards, and is published only when it meets them. Read
            our{' '}
            <Link href="/editorial-process" className="text-[#4f46e5] underline">
              editorial process
            </Link>
            , including how AI assistance is disclosed on every post.
          </p>
          <p>
            Questions, corrections, or partnership inquiries:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[#4f46e5] underline"
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
