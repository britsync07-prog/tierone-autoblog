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
    // GEO-01/GEO-03 (single-locale): self-referencing canonical + en-US and
    // x-default pointing at it — derived only via lib/seo/canonical.
    alternates: { ...localeAlternates(canonical) },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: 'article',
      // D-13/PIPE-05: hero posts advertise the generated art itself — the
      // site-absolute 1280x720 AVIF first, then the SAME-art 1200x630 og.jpg
      // crop (derived from the frontmatter hero src — note the basename
      // change, hero.avif -> og.jpg is not an extension swap). Seeds keep
      // the Phase-1 @vercel/og fallback shape byte-identical.
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
      // Hero posts tweet the universal raster og.jpg crop (AVIF-gap safe);
      // seeds keep the @vercel/og route image unchanged.
      images: [
        post.heroImage
          ? `${SITE_URL}${post.heroImage.src.replace(/hero\.(?:avif|webp)$/, 'og.jpg')}`
          : ogImage,
      ],
    },
  };
}

// D-06 silo crumb: Home / {Silo} / Title — the middle node links to the silo
// landing. The BreadcrumbList JSON-LD below mirrors this exact trail from
// the same post object (schema-mirror rule: no SEO string rendered twice
// from two sources).
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
      <ol className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-zinc-400">
        <li>
          <a href="/" className="transition-colors hover:text-emerald-400">
            Home
          </a>
        </li>
        <li aria-hidden="true" className="text-zinc-600">/</li>
        <li>
          <a href={siloHref} className="transition-colors hover:text-emerald-400">
            {siloLabel}
          </a>
        </li>
        <li aria-hidden="true" className="text-zinc-600">/</li>
        <li aria-current="page" className="max-w-[320px] truncate text-zinc-200 sm:max-w-md">
          {title}
        </li>
      </ol>
    </nav>
  );
}

function FaqSection({ faq }: { faq: { q: string; a: string }[] }) {
  return (
    <section aria-label="Frequently asked questions" className="mt-16 border-t border-white/[0.08] pt-12">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 10-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </span>
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="mt-6 space-y-4">
        {faq.map((item) => (
          <div
            key={item.q}
            className="rounded-xl border border-white/[0.08] bg-[#121215] p-5 sm:p-6 transition-colors hover:border-white/[0.14]"
          >
            <h3 className="text-base sm:text-lg font-bold leading-snug tracking-tight text-white">
              {item.q}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
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
        <h2 id={id} className="group scroll-mt-24 text-2xl font-bold tracking-tight text-white">
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
  // T-02-02 posture: enum-validated posts always resolve their silo, but the
  // lookup is guarded so a future taxonomy drift fails closed, not open.
  const siloDef = getSilo(post.silo);
  if (!siloDef) notFound();

  // SEO-02/GEO-01 structured data + head links, all single-sourced from the
  // same `post` object that renders the visible crumb/FAQ (mirror by
  // construction). Builders strip `<` (T-02-01) and next-seo v7 components
  // serialize + escape the JSON.
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
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ReadingProgress />
        <Breadcrumb
          siloLabel={siloDef.label}
          siloHref={siloHref}
          title={post.title}
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,68ch)_240px]">
          <article className="mx-auto w-full max-w-[68ch]">
            <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[40px]">
              {post.title}
            </h1>
            <Byline
              authorName={AUTHOR_NAME}
              authorSlug={AUTHOR_SLUG}
              date={post.publishedAt}
              updated={post.updatedAt}
              readingMinutes={post.readingMinutes}
            />
            {/* D-13/PIPE-05: pipeline-generated LCP hero. */}
            {post.heroImage ? (
              <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl">
                <Image
                  src={post.heroImage.src}
                  alt={post.heroImage.alt}
                  width={1280}
                  height={720}
                  priority
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
            {/* D-14/PIPE-04: frontmatter comparison DATA renders immediately ABOVE MDX */}
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
