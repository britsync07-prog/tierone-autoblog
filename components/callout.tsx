import type { ReactNode } from 'react';

// Tinted callout box. Registered for MDX use:
// `<Callout variant="info" title="...">...</Callout>`.
// Formatted per taste-skill: pure solid tone step, no shadows, no micro-caps.
const boxStyles = {
  info: 'bg-[#f0f4f8] text-[#1e293b] border-l-4 border-[#0284c7]',
  warning: 'bg-[#fef9ee] text-[#451a03] border-l-4 border-[#d97706]',
  success: 'bg-[#f4f4f6] text-[#09090b] border-l-4 border-[#d92b21]',
} as const;

const titleStyles = {
  info: 'text-[#0284c7]',
  warning: 'text-[#b45309]',
  success: 'text-[#d92b21]',
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
      className={`my-8 rounded-sm p-5 ${boxStyles[variant]}`}
    >
      <p className={`text-sm font-bold ${titleStyles[variant]}`}>
        {title}
      </p>
      <div className="mt-2 text-base leading-relaxed text-[#374151]">
        {children}
      </div>
    </div>
  );
}
