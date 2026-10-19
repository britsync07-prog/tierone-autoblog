// Real-author byline. Name links to the author page; dates render in
// en-US with a fixed UTC timezone so builds are deterministic.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function Byline({
  authorName,
  authorSlug,
  date,
  updated,
  readingMinutes,
}: {
  authorName: string;
  authorSlug: string;
  date: string;
  updated: string;
  readingMinutes: number;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-sm bg-[#f4f4f6] px-4 py-3 text-[14px] text-[#52525b]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#d92b21] text-[12px] font-bold text-white">
          {authorName.charAt(0)}
        </div>
        <span>
          By{' '}
          <a
            href={`/authors/${authorSlug}`}
            className="font-semibold text-[#09090b] transition-colors hover:text-[#d92b21]"
          >
            {authorName}
          </a>
        </span>
      </div>

      <span className="text-[#a1a1aa]" aria-hidden="true">·</span>

      <time dateTime={date} className="tabular-nums text-[#27272a]">
        {formatDate(date)}
      </time>

      {updated !== date && (
        <>
          <span className="text-[#a1a1aa]" aria-hidden="true">·</span>
          <span className="text-[#d92b21] tabular-nums font-medium">
            Updated {formatDate(updated)}
          </span>
        </>
      )}

      <span className="text-[#a1a1aa]" aria-hidden="true">·</span>

      <span className="inline-flex items-center gap-1.5 tabular-nums text-[#52525b]">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
            clipRule="evenodd"
          />
        </svg>
        {readingMinutes} min read
      </span>
    </div>
  );
}
