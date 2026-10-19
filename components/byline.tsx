// Real-author byline (D-12). Name links to the author page; dates render in
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
    <div className="mt-4 flex flex-wrap items-center gap-3 border-y border-white/[0.08] py-3 text-[13.5px] text-zinc-400">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#121215] text-[11px] font-bold text-white">
            {authorName.charAt(0)}
          </div>
        </div>
        <span>
          By{' '}
          <a
            href={`/authors/${authorSlug}`}
            className="font-semibold text-white transition-colors hover:text-emerald-400"
          >
            {authorName}
          </a>
        </span>
      </div>

      <span className="text-zinc-600" aria-hidden="true">·</span>

      <time dateTime={date} className="text-zinc-300">
        {formatDate(date)}
      </time>

      {updated !== date && (
        <>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <span className="text-emerald-400 font-medium">
            Updated {formatDate(updated)}
          </span>
        </>
      )}

      <span className="text-zinc-600" aria-hidden="true">·</span>

      <span className="inline-flex items-center gap-1 text-zinc-400">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
        </svg>
        {readingMinutes} min read
      </span>
    </div>
  );
}
