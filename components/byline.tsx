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
    <p className="mt-3 text-[14px] leading-[1.5] text-slate-600">
      By{' '}
      <a
        href={`/authors/${authorSlug}`}
        className="font-medium text-[#171717] underline underline-offset-2 hover:text-[#4f46e5]"
      >
        {authorName}
      </a>{' '}
      · {formatDate(date)}
      {updated !== date ? ` · Updated ${formatDate(updated)}` : ''} ·{' '}
      {readingMinutes} min read
    </p>
  );
}
