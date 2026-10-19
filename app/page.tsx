import Link from 'next/link';
import { allPosts } from 'content-collections';
import { SILO_SLUGS, SILOS, siloUrl } from '@/lib/silos';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// First-sentence excerpt of a silo intro (D-08 single-source: display copy
// lives only in lib/silos.ts — never duplicated here).
function introExcerpt(intro: string): string {
  const idx = intro.indexOf('. ');
  return idx === -1 ? intro : intro.slice(0, idx + 1);
}

// Latest-posts index (D-09). No silo assumptions, no images, no client JS.
// Posts come from the typed collection sorted newest-first.
export default function HomePage() {
  const posts = [...allPosts].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Editorial Hero Header */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#141419] to-[#0d0d10] p-6 sm:p-10">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Autonomous Daily Tech & AI Publication
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            {SITE_NAME}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            {SITE_TAGLINE}. In-depth tool benchmarks, hands-on architectural breakdowns, and daily breaking intelligence engineered for builders across the US, UK, Canada, and Australia.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-6 text-[13px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>Zero Human Gating</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>100% Free & Open Access</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>Strict Anti-Slop Fact-Checking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Lead Story */}
      {featuredPost && (
        <section aria-label="Featured latest guide" className="mt-10">
          <div className="group relative rounded-xl border border-white/[0.08] bg-[#121215] p-6 transition-all duration-200 hover:border-emerald-500/30 hover:bg-[#15151a]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Latest Release
              </span>
              <span className="text-[13px] text-zinc-400">
                {formatDate(featuredPost.publishedAt)} · {featuredPost.readingMinutes} min read
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="transition-colors group-hover:text-emerald-400"
              >
                {featuredPost.title}
              </Link>
            </h2>

            <p className="mt-3 line-clamp-3 text-base leading-relaxed text-zinc-300">
              {featuredPost.description}
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-emerald-400 group-hover:text-emerald-300"
              >
                Read complete analysis
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <span className="text-[12px] font-medium uppercase tracking-wider text-zinc-400">
                {SILOS[featuredPost.silo]?.label ?? featuredPost.silo}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Silo Hubs Section */}
      <section aria-labelledby="topics-heading" id="topics" className="mt-14">
        <div className="flex items-end justify-between">
          <div>
            <h2
              id="topics-heading"
              className="text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              Browse by Topic Cluster
            </h2>
            <p className="mt-1 text-[14px] text-zinc-400">
              Curated architectural clusters with verified comparison tables and practical walkthroughs.
            </p>
          </div>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SILO_SLUGS.map((slug) => {
            const silo = SILOS[slug];
            const count = posts.filter((post) => post.silo === slug).length;
            return (
              <li
                key={slug}
                className="group relative flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121215] p-5 transition-all duration-200 hover:border-emerald-500/30 hover:bg-[#15151a]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[17px] font-bold tracking-tight text-white transition-colors group-hover:text-emerald-400">
                      <Link href={siloUrl(slug)} className="focus:outline-none">
                        <span className="absolute inset-0" aria-hidden="true" />
                        {silo.label}
                      </Link>
                    </h3>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300">
                      {count} {count === 1 ? 'guide' : 'guides'}
                    </span>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-zinc-400">
                    {introExcerpt(silo.intro)}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-400">
                  Explore cluster
                  <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Publications Stream */}
      <section aria-label="Latest posts" className="mt-16">
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Recent Publications & Intelligence
        </h2>
        <p className="mt-1 text-[14px] text-zinc-400">
          Chronological index of full-length teardowns, benchmarked comparisons, and breaking tech reports.
        </p>

        {posts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#121215] p-8 text-center">
            <h3 className="text-lg font-semibold text-white">No posts published yet</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Fresh AI tool guides are on the way. Check back soon.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#121215]">
            {posts.map((post) => (
              <li key={post.slug} className="p-5 sm:p-6 transition-colors hover:bg-white/[0.02]">
                <article>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                      {SILOS[post.silo]?.label ?? post.silo}
                    </span>
                    <span className="text-[13px] text-zinc-400">
                      {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg sm:text-xl font-bold leading-snug tracking-tight text-white">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="transition-colors hover:text-emerald-400"
                    >
                      {post.title}
                    </Link>
                  </h3>

                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-300">
                    {post.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
