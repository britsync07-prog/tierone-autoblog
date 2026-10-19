import type { ComponentProps, ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ArticleJsonLd, BreadcrumbJsonLd, FAQJsonLd } from 'next-seo';
import { allPosts } from 'content-collections';
import { MDXContent } from '@content-collections/mdx/react';
import {
  AUTHOR_NAME,
  AUTHOR_SLUG,
  SITE_URL,
} from '@/lib/site';
import { getSilo, siloUrl } from '@/lib/silos';
import { canonicalFor, localeAlternates } from '@/lib/seo/canonical';
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  getArticleSchemaType,
} from '@/lib/seo/jsonld';
import { useMDXComponents } from '@/mdx-components';
import AdSlot from '@/components/ad-slot';
import AiBadge from '@/components/ai-badge';
import Byline from '@/components/byline';
import RelatedPosts from '@/components/related-posts';
import ComparisonTable from '@/components/comparison-table';
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
  const canonical = canonicalFor(`/blog/${slug}`);
  const ogImage = `/blog/${slug}/opengraph-image`;
  return {
    title: post.title,
    description: post.description,
    alternates: { ...localeAlternates(canonical) },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: 'article',
      images: post.heroImage
        ? [
            {
              url: `${SITE_URL}${post.heroImage.src}`,
              width: 1280,
              height: 720,
              alt: post.heroImage.alt,
            },
            {
              url: `${SITE_URL}${post.heroImage.src.replace(/hero\.(?:avif|webp)$/, 'og.jpg')}`,
              width: 1200,
              height: 630,
              alt: post.heroImage.alt,
            },
          ]
        : [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [
        post.heroImage
          ? `${SITE_URL}${post.heroImage.src.replace(/hero\.(?:avif|webp)$/, 'og.jpg')}`
          : ogImage,
      ],
    },
  };
}

function Breadcrumb({
  siloLabel,
  siloHref,
  title,
}: {
  siloLabel: string;
  siloHref: string;
  title: string;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#52525b]">
        <li>
          <a href="/" className="transition-colors hover:text-[#d92b21]">
            Home
          </a>
        </li>
        <li aria-hidden="true" className="text-[#a1a1aa]">/</li>
        <li>
          <a href={siloHref} className="transition-colors hover:text-[#d92b21]">
            {siloLabel}
          </a>
        </li>
        <li aria-hidden="true" className="text-[#a1a1aa]">/</li>
        <li aria-current="page" className="max-w-[320px] truncate text-[#09090b] sm:max-w-md">
          {title}
        </li>
      </ol>
    </nav>
  );
}

function FaqSection({ faq }: { faq: { q: string; a: string }[] }) {
  if (!faq || faq.length === 0) return null;
  return (
    <section aria-label="Frequently asked questions" className="mt-20 pt-8">
      <div className="flex items-center gap-3">
        <span className="h-4 w-1 bg-[#d92b21]" />
        <h2 className="text-xl font-bold tracking-tight text-[#09090b] sm:text-2xl">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="mt-8 space-y-6">
        {faq.map((item) => (
          <div
            key={item.q}
            className="rounded-sm bg-[#f4f4f6] p-6 sm:p-7"
          >
            <h3 className="text-base sm:text-lg font-bold leading-snug tracking-tight text-[#09090b]">
              {item.q}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-[#27272a]">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const COPY_SCRIPT = `(function(){document.addEventListener('click',function(e){var t=e.target;var b=t&&t.closest?t.closest('[data-copy-button]'):null;if(!b)return;var box=b.closest('[data-code-block]');var code=box?box.querySelector('code'):null;if(!code)return;var text=code.innerText||code.textContent||'';var label=b.textContent;var done=function(){b.textContent='Copied';setTimeout(function(){b.textContent=label;},1500);};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,function(){done();});}else{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(err){}document.body.removeChild(ta);done();}});})();`;

function ArticleBody({ code }: { code: string }) {
  const base = useMDXComponents();
  let h2Count = 0;
  const h2 = ({ id, children }: ComponentProps<'h2'>): ReactNode => {
    h2Count += 1;
    return (
      <>
        <h2 id={id} className="group scroll-mt-24 text-2xl font-bold tracking-tight text-[#09090b]">
          {children}
        </h2>
        {h2Count === 2 ? (
          <AdSlot id="in-article" width={336} height={280} />
        ) : null}
      </>
    );
  };
  return (
    <div className="prose max-w-none">
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

  const siloDef = getSilo(post.silo);
  if (!siloDef) notFound();

  const canonical = canonicalFor(`/blog/${slug}`);
  const siloHref = siloUrl(siloDef.slug);
  const faqJsonLd = buildFaqJsonLd(post.faq);

  return (
    <>
      <ArticleJsonLd type={getArticleSchemaType(post.silo)} {...buildArticleJsonLd(post, canonical)} />
      <BreadcrumbJsonLd
        {...buildBreadcrumbJsonLd([
          { name: 'Home', item: SITE_URL },
          { name: siloDef.label, item: `${SITE_URL}${siloHref}` },
          { name: post.title, item: canonical },
        ])}
      />
      {faqJsonLd ? <FAQJsonLd {...faqJsonLd} /> : null}
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <ReadingProgress />
        <Breadcrumb
          siloLabel={siloDef.label}
          siloHref={siloHref}
          title={post.title}
        />
        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,68ch)_240px]">
          <article className="mx-auto w-full max-w-[68ch]">
            <h1 className="text-3xl font-bold leading-[1.12] tracking-tight text-[#09090b] sm:text-4xl lg:text-[42px]">
              {post.title}
            </h1>
            <Byline
              authorName={AUTHOR_NAME}
              authorSlug={AUTHOR_SLUG}
              date={post.publishedAt}
              updated={post.updatedAt}
              readingMinutes={post.readingMinutes}
            />
            {post.heroImage ? (
              <div className="mt-8 overflow-hidden rounded-sm">
                <Image
                  src={post.heroImage.src}
                  alt={post.heroImage.alt}
                  width={1280}
                  height={720}
                  priority
                  unoptimized
                  fetchPriority="high"
                  sizes="(min-width: 768px) 45rem, 100vw"
                  className="w-full object-cover"
                />
              </div>
            ) : null}
            <div className="mt-4">
              <AiBadge href="/editorial-process" />
            </div>
            <Tldr items={[post.tldr]} />
            <TocInline headings={post.headings} />
            {post.comparison && <ComparisonTable {...post.comparison} />}
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
