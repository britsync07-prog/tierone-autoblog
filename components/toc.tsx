// Table of contents (D-05). Headings are extracted at build time from
// rehype-slug ids and passed as a prop — no client-side DOM scraping.
// Desktop: sticky sidebar. Mobile: inline <details> block.
export type TocHeading = { id: string; text: string; level: 2 | 3 };

function TocList({ headings }: { headings: TocHeading[] }) {
  return (
    <ul className="space-y-1.5">
      {headings.map((h) => (
        <li key={h.id} className={h.level === 3 ? 'ml-3' : undefined}>
          <a
            href={`#${h.id}`}
            className="block text-[13px] leading-snug text-zinc-400 transition-colors hover:text-emerald-400"
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
      className="toc-sidebar hidden lg:block sticky top-24 border-l border-white/[0.08] pl-5 max-h-[calc(100vh-8rem)] overflow-y-auto"
    >
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Contents
      </p>
      <div className="mt-3">
        <TocList headings={headings} />
      </div>
    </nav>
  );
}

export function TocInline({ headings }: { headings: TocHeading[] }) {
  if (headings.length === 0) return null;
  return (
    <details className="my-6 lg:hidden rounded-xl border border-white/[0.08] bg-[#121215] px-4 transition-colors">
      <summary className="cursor-pointer py-3 text-[13.5px] font-semibold text-zinc-200 hover:text-emerald-400 focus:outline-none">
        Table of Contents ({headings.length} sections)
      </summary>
      <div className="border-t border-white/[0.06] pt-3 pb-4">
        <TocList headings={headings} />
      </div>
    </details>
  );
}
