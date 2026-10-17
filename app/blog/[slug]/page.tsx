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
      <ol className="flex flex-wrap items-center gap-2 text-[14px] text-slate-600">
        <li>
          <a href="/" className="hover:text-[#4f46e5] hover:underline">
            Home
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <a href={siloHref} className="hover:text-[#4f46e5] hover:underline">
            {siloLabel}
          </a>
        </li>
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
      <ArticleJsonLd type="BlogPosting" {...buildArticleJsonLd(post, canonical)} />
      <BreadcrumbJsonLd
        {...buildBreadcrumbJsonLd([
          { name: 'Home', item: SITE_URL },
          { name: siloDef.label, item: `${SITE_URL}${siloHref}` },
          { name: post.title, item: canonical },
        ])}
      />
      {faqJsonLd ? <FAQJsonLd {...faqJsonLd} /> : null}
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        <ReadingProgress />
        <Breadcrumb
          siloLabel={siloDef.label}
          siloHref={siloHref}
          title={post.title}
        />
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
            {/* D-13/PIPE-05: pipeline-generated LCP hero. priority +
                fetchPriority="high" preloads it as the LCP candidate; the
                enforced frontmatter alt is the only alt source. Seeds (no
                hero art) render exactly as before — zero new markup. */}
            {post.heroImage ? (
              <Image
                src={post.heroImage.src}
                alt={post.heroImage.alt}
                width={1280}
                height={720}
                priority
                fetchPriority="high"
                sizes="(min-width: 768px) 42rem, 100vw"
                className="mt-4 rounded-lg"
              />
            ) : null}
            <AiBadge href="/editorial-process" />
            <Tldr items={[post.tldr]} />
            <TocInline headings={post.headings} />
            {/* D-14/PIPE-04: frontmatter comparison DATA renders immediately
                ABOVE the MDX body (Wirecutter early-table pattern). Posts
                without comparison frontmatter are rendered unchanged. */}
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
