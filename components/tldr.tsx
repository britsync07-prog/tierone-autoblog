// TL;DR answer box. Mandatory within the first 100 words of every
// post, rendered from the `tldr` frontmatter field.
// Formatted according to taste-skill: pure solid tone step, no gradients, no shadows.
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
      className="tldr-box my-10 rounded-sm bg-[#f4f4f6] p-6"
    >
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-1 bg-[#d92b21]" />
        <p className="text-sm font-bold text-[#09090b]">
          {title}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 text-base leading-relaxed text-[#27272a]"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d92b21]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
