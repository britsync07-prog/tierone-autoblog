import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreadcrumbJsonLd } from 'next-seo';
import { allPosts } from 'content-collections';
import { SILO_SLUGS, getSilo } from '@/lib/silos';
import { canonicalFor, localeAlternates } from '@/lib/seo/canonical';
import { buildBreadcrumbJsonLd, buildCollectionPageJsonLd } from '@/lib/seo/jsonld';
import { SITE_URL } from '@/lib/site';

// Silo landing route (Plan 06-04, D-09, D-10, GROW-03).
// Dynamically elevates to a rich Pillar Hub when a silo accumulates >= 8 published articles.
// When < 8 articles, renders the clean reverse-chronological archive list.
export function generateStaticParams() {
  return SILO_SLUGS.map((silo) => ({ silo }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ silo: string }>;
}): Promise<Metadata> {
  const { silo } = await params;
  const def = getSilo(silo);
  if (!def) notFound();
  const canonical = canonicalFor(`/${silo}`);
  return {
    title: def.landingTitle,
    description: def.metaDescription,
    alternates: { ...localeAlternates(canonical) },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function SiloLandingPage({
  params,
}: {
  params: Promise<{ silo: string }>;
}) {
  const { silo } = await params;
  const def = getSilo(silo);
  if (!def) notFound();

  const posts = allPosts
    .filter((post) => post.silo === silo)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const canonical = canonicalFor(`/${silo}`);
  const isPillarHub = posts.length >= 8;

  // Breadcrumbs shared across both archive & pillar views
  const breadcrumbProps = buildBreadcrumbJsonLd([
    { name: 'Home', item: SITE_URL },
    { name: def.label, item: canonical },
  ]);

  // Schema.org CollectionPage declaring hasPart relationships with all published spokes
  const collectionJsonLd = buildCollectionPageJsonLd(
    def,
    posts.map((p) => ({
      title: p.title,
      slug: p.slug,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
    })),
    canonical
  );

  if (!isPillarHub) {
    // Standard reverse-chronological archive view for developing clusters (<8 posts)
    return (
      <>
        <BreadcrumbJsonLd {...breadcrumbProps} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
        />
        <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-[#82828e]">
              <li>
                <Link href="/" className="transition-colors hover:text-[#fe7141]">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-[#52525e]">/</li>
              <li aria-current="page" className="text-[#d1d1d6]">
                {def.label}
              </li>
            </ol>
          </nav>

          <header className="mt-8 rounded-sm bg-[#141418] p-6 sm:p-10">
            <div>
              <span className="inline-block rounded-sm bg-[#1c1c22] px-3 py-1 text-xs font-semibold text-[#fe7141]">
                Topical cluster
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
                {def.label}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#d1d1d6] sm:text-lg">
                {def.intro}
              </p>
            </div>
          </header>

          <section aria-label={`Latest ${def.label}`} className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {silo === 'ai-news' ? `Latest ${def.label}` : `Latest ${def.label} guides`}
            </h2>

            {posts.length === 0 ? (
              <div className="mt-6 rounded-sm bg-[#141418] p-8 text-center">
                <p className="text-sm text-[#82828e]">
                  Fresh {def.label} content is on the way. Check back soon.
                </p>
              </div>
            ) : (
              <ul className="mt-6 space-y-4">
                {posts.map((post) => (
                  <li key={post.slug} className="rounded-sm bg-[#141418] p-6 transition-colors hover:bg-[#18181f]">
                    <article>
                      <h3 className="text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-[#fe7141]"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-[#d1d1d6] line-clamp-2">
                        {post.description}
                      </p>
                      <p className="mt-4 text-xs tabular-nums text-[#82828e]">
                        {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-10 rounded-sm bg-[#141418] p-6">
              <p className="text-sm text-[#82828e]">
                Looking for related technical domains?{' '}
                <Link href="/#topics" className="font-medium text-[#fe7141] hover:underline">
                  Browse all topic clusters
                </Link>
                .
              </p>
            </div>
          </section>
        </main>
      </>
    );
  }

  // Elevated Pillar Hub Layout (>= 8 published articles)
  // Identify cornerstone flagship guide
  const cornerstoneGuide =
    posts.find(
      (p) =>
        p.slug === `${silo}-complete-guide` ||
        p.slug.endsWith('-complete-guide') ||
        p.slug.includes('complete-guide')
    ) ?? posts[0];

  // Group spokes into thematic sub-clusters
  const comparisonPosts = posts.filter(
    (p) =>
      p.slug !== cornerstoneGuide.slug &&
      (Boolean(p.comparison) ||
        /\b(vs|compare|comparison|versus|best|review)\b/i.test(p.title) ||
        p.slug.includes('-vs-'))
  );

  const guidePosts = posts.filter(
    (p) =>
      p.slug !== cornerstoneGuide.slug &&
      !comparisonPosts.includes(p) &&
      /\b(guide|how-to|workflow|tutorial|prompting|tips)\b/i.test(p.title)
  );

  const deepDivePosts = posts.filter(
    (p) =>
      p.slug !== cornerstoneGuide.slug &&
      !comparisonPosts.includes(p) &&
      !guidePosts.includes(p)
  );

  return (
    <>
      <BreadcrumbJsonLd {...breadcrumbProps} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-[#82828e]">
            <li>
              <Link href="/" className="transition-colors hover:text-[#fe7141]">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-[#52525e]">/</li>
            <li aria-current="page" className="text-[#d1d1d6]">
              {def.label}
            </li>
          </ol>
        </nav>

        {/* 1. Authority Hero Banner */}
        <header className="mt-8 rounded-sm bg-[#141418] p-8 md:p-12 text-white">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-block rounded-sm bg-[#1c1c22] px-3 py-1 text-xs font-semibold text-[#fe7141]">
                Topic pillar hub
              </span>
              <span className="text-xs tabular-nums text-[#82828e]">
                {posts.length} verified guides · 2026 edition
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl lg:leading-[1.1]">
              {def.landingTitle}
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#d1d1d6] md:text-lg">
              {def.intro}
            </p>
          </div>
        </header>

        {/* 2. Cornerstone Guide Spotlight */}
        {cornerstoneGuide && (
          <section aria-label="Cornerstone Architecture Guide" className="mt-12">
            <div className="rounded-sm bg-[#18181f] p-6 md:p-8">
              <div className="text-xs font-semibold text-[#fe7141]">
                Cornerstone architecture guide
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
                <Link
                  href={`/blog/${cornerstoneGuide.slug}`}
                  className="transition-colors hover:text-[#fe7141]"
                >
                  {cornerstoneGuide.title}
                </Link>
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#d1d1d6]">
                {cornerstoneGuide.description}
              </p>
              <div className="mt-5 flex items-center gap-4 text-xs tabular-nums text-[#82828e]">
                <span>{formatDate(cornerstoneGuide.publishedAt)}</span>
                <span>·</span>
                <span>{cornerstoneGuide.readingMinutes} min read</span>
                <span>·</span>
                <Link
                  href={`/blog/${cornerstoneGuide.slug}`}
                  className="font-semibold text-[#fe7141] hover:underline"
                >
                  Read flagship guide →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* 3. Thematic Sub-Clusters */}
        <div className="mt-16 space-y-14">
          {comparisonPosts.length > 0 && (
            <section aria-label="Comparisons & Benchmarks">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Head-to-head comparisons & benchmarks
                </h2>
                <p className="mt-1 text-sm text-[#82828e]">
                  Side-by-side empirical evaluations, real tool costs, and verdict breakdowns.
                </p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {comparisonPosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-sm bg-[#141418] p-6 transition-colors hover:bg-[#18181f]"
                  >
                    <div>
                      <h3 className="text-lg font-bold leading-snug tracking-tight text-white">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-[#fe7141]"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#d1d1d6] line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs tabular-nums text-[#82828e]">
                      <span>{formatDate(post.publishedAt)}</span>
                      <span>·</span>
                      <span>{post.readingMinutes} min read</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {guidePosts.length > 0 && (
            <section aria-label="Workflows & Practical Guides">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Workflows & step-by-step guides
                </h2>
                <p className="mt-1 text-sm text-[#82828e]">
                  Actionable techniques, prompt engineering, and proven operational playbooks.
                </p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {guidePosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-sm bg-[#141418] p-6 transition-colors hover:bg-[#18181f]"
                  >
                    <div>
                      <h3 className="text-lg font-bold leading-snug tracking-tight text-white">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-[#fe7141]"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#d1d1d6] line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs tabular-nums text-[#82828e]">
                      <span>{formatDate(post.publishedAt)}</span>
                      <span>·</span>
                      <span>{post.readingMinutes} min read</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {deepDivePosts.length > 0 && (
            <section aria-label="Architecture & In-Depth Analyses">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Architecture & deep dives
                </h2>
                <p className="mt-1 text-sm text-[#82828e]">
                  Foundational mechanics, ecosystem updates, and technical insights.
                </p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {deepDivePosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-sm bg-[#141418] p-6 transition-colors hover:bg-[#18181f]"
                  >
                    <div>
                      <h3 className="text-lg font-bold leading-snug tracking-tight text-white">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-[#fe7141]"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#d1d1d6] line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs tabular-nums text-[#82828e]">
                      <span>{formatDate(post.publishedAt)}</span>
                      <span>·</span>
                      <span>{post.readingMinutes} min read</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 4. Complete Spoke Directory */}
        <section aria-label={`Complete ${def.label} Directory`} className="mt-16">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              All {def.label} articles ({posts.length})
            </h2>
            <p className="mt-1 text-sm text-[#82828e]">
              Complete index of published articles in this topical cluster.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {posts.map((post) => (
              <div key={post.slug} className="rounded-sm bg-[#141418] p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="max-w-2xl">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-base font-semibold text-white transition-colors hover:text-[#fe7141]"
                  >
                    {post.title}
                  </Link>
                  <p className="mt-1 text-sm text-[#82828e] line-clamp-1">
                    {post.description}
                  </p>
                </div>
                <div className="text-xs tabular-nums text-[#82828e] shrink-0">
                  {formatDate(post.publishedAt)} · {post.readingMinutes}m
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Cluster Navigation & Up-Links */}
        <nav aria-label="Topic navigation" className="mt-16 rounded-sm bg-[#141418] p-8 text-center">
          <p className="text-sm text-[#d1d1d6]">
            Explore our other authoritative technology hubs or return to the main index.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/#topics"
              className="inline-flex items-center rounded-sm bg-[#fe7141] px-5 py-2.5 text-xs font-semibold text-black transition-colors hover:bg-[#e05e32]"
            >
              Browse all topics →
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-sm bg-[#1c1c22] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#25252e]"
            >
              Home index
            </Link>
          </div>
        </nav>
      </main>
    </>
  );
}
