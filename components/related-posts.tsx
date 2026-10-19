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
    <section aria-label="Related guides" className="mt-16 border-t border-white/[0.08] pt-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          More in{' '}
          <Link
            href={siloUrl(silo)}
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 transition-colors"
          >
            {label}
          </Link>
        </h2>
        <Link
          href={siloUrl(silo)}
          className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-emerald-400 transition-colors"
        >
          View cluster →
        </Link>
      </div>

      {related.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">
          <Link href={siloUrl(silo)} className="text-emerald-400 hover:underline">
            See all {label} guides
          </Link>{' '}
          while more are in the pipeline.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {related.map((post) => (
            <li
              key={post.slug}
              className="group rounded-xl border border-white/[0.08] bg-[#121215] p-5 transition-all hover:border-emerald-500/30 hover:bg-[#15151a]"
            >
              <h3 className="text-base font-bold leading-snug tracking-tight text-white">
                <Link
                  href={`/blog/${post.slug}`}
                  className="transition-colors group-hover:text-emerald-400"
                >
                  {post.title}
                </Link>
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400 line-clamp-2">
                {post.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
