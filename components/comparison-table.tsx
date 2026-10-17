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
      className="my-6 overflow-hidden rounded-lg border border-slate-200"
      data-comparison-table
    >
      {title ? (
        <figcaption className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[12px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="border-b border-slate-200 bg-slate-50 px-4 py-2 font-semibold text-[#171717]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                // Rows are immutable frontmatter data: positional keys are
                // stable for server-only static renders.
                key={i}
                className={row.best === true ? 'bg-indigo-50' : undefined}
              >
                {row.cells.map((cell, j) => (
                  <td
                    key={j}
                    className="border-b border-slate-100 px-4 py-2 align-top text-slate-700"
                  >
                    {row.best === true && j === 0 ? (
                      // The best pick carries two independent signals — the
                      // indigo tint above and this star with its accessible
                      // label — so color and glyph are never the sole carrier.
                      <>
                        <span aria-label="best pick" className="mr-1">
                          ★
                        </span>
                        {cell}
                      </>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? (
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[12px] text-slate-500">
          {note}
        </p>
      ) : null}
    </figure>
  );
}
