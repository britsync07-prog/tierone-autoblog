import type { ReactNode } from 'react';

// Tinted callout box (D-07). Registered for MDX use:
// `<Callout variant="info" title="...">...</Callout>`.
const boxStyles = {
  info: 'border-sky-200 bg-sky-50',
  warning: 'border-amber-200 bg-amber-50',
  success: 'border-emerald-200 bg-emerald-50',
} as const;

const titleStyles = {
  info: 'text-sky-900',
  warning: 'text-amber-900',
  success: 'text-emerald-900',
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
      className={`my-6 rounded-lg border border-l-4 p-4 ${boxStyles[variant]}`}
    >
      <p className={`text-[14px] font-semibold ${titleStyles[variant]}`}>
        {title}
      </p>
      <div className="mt-1 text-[16px] leading-[1.5] text-[#171717]">
        {children}
      </div>
    </div>
  );
}
