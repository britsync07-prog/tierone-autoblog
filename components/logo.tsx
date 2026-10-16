import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

// Minimal inline SVG mark + wordmark (D-02). Zero image requests:
// no <Image>, no SVG file, no external asset.
export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={SITE_NAME}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="20" height="20" rx="4" fill="#4f46e5" />
        <path
          d="M14 7l4.5 7-4.5 7-4.5-7 4.5-7z"
          fill="#ffffff"
        />
      </svg>
      <span className="text-[18px] font-semibold text-[#171717]">
        {SITE_NAME}
      </span>
    </Link>
  );
}
