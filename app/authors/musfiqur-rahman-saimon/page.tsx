import type { Metadata } from 'next';
import AuthorCard from '@/components/author-card';
import { AUTHOR_NAME, SITE_NAME, SITE_URL } from '@/lib/site';

const AUTHOR_PATH = '/authors/musfiqur-rahman-saimon';

export const metadata: Metadata = {
  title: `About ${AUTHOR_NAME}`,
  description: `${AUTHOR_NAME} is a Full-Stack Product Engineer based in Bangladesh, publishing practical AI tool guides for Tier-1 builders.`,
  alternates: {
    canonical: `${SITE_URL}${AUTHOR_PATH}`,
  },
};

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
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <AuthorJsonLd />
      <article className="mx-auto max-w-[68ch]">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          About the Publisher
        </h1>
        <div className="mt-8">
          <AuthorCard showPhoto />
        </div>
        <div className="mt-10 space-y-8 text-base leading-relaxed text-[#d1d1d6]">
          <div className="rounded-sm bg-[#141418] p-6 sm:p-8 space-y-4">
            <p>
              <span className="font-semibold text-white">Focus: </span>
              Engineering resilient autonomous agents, rigorous LLM pipelines, and high-performance web systems.
            </p>
            <blockquote className="rounded-sm border-l-4 border-[#fe7141] bg-[#1c1c22] p-4 text-white">
              Paper-trade it, test it against code, then deploy it.
            </blockquote>
            <p>
              Currently building: Autonomous content pipelines, tool-use evaluation suites, and model performance benchmarks.
            </p>
            <p>
              Based in Bangladesh; publishing technical intelligence for US, UK, Canada, and Australian engineering teams.
            </p>
          </div>

          <section aria-label="Profiles" className="rounded-sm bg-[#141418] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Verified Profiles
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="https://www.linkedin.com/in/musfiqur-rahman-saimon-a5994b3aa"
                  rel="me noopener"
                  className="font-semibold text-[#fe7141] underline underline-offset-4 decoration-[#fe7141] transition-colors hover:text-white"
                >
                  LinkedIn Profile →
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/britsync07-prog"
                  rel="me noopener"
                  className="font-semibold text-[#fe7141] underline underline-offset-4 decoration-[#fe7141] transition-colors hover:text-white"
                >
                  GitHub Repository &amp; Code →
                </a>
              </li>
            </ul>
          </section>

          <p className="text-xs text-[#82828e]">
            {SITE_NAME} publishes under this single, accountable byline. There are no ghostwriters or unverified contributors.
          </p>
        </div>
      </article>
    </main>
  );
}
