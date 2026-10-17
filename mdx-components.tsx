import type { ComponentProps } from 'react';
import Image from 'next/image';
import Callout from '@/components/callout';
import Tldr from '@/components/tldr';

// Global MDX component map (D-07). Heading ids come from rehype-slug and the
// visible `#` anchors from rehype-autolink-headings (configured in
// content-collections.ts) — the h2/h3 entries below only pass the id through
// plus layout classes, so anchors are never rendered twice. Code blocks arrive
// Shiki-highlighted from rehype-pretty-code (server-render only, T-02-01);
// the copy button is wired by a static delegated script on the post template,
// keeping ReadingProgress the sole `use client` island. Post bodies are
// rendered via MDXContent — never dangerouslySetInnerHTML (T-02-01).
export function useMDXComponents() {
  return {
    h2: ({ id, children }: ComponentProps<'h2'>) => (
      <h2 id={id} className="group scroll-mt-24">
        {children}
      </h2>
    ),
    h3: ({ id, children }: ComponentProps<'h3'>) => (
      <h3 id={id} className="group scroll-mt-24">
        {children}
      </h3>
    ),
    a: ({ href, children, className, ...rest }: ComponentProps<'a'>) => {
      // Heading anchors from rehype-autolink-headings carry
      // `class="anchor-link"` + aria-label — render them untouched so the
      // hover-reveal styling and accessible name survive MDX mapping.
      if (className === 'anchor-link') {
        return (
          <a href={href} className={className} {...rest}>
            {children}
          </a>
        );
      }
      const external =
        typeof href === 'string' && /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          {...(external ? { target: '_blank' as const, rel: 'noopener' } : {})}
          className="text-[#4f46e5] underline underline-offset-2 decoration-indigo-200 hover:decoration-[#4f46e5]"
        >
          {children}
        </a>
      );
    },
    table: ({ children }: ComponentProps<'table'>) => (
      <div className="table-scroll overflow-x-auto my-6">
        <table className="w-full text-left text-[14px]">{children}</table>
      </div>
    ),
    pre: ({ children, ...rest }: ComponentProps<'pre'>) => (
      <div
        data-code-block
        className="my-6 overflow-hidden rounded-lg border border-slate-200"
      >
        <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
          <span className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
            Code
          </span>
          <button
            type="button"
            data-copy-button
            aria-label="Copy code"
            className="rounded px-2 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-200 hover:text-[#171717]"
          >
            Copy
          </button>
        </div>
        <pre {...rest} className="overflow-x-auto p-4 text-[14px]">
          {children}
        </pre>
      </div>
    ),
    // D-13/PIPE-05: in-article MDX images render through next/image at the
    // in-article raster dims (1080x608), lazy by default — never LCP
    // candidates (only the page hero carries priority). Alt text is
    // pipeline-enforced (>=10 chars at the draft gate); an MDX image with
    // an empty alt fails the build instead of silently shipping an unnamed
    // image (a11y + image-SEO quality floor).
    img: ({
      src,
      alt,
      title,
      // native-img width/height are dropped from the spread — the in-article
      // raster dims (1080x608) are the D-13 contract and never overridden
      width: _w,
      height: _h,
      ...rest
    }: ComponentProps<'img'>) => {
      if (!alt) {
        throw new Error(
          `MDX image without alt text: ${String(src)} — alt is pipeline-enforced (D-13/PIPE-05)`,
        );
      }
      if (typeof src !== 'string') {
        return <img src={src} alt={alt} title={title} {...rest} />;
      }
      return (
        <Image
          src={src}
          alt={alt}
          title={title}
          width={1080}
          height={608}
          sizes="(min-width: 768px) 42rem, 100vw"
          className="rounded-lg"
          {...rest}
        />
      );
    },
    Callout,
    Tldr,
  };
}

export type MdxComponentMap = ReturnType<typeof useMDXComponents>;
