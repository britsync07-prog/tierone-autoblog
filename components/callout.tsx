import type { ReactNode } from 'react';

// Tinted callout box. Registered for MDX use:
// `<Callout variant="info" title="...">...</Callout>`.
// Formatted per taste-skill: pure solid tone step, no shadows, no micro-caps.
const boxStyles = {
  info: 'bg-[#141824] text-[#d1d5db] border-l-4 border-sky-400',
  warning: 'bg-[#241a14] text-[#d1d5db] border-l-4 border-amber-400',
  success: 'bg-[#18181f] text-[#d1d5db] border-l-4 border-[#fe7141]',
} as const;

const titleStyles = {
  info: 'text-sky-400',
  warning: 'text-amber-400',
  success: 'text-[#fe7141]',
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
      <div className="mt-2 text-base leading-relaxed text-[#d1d1d6]">
        {children}
      </div>
    </div>
  );
}
