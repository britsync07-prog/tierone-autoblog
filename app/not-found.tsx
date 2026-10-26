import Link from 'next/link';
import { SILO_SLUGS, SILOS, siloUrl } from '@/lib/silos';
import { SITE_NAME } from '@/lib/site';

export const metadata = {
  title: 'Page Not Found',
  description: 'The requested page could not be located. Explore our AI tool benchmarks and topic clusters.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl flex-1 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-sm bg-[#f4f4f6] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#d92b21]">
          404 Error · Page Not Found
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#09090b] sm:text-5xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#52525b] sm:text-lg">
          The dispatch or guide you requested may have moved, been retired, or the URL might have a typo.
          Browse our authoritative topic clusters below to locate what you need.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-sm bg-[#d92b21] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c]"
          >
            ← Return to Homepage
          </Link>
          <Link
            href="/#topics"
            className="inline-flex items-center rounded-sm bg-[#f4f4f6] px-5 py-3 text-sm font-semibold text-[#09090b] transition-colors hover:bg-[#e4e4e7]"
          >
            Browse Topic Clusters
          </Link>
        </div>

        <div className="mt-16 text-left">
          <h2 className="text-xl font-bold tracking-tight text-[#09090b]">
            Explore {SITE_NAME} Topic Pillars
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SILO_SLUGS.map((slug) => {
              const silo = SILOS[slug];
              return (
                <Link
                  key={slug}
                  href={siloUrl(slug)}
                  className="group rounded-sm bg-[#f4f4f6] p-4 transition-colors hover:bg-[#ebebee]"
                >
                  <span className="font-semibold text-[#09090b] group-hover:text-[#d92b21] transition-colors">
                    {silo.label} →
                  </span>
                  <p className="mt-1 text-xs text-[#52525b] line-clamp-1">
                    {silo.intro}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
