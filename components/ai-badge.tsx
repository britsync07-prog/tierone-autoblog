// Per-post AI-assistance disclosure badge (D-16). Visible on every post,
// linking to the editorial-process page.
export default function AiBadge({
  href = '/editorial-process',
}: {
  href?: string;
}) {
  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121215] px-3 py-1.5 text-[12.5px] text-zinc-400">
      <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
      </svg>
      <span>
        AI-assisted · reviewed against our{' '}
        <a
          href={href}
          className="font-medium text-emerald-400 underline underline-offset-2 transition-colors hover:text-emerald-300"
        >
          editorial process
        </a>
      </span>
    </div>
  );
}
