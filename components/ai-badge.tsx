// Per-post AI-assistance disclosure badge. Visible on every post,
// linking to the editorial-process page.
export default function AiBadge({
  href = '/editorial-process',
}: {
  href?: string;
}) {
  return (
    <div className="mt-4 inline-flex items-center gap-2 rounded-sm bg-[#f4f4f6] px-3.5 py-2 text-xs text-[#52525b]">
      <svg className="h-3.5 w-3.5 text-[#d92b21] shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
      </svg>
      <span>
        AI-assisted · reviewed against our{' '}
        <a
          href={href}
          className="font-medium text-[#09090b] underline underline-offset-2 decoration-[#d92b21] transition-colors hover:text-[#d92b21]"
        >
          editorial process
        </a>
      </span>
    </div>
  );
}
