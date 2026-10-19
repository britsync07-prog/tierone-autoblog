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
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          About {SITE_NAME}
        </h1>
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 space-y-6 text-[15.5px] leading-relaxed text-zinc-300 shadow-xl">
          <p>
            <span className="font-semibold text-white">{SITE_NAME} — </span>
            {SITE_TAGLINE}. Every guide is written for builders in the US, UK,
            Canada, and Australia, in en-US.
          </p>
          <p>
            This site is published by{' '}
            <Link
              href={`/authors/${AUTHOR_SLUG}`}
              className="font-semibold text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
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
            <Link href="/editorial-process" className="font-semibold text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300">
              editorial process
            </Link>
            , including how AI assistance is disclosed on every post.
          </p>
          <p>
            Questions, corrections, or partnership inquiries:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
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
