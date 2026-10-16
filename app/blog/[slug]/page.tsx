import type { ComponentProps, ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allPosts } from 'content-collections';
import { MDXContent } from '@content-collections/mdx/react';
import {
  AUTHOR_NAME,
  AUTHOR_SLUG,
  SITE_URL,
} from '@/lib/site';
import { useMDXComponents } from '@/mdx-components';
import AdSlot from '@/components/ad-slot';
import AiBadge from '@/components/ai-badge';
import Byline from '@/components/byline';
import RelatedPosts from '@/components/related-posts';
import Tldr from '@/components/tldr';
import { Toc, TocInline } from '@/components/toc';
import ReadingProgress from '@/components/reading-progress';

function findPost(slug: string) {
  return allPosts.find((post) => post.slug === slug);
}

export async function generateStaticParams() {
  return allPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) return {};
  const canonical = `${SITE_URL}/blog/${slug}`;
  const ogImage = `/blog/${slug}/opengraph-image`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  };
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-[14px] text-slate-600">
        <li>
          <a href="/" className="hover:text-[#4f46e5] hover:underline">
            Home
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li>Blog</li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="text-[#171717]">
          {title}
        </li>
      </ol>
    </nav>
  );
}

function FaqSection({ faq }: { faq: { q: string; a: string }[] }) {
  return (
    <section aria-label="Frequently asked questions" className="mt-12">
      <h2 className="text-[24px] font-semibold leading-[1.2] text-[#171717]">
        Frequently asked questions
      </h2>
      <div className="mt-4 space-y-6">
        {faq.map((item) => (
          <div key={item.q}>
            <h3 className="text-[20px] font-semibold leading-[1.2] text-[#171717]">
              {item.q}
            </h3>
            <p className="mt-2 text-[16px] leading-[1.5] text-[#171717]">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Static copy-button wiring for Shiki-highlighted code blocks. This constant
// string carries zero post data (no injection vector); a single delegated
// listener serves every `[data-copy-button]` on the page. Keeps
// ReadingProgress the sole client island (D-08).
const COPY_SCRIPT = `(function(){document.addEventListener('click',function(e){var t=e.target;var b=t&&t.closest?t.closest('[data-copy-button]'):null;if(!b)return;var box=b.closest('[data-code-block]');var code=box?box.querySelector('code'):null;if(!code)return;var text=code.innerText||code.textContent||'';var label=b.textContent;var done=function(){b.textContent='Copied';setTimeout(function(){b.textContent=label;},1500);};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,function(){done();});}else{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(err){}document.body.removeChild(ta);done();}});})();`;

function ArticleBody({ code }: { code: string }) {
  // Renders the MDX body, reserving the invisible in-article ad slot right
  // after the 2nd H2 (D-11). The counter is per-render (request-scoped).
  const base = useMDXComponents();
  let h2Count = 0;
  const h2 = ({ id, children }: ComponentProps<'h2'>): ReactNode => {
    h2Count += 1;
    return (
      <>
        <h2 id={id} className="group scroll-mt-24">
          {children}
        </h2>
        {h2Count === 2 ? (
          <AdSlot id="in-article" width={336} height={280} />
        ) : null}
      </>
    );
  };
  return (
    <div className="prose prose-slate max-w-none">
      <MDXContent code={code} components={{ ...base, h2 }} />
    </div>
  );
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) notFound();

  return (
    <>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        <ReadingProgress />
        <Breadcrumb title={post.title} />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,65ch)_220px]">
          <article className="mx-auto w-full max-w-[65ch]">
            <h1 className="text-[30px] font-semibold leading-[1.2] text-[#171717]">
              {post.title}
            </h1>
            <Byline
              authorName={AUTHOR_NAME}
              authorSlug={AUTHOR_SLUG}
              date={post.publishedAt}
              updated={post.updatedAt}
              readingMinutes={post.readingMinutes}
            />
            <AiBadge href="/editorial-process" />
            <Tldr items={[post.tldr]} />
            <TocInline headings={post.headings} />
            <ArticleBody code={post.mdx} />
            <FaqSection faq={post.faq} />
            <RelatedPosts currentSlug={post.slug} silo={post.silo} />
          </article>
          <Toc headings={post.headings} />
        </div>
      </main>
      <script dangerouslySetInnerHTML={{ __html: COPY_SCRIPT }} />
    </>
  );
}
