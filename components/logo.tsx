import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

// Taste-skill: Sharp, solid typographic mark + wordmark.
// No gradients, no glows, no shadows at rest. Pure geometry & high-contrast type.
export default function Logo() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
      aria-label={SITE_NAME}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#d92b21] text-white">
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M9 2L16 16H2L9 2Z"
            fill="currentColor"
          />
          <circle cx="9" cy="11.5" r="1.75" fill="#ffffff" />
        </svg>
      </div>
      <span className="text-[19px] font-bold tracking-[-0.04em] text-[#09090b]">
        {SITE_NAME}
      </span>
    </Link>
  );
}
