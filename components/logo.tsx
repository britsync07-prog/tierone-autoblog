import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

// Minimal inline SVG mark + wordmark (D-02). Zero image requests:
// no <Image>, no SVG file, no external asset.
export default function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 transition-opacity hover:opacity-95" aria-label={SITE_NAME}>
      <div className="relative flex items-center justify-center">
        <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-sm transition-all group-hover:from-emerald-500/40 group-hover:to-teal-500/40" />
        <svg
          width="30"
          height="30"
          viewBox="0 0 30 30"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="relative drop-shadow"
        >
          <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="inner-grad" x1="8" y1="8" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#a7f3d0" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="26" height="26" rx="7" fill="#121215" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <rect x="4" y="4" width="22" height="22" rx="5" fill="url(#logo-grad)" fillOpacity="0.15" />
          <path
            d="M15 7L21.5 15L15 23L8.5 15L15 7Z"
            fill="url(#inner-grad)"
          />
          <circle cx="15" cy="15" r="2.2" fill="#10b981" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="text-[17px] font-bold tracking-tight text-white transition-colors group-hover:text-emerald-300">
          {SITE_NAME}
        </span>
      </div>
    </Link>
  );
}
