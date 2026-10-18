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

  if (!isPillarHub) {
    // Standard reverse-chronological archive view for developing clusters (<8 posts)
    return (
      <>
        <BreadcrumbJsonLd {...breadcrumbProps} />
        <main id="main-content" className="mx-auto max-w-3xl px-4 py-16">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-[14px] text-slate-600">
              <li>
                <Link href="/" className="hover:text-[#4f46e5] hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-[#171717]">
                {def.label}
              </li>
            </ol>
          </nav>

          <h1 className="mt-4 text-[30px] font-semibold leading-[1.2] text-[#171717]">
            {def.label}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.5] text-[#171717]">
            {def.intro}
          </p>

          <section aria-label={`Latest ${def.label} guides`} className="mt-12">
            <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
              Latest {def.label} guides
            </h2>
            {posts.length === 0 ? (
              <p className="mt-4 text-[16px] leading-[1.5] text-slate-600">
                Fresh {def.label} guides are on the way. Check back soon.
              </p>
            ) : (
              <ul className="mt-6 grid gap-8">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <article>
                      <h3 className="text-[20px] md:text-[24px] font-semibold leading-[1.2]">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-[#171717] hover:text-[#4f46e5]"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-[16px] leading-[1.5] text-slate-600 line-clamp-2">
                        {post.description}
                      </p>
                      <p className="mt-2 text-[14px] text-slate-600">
                        {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-8 text-[16px] leading-[1.5] text-slate-600">
              <Link href="/#topics" className="text-[#4f46e5] hover:underline">
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

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-16">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-[14px] text-slate-600">
            <li>
              <Link href="/" className="hover:text-[#4f46e5] hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[#171717] font-medium">
              {def.label}
            </li>
          </ol>
        </nav>

        {/* 1. Authority Hero Banner */}
        <header className="mt-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-8 md:p-12 text-white shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 text-xs font-semibold tracking-wider text-indigo-200 uppercase">
              Topic Pillar Hub
            </span>
            <span className="text-xs text-slate-300">
              {posts.length} Verified Guides · 2026 Edition
            </span>
          </div>

          <h1 className="mt-4 text-[32px] md:text-[42px] font-bold leading-[1.15] tracking-tight">
            {def.landingTitle}
          </h1>

          <p className="mt-4 text-[16px] md:text-[18px] leading-[1.6] text-slate-200 max-w-3xl">
            {def.intro}
          </p>
        </header>

        {/* 2. Cornerstone Guide Spotlight */}
        {cornerstoneGuide && (
          <section aria-label="Cornerstone Architecture Guide" className="mt-12">
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-6 md:p-8 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600" />
                Cornerstone Architecture Guide
              </div>
              <h2 className="mt-3 text-[24px] md:text-[28px] font-bold leading-[1.2]">
                <Link
                  href={`/blog/${cornerstoneGuide.slug}`}
                  className="text-slate-900 hover:text-indigo-600"
                >
                  {cornerstoneGuide.title}
                </Link>
              </h2>
              <p className="mt-3 text-[16px] leading-[1.5] text-slate-700">
                {cornerstoneGuide.description}
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs font-medium text-slate-600">
                <span>{formatDate(cornerstoneGuide.publishedAt)}</span>
                <span>•</span>
                <span>{cornerstoneGuide.readingMinutes} min read</span>
                <span>•</span>
                <Link
                  href={`/blog/${cornerstoneGuide.slug}`}
                  className="text-indigo-600 font-semibold hover:underline"
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
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-[22px] md:text-[26px] font-bold text-slate-900">
                  Head-to-Head Comparisons & Benchmarks
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Side-by-side empirical evaluations, real tool costs, and verdict breakdowns.
                </p>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {comparisonPosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                  >
                    <div>
                      <h3 className="text-[18px] font-semibold leading-[1.3]">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-slate-900 hover:text-indigo-600"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
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
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-[22px] md:text-[26px] font-bold text-slate-900">
                  Workflows & Step-by-Step Guides
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Actionable techniques, prompt engineering, and proven operational playbooks.
                </p>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {guidePosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                  >
                    <div>
                      <h3 className="text-[18px] font-semibold leading-[1.3]">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-slate-900 hover:text-indigo-600"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
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
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-[22px] md:text-[26px] font-bold text-slate-900">
                  Architecture & Deep Dives
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Foundational mechanics, ecosystem updates, and technical insights.
                </p>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {deepDivePosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                  >
                    <div>
                      <h3 className="text-[18px] font-semibold leading-[1.3]">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-slate-900 hover:text-indigo-600"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
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
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-[22px] md:text-[26px] font-bold text-slate-900">
              All {def.label} Articles ({posts.length})
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Complete index of published articles in this topical cluster.
            </p>
          </div>

          <div className="mt-6 divide-y divide-slate-100">
            {posts.map((post) => (
              <div key={post.slug} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="max-w-2xl">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-[16px] font-semibold text-slate-900 hover:text-indigo-600"
                  >
                    {post.title}
                  </Link>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {post.description}
                  </p>
                </div>
                <div className="text-xs text-slate-400 shrink-0">
                  {formatDate(post.publishedAt)} · {post.readingMinutes}m
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Cluster Navigation & Up-Links */}
        <nav aria-label="Topic navigation" className="mt-16 rounded-xl bg-slate-50 border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-700">
            Explore our other authoritative technology hubs or return to the main index.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/#topics"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Browse All Topics →
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Home Index
            </Link>
          </div>
        </nav>
      </main>
    </>
  );
}
