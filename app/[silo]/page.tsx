import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allPosts } from 'content-collections';
import { SILO_SLUGS, getSilo } from '@/lib/silos';
import { canonicalFor, localeAlternates } from '@/lib/seo/canonical';

// Silo landing route (D-02 root shape `/{silo}`, D-03 curated intro + list,
// D-07 ship-all-5, D-16 newest-first). Slugs come from SILO_SLUGS only —
// never a local slug list (single-source rule). Static routes (/about, /blog
// is a directory so no clash) take precedence in App Router: a future static
// page named like a silo would shadow that landing — accepted, rename the
// silo instead. OpenGraph images reuse the site fallback /opengraph-image
// route (no per-silo image routes — scope control).
export function generateStaticParams() {
  return SILO_SLUGS.map((silo) => ({ silo }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ silo: string }>;
}): Promise<Metadata> {
  const { silo } = await params;
  // T-02-02 invalid-silo defense: undeclared slug → 404, no reflection.
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
  // T-02-02: allowlist lookup only; unknown slug → notFound (no filesystem
  // or query-param reflection anywhere in this route).
  const def = getSilo(silo);
  if (!def) notFound();

  const posts = allPosts
    .filter((post) => post.silo === silo)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
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
                    {formatDate(post.publishedAt)} · {post.readingMinutes} min
                    read
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
  );
}
