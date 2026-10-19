import Link from 'next/link';
import {
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  AUTHOR_NAME,
  AUTHOR_SLUG,
} from '@/lib/site';

const PUBLICATION_LINKS = [
  { label: 'AI News', href: '/ai-news' },
  { label: 'AI Coding', href: '/ai-coding' },
  { label: 'AI Writing', href: '/ai-writing' },
  { label: 'About the Journal', href: '/about' },
  { label: 'Editorial Process', href: '/editorial-process' },
  { label: 'Contact Desk', href: '/contact' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
];

export default function SiteFooter() {
  const year = 2026;
  const domain = SITE_URL.replace(/^https?:\/\//, '');

  return (
    <footer className="mt-32 bg-[#09090b] text-[#f4f4f5]">
      {/* Taste-skill Footer Blueprint: Inverted architectural wordmark */}
      <div className="overflow-hidden bg-[#000000] px-4 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-[clamp(2.5rem,8vw,7rem)] font-bold tracking-[-0.05em] leading-[0.85] text-[#27272a] select-none">
            {SITE_NAME.toUpperCase()}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-white">
              {SITE_NAME}
            </h2>
            <p className="max-w-md text-base leading-relaxed text-[#a1a1aa]">
              {SITE_TAGLINE}. Independent technical journalism, comprehensive tool benchmarks, and breaking engineering dispatches.
            </p>
            <p className="text-sm text-[#71717a]">
              Published by{' '}
              <Link
                href={`/authors/${AUTHOR_SLUG}`}
                className="font-medium text-white underline underline-offset-4 decoration-[#d92b21]"
              >
                {AUTHOR_NAME}
              </Link>
            </p>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-white">
              Publication
            </h3>
            <ul className="mt-4 space-y-2.5">
              {PUBLICATION_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[#a1a1aa] transition-colors hover:text-[#d92b21]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-white">
              Standards & Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              {LEGAL_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[#a1a1aa] transition-colors hover:text-[#d92b21]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 pt-8 text-xs tabular-nums text-[#71717a] sm:flex-row sm:items-center">
          <p>
            © {year} {SITE_NAME} · {domain} · Tier-1 Edition (US, UK, CA, AU)
          </p>
          <a
            href="#main-content"
            className="text-white hover:text-[#d92b21] transition-colors"
          >
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
