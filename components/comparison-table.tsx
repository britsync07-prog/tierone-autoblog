type ComparisonColumn = { id: string; label: string };
type ComparisonRow = { cells: string[]; best?: boolean };

export type ComparisonTableProps = {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  title?: string;
  note?: string;
};

// data-comparison-table is the deterministic build-verification hook: the
// prerendered seed probe asserts its presence in served HTML.
export default function ComparisonTable({
  columns,
  rows,
  title,
  note,
}: ComparisonTableProps) {
  return (
    <figure
      className="my-10 overflow-hidden rounded-sm bg-[#f4f4f6]"
      data-comparison-table
    >
      {title ? (
        <figcaption className="bg-[#e4e4e7] px-5 py-3 text-sm font-bold text-[#d92b21]">
          {title}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="bg-[#ebebee]">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="px-5 py-3.5 font-semibold text-[#09090b]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isBest = row.best === true;
              return (
                <tr
                  key={i}
                  className={`transition-colors ${
                    isBest
                      ? 'bg-[#d92b21]/10 hover:bg-[#d92b21]/15'
                      : 'hover:bg-black/[0.02]'
                  }`}
                >
                  {row.cells.map((cell, j) => (
                    <td
                      key={j}
                      className="px-5 py-3.5 align-top text-[#27272a]"
                    >
                      {isBest && j === 0 ? (
                        <div className="flex items-center gap-2">
                          <span
                            aria-label="best pick"
                            className="inline-flex items-center justify-center rounded-sm bg-[#d92b21] px-2 py-0.5 text-xs font-bold text-white"
                          >
                            Top Pick
                          </span>
                          <span className="font-semibold text-[#09090b]">{cell}</span>
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
        <p className="bg-[#ebebee] px-5 py-3 text-xs text-[#52525b]">
          {note}
        </p>
      ) : null}
    </figure>
  );
}
