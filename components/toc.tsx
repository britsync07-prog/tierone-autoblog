// Table of contents. Headings are extracted at build time from
// rehype-slug ids and passed as a prop — no client-side DOM scraping.
export type TocHeading = { id: string; text: string; level: 2 | 3 };

function TocList({ headings }: { headings: TocHeading[] }) {
  return (
    <ul className="space-y-2">
      {headings.map((h) => (
        <li key={h.id} className={h.level === 3 ? 'ml-3' : undefined}>
          <a
            href={`#${h.id}`}
            className="block text-[13.5px] leading-snug text-[#a1a1aa] transition-colors hover:text-[#fe7141]"
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
      className="toc-sidebar hidden lg:block sticky top-24 bg-[#141418] p-5 rounded-sm max-h-[calc(100svh-8rem)] overflow-y-auto"
    >
      <p className="flex items-center gap-2 text-xs font-bold text-white">
        <span className="h-2 w-2 rounded-full bg-[#fe7141]" />
        Article Contents
      </p>
      <div className="mt-3.5">
        <TocList headings={headings} />
      </div>
    </nav>
  );
}

export function TocInline({ headings }: { headings: TocHeading[] }) {
  if (headings.length === 0) return null;
  return (
    <details className="my-8 lg:hidden rounded-sm bg-[#141418] p-4">
      <summary className="cursor-pointer font-semibold text-white hover:text-[#fe7141] focus:outline-none">
        Table of Contents ({headings.length} sections)
      </summary>
      <div className="mt-4 pt-3">
        <TocList headings={headings} />
      </div>
    </details>
  );
}
