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
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          About the Publisher
        </h1>
        <div className="mt-6">
          <AuthorCard showPhoto />
        </div>
        <div className="mt-8 space-y-6 text-[15.5px] leading-relaxed text-zinc-300">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 space-y-4 shadow-xl">
            <p>
              <span className="font-semibold text-white">Focus: </span>
              Shipping complete, production-grade products and autonomous content systems.
            </p>
            <blockquote className="rounded-xl border border-l-4 border-emerald-500/40 bg-emerald-950/20 p-4 text-emerald-200">
              Paper-trade it, test it, then deploy it.
            </blockquote>
            <p>
              Currently building: AI-powered tooling &amp; agent integrations
              (MCP).
            </p>
            <p>
              Based in Bangladesh; writing for a US/UK/CA/AU audience in en-US.
            </p>
          </div>

          <section aria-label="Profiles" className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 shadow-xl">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Verified Profiles
            </h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href="https://www.linkedin.com/in/musfiqur-rahman-saimon-a5994b3aa"
                  rel="me noopener"
                  className="font-semibold text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
                >
                  LinkedIn Profile →
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/britsync07-prog"
                  rel="me noopener"
                  className="font-semibold text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
                >
                  GitHub Repository &amp; Code →
                </a>
              </li>
            </ul>
          </section>

          <p className="text-xs text-zinc-500">
            {SITE_NAME} publishes under this single, real byline. There are no
            other authors on this site.
          </p>
        </div>
      </article>
      <AuthorJsonLd />
    </main>
  );
}
