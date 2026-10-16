// Per-post AI-assistance disclosure badge (D-16). Visible on every post,
// linking to the editorial-process page.
export default function AiBadge({
  href = '/editorial-process',
}: {
  href?: string;
}) {
  return (
    <p className="mt-3 text-[14px] leading-[1.5] text-slate-600">
      AI-assisted · reviewed against our{' '}
      <a
        href={href}
        className="text-[#4f46e5] underline underline-offset-2 hover:decoration-2"
      >
        editorial process
      </a>
    </p>
  );
}
