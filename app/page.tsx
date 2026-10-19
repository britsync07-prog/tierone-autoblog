import Link from 'next/link';
import { allPosts } from 'content-collections';
import { SILO_SLUGS, SILOS, siloUrl } from '@/lib/silos';
import { SITE_NAME } from '@/lib/site';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function introExcerpt(intro: string): string {
  const idx = intro.indexOf('. ');
  return idx === -1 ? intro : intro.slice(0, idx + 1);
}

export default function HomePage() {
  const posts = [...allPosts].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  const featuredPost = posts[0];
  const recentPosts = posts.slice(1, 7);

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Editorial Masthead */}
      <section className="rounded-sm bg-[#f4f4f6] p-8 sm:p-12">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-block rounded-sm bg-white px-3 py-1 text-xs font-semibold text-[#d92b21]">
            Daily dispatch
          </span>
          <span className="text-xs tabular-nums text-[#52525b]">
            Zero human gating · 100% open access
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[#09090b] sm:text-6xl sm:leading-[1.05]">
          Autonomous AI <br />
          Engineering Intelligence.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#27272a] sm:text-lg">
          Rigorous benchmarks, breaking model breakdowns, and architectural field reports engineered for builders across the United States, United Kingdom, Canada, and Australia.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/ai-news"
            className="inline-flex items-center rounded-sm bg-[#d92b21] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c]"
          >
            Read breaking news →
          </Link>
          <Link
            href="#topics"
            className="inline-flex items-center rounded-sm bg-white px-5 py-3 text-sm font-semibold text-[#09090b] transition-colors hover:bg-[#e4e4e7]"
          >
            Explore topic clusters
          </Link>
        </div>

        <div className="mt-10 grid gap-4 pt-4 sm:grid-cols-3">
          <div className="rounded-sm bg-white p-4">
            <div className="text-xs font-semibold text-[#d92b21]">Autonomous loop</div>
            <div className="mt-1 text-sm text-[#52525b]">Zero human intervention from ingest to live deploy.</div>
          </div>
          <div className="rounded-sm bg-white p-4">
            <div className="text-xs font-semibold text-[#d92b21]">Fact checked</div>
            <div className="mt-1 text-sm text-[#52525b]">Strict anti-slop verifications on every release.</div>
          </div>
          <div className="rounded-sm bg-white p-4">
            <div className="text-xs font-semibold text-[#d92b21]">Cloudflare edge</div>
            <div className="mt-1 text-sm text-[#52525b]">Static pre-rendering across 300+ edge points.</div>
          </div>
        </div>
      </section>

      {/* Featured Lead Story */}
      {featuredPost && (
        <section aria-label="Featured latest dispatch" className="mt-12">
          <div className="rounded-sm bg-[#f4f4f6] p-8 transition-colors hover:bg-[#ebebee]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-sm bg-white px-2.5 py-1 text-xs font-semibold text-[#d92b21]">
                Latest lead story
              </span>
              <span className="text-xs tabular-nums text-[#52525b]">
                {formatDate(featuredPost.publishedAt)} · {featuredPost.readingMinutes} min read
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#09090b] sm:text-4xl">
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="transition-colors hover:text-[#d92b21]"
              >
                {featuredPost.title}
              </Link>
            </h2>

            <p className="mt-4 text-base leading-relaxed text-[#27272a] sm:text-lg">
              {featuredPost.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#d92b21] hover:underline"
              >
                Read complete analysis →
              </Link>
              <span className="text-xs font-medium text-[#52525b]">
                {SILOS[featuredPost.silo]?.label ?? featuredPost.silo}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Silo Hubs Section */}
      <section aria-labelledby="topics-heading" id="topics" className="mt-16">
        <div>
          <h2
            id="topics-heading"
            className="text-2xl font-bold tracking-tight text-[#09090b] sm:text-3xl"
          >
            Topic clusters
          </h2>
          <p className="mt-2 text-base text-[#52525b]">
            Curated architectural clusters with verified comparison tables and practical walkthroughs.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SILO_SLUGS.map((slug) => {
            const silo = SILOS[slug];
            const count = posts.filter((post) => post.silo === slug).length;
            return (
              <div
                key={slug}
                className="group flex flex-col justify-between rounded-sm bg-[#f4f4f6] p-6 transition-colors hover:bg-[#ebebee]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold tracking-tight text-[#09090b] transition-colors group-hover:text-[#d92b21]">
                      <Link href={siloUrl(slug)}>
                        {silo.label}
                      </Link>
                    </h3>
                    <span className="rounded-sm bg-white px-2 py-0.5 text-xs tabular-nums font-semibold text-[#52525b]">
                      {count} {count === 1 ? 'guide' : 'guides'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[#52525b] line-clamp-2">
                    {introExcerpt(silo.intro)}
                  </p>
                </div>

                <div className="mt-6">
                  <Link
                    href={siloUrl(slug)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#d92b21] hover:underline"
                  >
                    Explore cluster →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Publications Stream */}
      <section aria-label="Latest posts" className="mt-16">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#09090b] sm:text-3xl">
            Recent dispatches & guides
          </h2>
          <p className="mt-2 text-base text-[#52525b]">
            Chronological index of full-length teardowns, benchmarked comparisons, and breaking tech reports.
          </p>
        </div>

        {recentPosts.length === 0 ? (
          <div className="mt-6 rounded-sm bg-[#f4f4f6] p-8 text-center">
            <h3 className="text-lg font-semibold text-[#09090b]">No posts published yet</h3>
            <p className="mt-2 text-sm text-[#52525b]">
              Fresh AI tool guides are on the way. Check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {recentPosts.map((post) => (
              <article
                key={post.slug}
                className="rounded-sm bg-[#f4f4f6] p-6 transition-colors hover:bg-[#ebebee]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-white px-2 py-0.5 text-xs font-semibold text-[#d92b21]">
                    {SILOS[post.silo]?.label ?? post.silo}
                  </span>
                  <span className="text-xs tabular-nums text-[#52525b]">
                    {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                  </span>
                </div>

                <h3 className="mt-3 text-xl font-bold leading-snug tracking-tight text-[#09090b] sm:text-2xl">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="transition-colors hover:text-[#d92b21]"
                  >
                    {post.title}
                  </Link>
                </h3>

                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#27272a]">
                  {post.description}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
