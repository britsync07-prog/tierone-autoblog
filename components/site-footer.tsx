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
    <footer className="bg-slate-50 border-t border-slate-200 mt-16">
      <div className="mx-auto max-w-5xl px-4 py-12 grid gap-8 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 text-[14px] text-slate-600">{SITE_TAGLINE}</p>
        </div>
        <nav aria-label="Site">
          <h2 className="text-[14px] font-semibold text-[#171717]">Site</h2>
          <ul className="mt-4 space-y-2">
            {SITE_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[14px] text-slate-600 hover:text-[#171717]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <nav aria-label="Legal">
            <h2 className="text-[14px] font-semibold text-[#171717]">Legal</h2>
            <ul className="mt-4 space-y-2">
              {LEGAL_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[14px] text-slate-600 hover:text-[#171717]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-4 text-[14px] text-slate-600">
            By <Link href={`/authors/${AUTHOR_SLUG}`} className="hover:text-[#171717]">{AUTHOR_NAME}</Link>
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-5xl px-4 py-6 text-[14px] text-slate-600">
          © {year} {SITE_NAME} · {domain}
        </p>
      </div>
    </footer>
  );
}
