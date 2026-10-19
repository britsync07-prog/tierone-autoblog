// D-14 / PIPE-04 render half: comparison tables are frontmatter DATA
// (zod-validated by lib/pipeline/draft-schema.ts) rendered by this shared
// server component. Zero client JS, no next/image, plain React-escaped
// strings in cells only (T-03-10: text injection is worst-case visual noise
// in one post, never an execution path — no dangerouslySetInnerHTML).
//
// Visual system note: mirrors the GFM table idiom from mdx-components.tsx
// (w-full text-[14px] table inside an overflow-x-auto scroller, slate
// borders, rounded-lg) so frontmatter tables and body GFM tables read as
// one editorial surface.
type ComparisonColumn = { id: string; label: string };
type ComparisonRow = { cells: string[]; best?: boolean };

export type ComparisonTableProps = {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  title?: string;
  note?: string;
};

// data-comparison-table is the deterministic build-verification hook: the
// prerendered seed probe (03-04 task 3) asserts its presence in served HTML.
export default function ComparisonTable({
  columns,
  rows,
  title,
  note,
}: ComparisonTableProps) {
  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border border-white/[0.08] bg-[#121215] shadow-xl"
      data-comparison-table
    >
      {title ? (
        <figcaption className="flex items-center gap-2 border-b border-white/[0.08] bg-[#16161b] px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-emerald-400">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3.5A1.5 1.5 0 014.5 2h9A1.5 1.5 0 0115 3.5v13a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 013 16.5v-13zm2 0v13h9v-13h-9z" clipRule="evenodd" />
          </svg>
          {title}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-white/[0.08] bg-[#141418]">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="px-4 py-3 font-semibold text-white"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row, i) => {
              const isBest = row.best === true;
              return (
                <tr
                  key={i}
                  className={`transition-colors ${
                    isBest
                      ? 'bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {row.cells.map((cell, j) => (
                    <td
                      key={j}
                      className="px-4 py-3 align-top text-zinc-300"
                    >
                      {isBest && j === 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            aria-label="best pick"
                            className="inline-flex items-center justify-center rounded bg-amber-400/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 shadow-sm"
                          >
                            ★ Top Pick
                          </span>
                          <span className="font-semibold text-white">{cell}</span>
                        </div>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {note ? (
        <p className="border-t border-white/[0.06] bg-[#141418] px-4 py-2.5 text-[12px] text-zinc-400">
          {note}
        </p>
      ) : null}
    </figure>
  );
}
