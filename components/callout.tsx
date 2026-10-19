import type { ReactNode } from 'react';

// Tinted callout box (D-07). Registered for MDX use:
// `<Callout variant="info" title="...">...</Callout>`.
const boxStyles = {
  info: 'border-sky-500/30 bg-sky-950/20 text-sky-200',
  warning: 'border-amber-500/30 bg-amber-950/20 text-amber-200',
  success: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200',
} as const;

const titleStyles = {
  info: 'text-sky-400',
  warning: 'text-amber-400',
  success: 'text-emerald-400',
} as const;

export default function Callout({
  variant,
  title,
  children,
}: {
  variant: 'info' | 'warning' | 'success';
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role="note"
      className={`my-6 rounded-xl border border-l-4 p-4.5 sm:p-5 shadow-lg ${boxStyles[variant]}`}
    >
      <p className={`text-[13px] font-bold uppercase tracking-wider ${titleStyles[variant]}`}>
        {title}
      </p>
      <div className="mt-2 text-[15px] leading-relaxed text-zinc-300">
        {children}
      </div>
    </div>
  );
}
