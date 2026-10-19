import Link from 'next/link';
import { allPosts } from 'content-collections';
import { getSilo, siloUrl, type SiloSlug } from '@/lib/silos';

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
    <section aria-label="Related guides" className="mt-20 pt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-[#09090b] sm:text-2xl">
          More in{' '}
          <Link
            href={siloUrl(silo)}
            className="text-[#d92b21] hover:text-[#09090b] underline underline-offset-4 decoration-[#d92b21] transition-colors"
          >
            {label}
          </Link>
        </h2>
        <Link
          href={siloUrl(silo)}
          className="text-sm font-semibold text-[#52525b] hover:text-[#d92b21] transition-colors"
        >
          View all in {label} →
        </Link>
      </div>

      {related.length === 0 ? (
        <p className="mt-4 text-sm text-[#52525b]">
          <Link href={siloUrl(silo)} className="text-[#d92b21] hover:underline">
            See all {label} guides
          </Link>{' '}
          while more are in the pipeline.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {related.map((post) => (
            <li
              key={post.slug}
              className="group rounded-sm bg-[#f4f4f6] p-5 transition-colors hover:bg-[#ebebee]"
            >
              <h3 className="text-base font-bold leading-snug tracking-tight text-[#09090b]">
                <Link
                  href={`/blog/${post.slug}`}
                  className="transition-colors group-hover:text-[#d92b21]"
                >
                  {post.title}
                </Link>
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#52525b] line-clamp-2">
                {post.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
