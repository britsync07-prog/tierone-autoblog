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
      className="tldr-box my-10 rounded-sm bg-[#18181f] p-6"
    >
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-1 bg-[#fe7141]" />
        <p className="text-sm font-bold text-white">
          {title}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 text-base leading-relaxed text-[#d1d1d6]"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fe7141]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
