import Link from 'next/link';
import { allPosts } from 'content-collections';
import { getSilo, siloUrl, type SiloSlug } from '@/lib/silos';

// Deterministic same-silo fallback (D-10/D-14): up to 3 posts sharing the
// current post's silo tag, newest-first — never hidden (D-11: minor upgrade,
// not a rewrite). The header is the pillar up-link "More in {Label}" → silo
// landing (D-09, alongside the breadcrumb); when no siblings exist the
// section still renders with an empty-state link to the landing so 1-post
// silos have no dead end (D-12 zero-orphan via landing-list membership).
// Anchor text stays titles for siblings and the silo display name for the
// pillar link (D-13 — no keyword stuffing). The Phase-3 link-graph engine
// upgrades the sibling logic without changing the { currentSlug, silo }
// contract.
export default function RelatedPosts({
  currentSlug,
  silo,
}: {
  currentSlug: string;
  silo: SiloSlug;
}) {
  const def = getSilo(silo);
  const label = def?.label ?? silo;

  const related = allPosts
    .filter((post) => post.slug !== currentSlug && post.silo === silo)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  return (
    <section aria-label="Related guides" className="mt-12">
      <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
        More in{' '}
        <Link
          href={siloUrl(silo)}
          className="text-[#4f46e5] hover:underline"
        >
          {label}
        </Link>
      </h2>
      {related.length === 0 ? (
        <p className="mt-4 text-[16px] leading-[1.5] text-slate-600">
          <Link href={siloUrl(silo)} className="text-[#4f46e5] hover:underline">
            See all {label} guides
          </Link>{' '}
          while more are in the pipeline.
        </p>
      ) : (
        <ul className="mt-4 grid gap-8">
          {related.map((post) => (
            <li key={post.slug}>
              <h3 className="text-[20px] font-semibold leading-[1.2]">
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
