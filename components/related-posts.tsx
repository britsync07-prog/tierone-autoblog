import Link from 'next/link';
import { allPosts } from 'content-collections';

// Deterministic same-silo fallback (D-09-adjacent): up to 3 posts sharing the
// current post's silo tag. Hidden when nothing matches. The Phase-3 link-graph
// engine upgrades this slot without changing the contract.
export default function RelatedPosts({
  currentSlug,
  silo,
}: {
  currentSlug: string;
  silo: string;
}) {
  const related = allPosts
    .filter((post) => post.slug !== currentSlug && post.silo === silo)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <section aria-label="Related guides" className="mt-12">
      <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
        Related guides
      </h2>
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
    </section>
  );
}
