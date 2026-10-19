// TL;DR answer box (D-06). Mandatory within the first 100 words of every
// post, rendered from the `tldr` frontmatter field.
export default function Tldr({
  title = 'Executive Summary & Key Takeaways',
  items,
}: {
  title?: string;
  items: string[];
}) {
  return (
    <aside
      aria-label="TL;DR summary"
      className="tldr-box my-8 overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/15 via-[#121215] to-[#101013] p-5 sm:p-6 shadow-xl shadow-emerald-950/10"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm-7-5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 013 10zm13 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0116 10z" clipRule="evenodd" />
          </svg>
        </span>
        <p className="text-[12.5px] font-bold uppercase tracking-wider text-emerald-400">
          {title}
        </p>
      </div>

      <ul className="mt-3.5 space-y-2.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 text-[15px] leading-relaxed text-zinc-200"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-emerald-400"
            >
              <circle cx="9" cy="9" r="8" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1" />
              <path
                d="M5.5 9.2l2.3 2.3 4.7-4.5"
                stroke="#10b981"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
