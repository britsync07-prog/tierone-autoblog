import type { Metadata } from 'next';
import AuthorCard from '@/components/author-card';
import { AUTHOR_NAME, SITE_NAME, SITE_URL } from '@/lib/site';

const AUTHOR_PATH = '/authors/musfiqur-rahman-saimon';

// Rendered <title> resolves via the layout template to exactly
// "About Musfiqur Rahman Saimon | AI Tool Digest" (UI-SPEC copy contract).
export const metadata: Metadata = {
  title: `About ${AUTHOR_NAME}`,
  description: `${AUTHOR_NAME} is a Full-Stack Product Engineer based in Bangladesh, publishing practical AI tool guides for Tier-1 builders.`,
  alternates: {
    canonical: `${SITE_URL}${AUTHOR_PATH}`,
  },
};

// Machine-readable publisher identity (EEAT trust anchor, D-12).
// sameAs ties this page to the real, verifiable profiles linked below.
function AuthorJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: AUTHOR_NAME,
    url: `${SITE_URL}${AUTHOR_PATH}`,
    jobTitle: 'Full-Stack Product Engineer',
    homeLocation: 'Bangladesh',
    sameAs: [
      'https://www.linkedin.com/in/musfiqur-rahman-saimon-a5994b3aa',
      'https://github.com/britsync07-prog',
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\u003c'),
      }}
    />
  );
}

export default function AuthorPage() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16">
      <article className="mx-auto max-w-[65ch]">
        <h1 className="text-[30px] font-semibold leading-[1.2] text-[#171717]">
          {AUTHOR_NAME}
        </h1>
        <div className="mt-6">
          <AuthorCard showPhoto />
        </div>
        <div className="mt-8 space-y-6 text-[16px] leading-[1.5] text-[#171717]">
          <p>
            <span className="font-semibold">Focus: </span>
            Shipping complete, production-grade products.
          </p>
          <blockquote className="rounded-lg border border-l-4 border-indigo-200 bg-indigo-50 p-4">
            Paper-trade it, test it, then deploy it.
          </blockquote>
          <p>
            Currently building: AI-powered tooling &amp; agent integrations
            (MCP).
          </p>
          <p>
            Based in Bangladesh; writing for a US/UK/CA/AU audience in en-US.
          </p>
          <section aria-label="Profiles">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              Profiles
            </h2>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href="https://www.linkedin.com/in/musfiqur-rahman-saimon-a5994b3aa"
                  rel="me noopener"
                  className="text-[#4f46e5] underline"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/britsync07-prog"
                  rel="me noopener"
                  className="text-[#4f46e5] underline"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </section>
          <p className="text-[14px] text-slate-600">
            {SITE_NAME} publishes under this single, real byline. There are no
            other authors on this site.
          </p>
        </div>
      </article>
      <AuthorJsonLd />
    </main>
  );
}
