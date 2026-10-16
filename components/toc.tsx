// Table of contents (D-05). Headings are extracted at build time from
// rehype-slug ids and passed as a prop — no client-side DOM scraping.
// Desktop: sticky sidebar. Mobile: inline <details> block.
export type TocHeading = { id: string; text: string; level: 2 | 3 };

function TocList({ headings }: { headings: TocHeading[] }) {
  return (
    <ul className="space-y-2">
      {headings.map((h) => (
        <li key={h.id} className={h.level === 3 ? 'ml-4' : undefined}>
          <a
            href={`#${h.id}`}
            className="text-[14px] leading-[1.5] text-slate-600 hover:text-[#4f46e5]"
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Toc({ headings }: { headings: TocHeading[] }) {
  if (headings.length === 0) return null;
  return (
    <nav
      aria-label="Table of contents"
      className="toc-sidebar hidden lg:block sticky top-24"
    >
      <p className="text-[14px] font-semibold text-[#171717]">On this page</p>
      <div className="mt-3">
        <TocList headings={headings} />
      </div>
    </nav>
  );
}

export function TocInline({ headings }: { headings: TocHeading[] }) {
  if (headings.length === 0) return null;
  return (
    <details className="lg:hidden rounded-lg border border-slate-200 bg-slate-50 px-4">
      <summary className="cursor-pointer py-3 text-[14px] font-semibold text-[#171717]">
        On this page
      </summary>
      <div className="pb-4">
        <TocList headings={headings} />
      </div>
    </details>
  );
}
