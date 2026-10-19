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
      className="my-10 overflow-hidden rounded-md bg-[#141418]"
      data-comparison-table
    >
      {title ? (
        <figcaption className="bg-[#1c1c22] px-5 py-3 text-sm font-bold text-[#fe7141]">
          {title}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="bg-[#18181f]">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="px-5 py-3.5 font-semibold text-white"
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
                      ? 'bg-[#fe7141]/10 hover:bg-[#fe7141]/15'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {row.cells.map((cell, j) => (
                    <td
                      key={j}
                      className="px-5 py-3.5 align-top text-[#d1d1d6]"
                    >
                      {isBest && j === 0 ? (
                        <div className="flex items-center gap-2">
                          <span
                            aria-label="best pick"
                            className="inline-flex items-center justify-center rounded-sm bg-[#fe7141] px-2 py-0.5 text-xs font-bold text-black"
                          >
                            Top Pick
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
        <p className="bg-[#18181f] px-5 py-3 text-xs text-[#82828e]">
          {note}
        </p>
      ) : null}
    </figure>
  );
}
