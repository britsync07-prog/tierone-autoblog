import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreadcrumbJsonLd } from 'next-seo';
import { allPosts, type Post } from 'content-collections';
import { SILO_SLUGS, getSilo } from '@/lib/silos';
import { canonicalFor, localeAlternates } from '@/lib/seo/canonical';
import { buildBreadcrumbJsonLd, buildCollectionPageJsonLd } from '@/lib/seo/jsonld';
import { SITE_NAME, SITE_URL } from '@/lib/site';

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
            <ol className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-zinc-400">
              <li>
                <Link href="/" className="transition-colors hover:text-emerald-400">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-zinc-600">/</li>
              <li aria-current="page" className="text-zinc-200">
                {def.label}
              </li>
            </ol>
          </nav>

          <header className="relative mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#141419] to-[#0d0d10] p-6 sm:p-8">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Topical Cluster
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {def.label}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-300">
                {def.intro}
              </p>
            </div>
          </header>

          <section aria-label={`Latest ${def.label}`} className="mt-12">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {silo === 'ai-news' ? `Latest ${def.label}` : `Latest ${def.label} guides`}
            </h2>

            {posts.length === 0 ? (
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#121215] p-8 text-center">
                <p className="text-sm text-zinc-400">
                  Fresh {def.label} content is on the way. Check back soon.
                </p>
              </div>
            ) : (
              <ul className="mt-6 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#121215]">
                {posts.map((post) => (
                  <li key={post.slug} className="p-5 sm:p-6 transition-colors hover:bg-white/[0.02]">
                    <article>
                      <h3 className="text-lg font-bold leading-snug tracking-tight text-white sm:text-xl">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-emerald-400"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300 line-clamp-2">
                        {post.description}
                      </p>
                      <p className="mt-3 text-[13px] text-zinc-400">
                        {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-8 text-sm text-zinc-400">
              <Link href="/#topics" className="font-medium text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
                Browse all topics
              </Link>{' '}
              to explore the other guides on this site.
            </p>
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
          <ol className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-zinc-400">
            <li>
              <Link href="/" className="transition-colors hover:text-emerald-400">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-zinc-600">/</li>
            <li aria-current="page" className="font-medium text-zinc-200">
              {def.label}
            </li>
          </ol>
        </nav>

        {/* 1. Authority Hero Banner */}
        <header className="relative mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#16161b] via-[#121215] to-[#0d0d10] p-8 md:p-12 text-white shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Topic Pillar Hub
              </span>
              <span className="text-xs text-zinc-400">
                {posts.length} Verified Guides · 2026 Edition
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[42px] lg:leading-[1.15]">
              {def.landingTitle}
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-300 md:text-lg">
              {def.intro}
            </p>
          </div>
        </header>

        {/* 2. Cornerstone Guide Spotlight */}
        {cornerstoneGuide && (
          <section aria-label="Cornerstone Architecture Guide" className="mt-12">
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#121215] to-[#121215] p-6 md:p-8 shadow-xl shadow-emerald-950/10 transition-all hover:border-emerald-500/50">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                Cornerstone Architecture Guide
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white md:text-[28px] md:leading-[1.2]">
                <Link
                  href={`/blog/${cornerstoneGuide.slug}`}
                  className="transition-colors hover:text-emerald-400"
                >
                  {cornerstoneGuide.title}
                </Link>
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
                {cornerstoneGuide.description}
              </p>
              <div className="mt-5 flex items-center gap-4 text-xs font-medium text-zinc-400">
                <span>{formatDate(cornerstoneGuide.publishedAt)}</span>
                <span>•</span>
                <span>{cornerstoneGuide.readingMinutes} min read</span>
                <span>•</span>
                <Link
                  href={`/blog/${cornerstoneGuide.slug}`}
                  className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  Read Flagship Guide →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* 3. Thematic Sub-Clusters */}
        <div className="mt-16 space-y-14">
          {comparisonPosts.length > 0 && (
            <section aria-label="Comparisons & Benchmarks">
              <div className="border-b border-white/[0.08] pb-3">
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Head-to-Head Comparisons & Benchmarks
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Side-by-side empirical evaluations, real tool costs, and verdict breakdowns.
                </p>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {comparisonPosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121215] p-5 shadow-sm transition hover:border-emerald-500/30 hover:bg-[#15151a]"
                  >
                    <div>
                      <h3 className="text-[17px] font-bold leading-snug tracking-tight text-white">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-emerald-400"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300 line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                      <span>{formatDate(post.publishedAt)}</span>
                      <span>•</span>
                      <span>{post.readingMinutes} min read</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {guidePosts.length > 0 && (
            <section aria-label="Workflows & Practical Guides">
              <div className="border-b border-white/[0.08] pb-3">
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Workflows & Step-by-Step Guides
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Actionable techniques, prompt engineering, and proven operational playbooks.
                </p>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {guidePosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121215] p-5 shadow-sm transition hover:border-emerald-500/30 hover:bg-[#15151a]"
                  >
                    <div>
                      <h3 className="text-[17px] font-bold leading-snug tracking-tight text-white">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-emerald-400"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300 line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                      <span>{formatDate(post.publishedAt)}</span>
                      <span>•</span>
                      <span>{post.readingMinutes} min read</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {deepDivePosts.length > 0 && (
            <section aria-label="Architecture & In-Depth Analyses">
              <div className="border-b border-white/[0.08] pb-3">
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Architecture & Deep Dives
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Foundational mechanics, ecosystem updates, and technical insights.
                </p>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {deepDivePosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121215] p-5 shadow-sm transition hover:border-emerald-500/30 hover:bg-[#15151a]"
                  >
                    <div>
                      <h3 className="text-[17px] font-bold leading-snug tracking-tight text-white">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="transition-colors hover:text-emerald-400"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300 line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                      <span>{formatDate(post.publishedAt)}</span>
                      <span>•</span>
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
          <div className="border-b border-white/[0.08] pb-3">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              All {def.label} Articles ({posts.length})
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Complete index of published articles in this topical cluster.
            </p>
          </div>

          <div className="mt-6 divide-y divide-white/[0.04] rounded-xl border border-white/[0.08] bg-[#121215] px-5 sm:px-6">
            {posts.map((post) => (
              <div key={post.slug} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="max-w-2xl">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-[15px] font-semibold text-white transition-colors hover:text-emerald-400"
                  >
                    {post.title}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-1">
                    {post.description}
                  </p>
                </div>
                <div className="text-xs text-zinc-400 shrink-0">
                  {formatDate(post.publishedAt)} · {post.readingMinutes}m
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Cluster Navigation & Up-Links */}
        <nav aria-label="Topic navigation" className="mt-16 rounded-2xl border border-white/[0.08] bg-[#121215] p-8 text-center">
          <p className="text-sm text-zinc-300">
            Explore our other authoritative technology hubs or return to the main index.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/#topics"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-950/20 transition-all hover:bg-emerald-500"
            >
              Browse All Topics →
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              Home Index
            </Link>
          </div>
        </nav>
      </main>
    </>
  );
}
