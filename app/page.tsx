import Link from 'next/link';
import { allPosts } from 'content-collections';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Latest-posts index (D-09). No silo assumptions, no images, no client JS.
// Posts come from the typed collection sorted newest-first.
export default function HomePage() {
  const posts = [...allPosts].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-[36px] font-semibold leading-[1.2] text-[#171717]">
        {SITE_NAME}
      </h1>
      <p className="mt-4 text-[16px] leading-[1.5] text-slate-600">
        {SITE_TAGLINE}
      </p>

      {posts.length === 0 ? (
        <section aria-label="Latest posts" className="mt-8">
          <h2 className="text-[24px] font-semibold text-[#171717]">
            No posts yet
          </h2>
          <p className="mt-2 text-[16px] text-slate-600">
            Fresh AI tool guides are on the way. Check back soon.
          </p>
        </section>
      ) : (
        <ul className="mt-8 grid gap-8">
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <h2 className="text-[20px] md:text-[24px] font-semibold leading-[1.2]">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-[#171717] hover:text-[#4f46e5]"
                  >
                    {post.title}
                  </Link>
                </h2>
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
    </main>
  );
}
