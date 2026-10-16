// TL;DR answer box (D-06). Mandatory within the first 100 words of every
// post, rendered from the `tldr` frontmatter field.
export default function Tldr({
  title = 'TL;DR',
  items,
}: {
  title?: string;
  items: string[];
}) {
  return (
    <aside
      aria-label="TL;DR summary"
      className="tldr-box my-6 rounded-lg border border-indigo-200 border-l-4 bg-indigo-50 p-4"
    >
      <p className="text-[14px] font-semibold text-[#171717]">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex gap-2 text-[16px] leading-[1.5] text-[#171717]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="mt-1 shrink-0"
            >
              <path
                d="M3 8.5l3.2 3.2L13 5"
                stroke="#4f46e5"
                strokeWidth="2"
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
