import Link from 'next/link';
import Logo from '@/components/logo';
import {
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  AUTHOR_NAME,
  AUTHOR_SLUG,
} from '@/lib/site';

const SITE_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Editorial process', href: '/editorial-process' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export default function SiteFooter() {
  // Fixed year per UI-SPEC copy contract (avoids prerender dynamic-time bailout).
  const year = 2026;
  const domain = SITE_URL.replace(/^https?:\/\//, '');
  return (
    <footer className="mt-24 border-t border-white/[0.08] bg-[#0c0c0e] text-zinc-400">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-zinc-400">
              {SITE_TAGLINE}. Rigorously evaluated guides and daily breaking intelligence engineered for builders in the US, UK, Canada, and Australia.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[12px] font-medium tracking-wide text-zinc-400">
                Autonomous Pipeline Active · Daily Updates
              </span>
            </div>
          </div>

          <nav aria-label="Site">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-200">Publication</h2>
            <ul className="mt-4 space-y-2.5">
              {SITE_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[14px] text-zinc-400 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <nav aria-label="Legal">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-200">Standards & Legal</h2>
              <ul className="mt-4 space-y-2.5">
                {LEGAL_LINKS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-[14px] text-zinc-400 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="mt-4 text-[13px] text-zinc-400">
              Publisher:{' '}
              <Link href={`/authors/${AUTHOR_SLUG}`} className="font-medium text-zinc-300 underline underline-offset-2 hover:text-white">
                {AUTHOR_NAME}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#09090b]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
          <p className="text-[13px] text-zinc-400">
            © {year} {SITE_NAME} · {domain}
          </p>
          <p className="text-[12px] text-zinc-400">
            Built with Next.js 16 App Router · Edge-optimized on Cloudflare Pages
          </p>
        </div>
      </div>
    </footer>
  );
}
