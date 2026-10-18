import Link from 'next/link';
import Logo from '@/components/logo';

const NAV = [
  { label: 'AI News', href: '/ai-news' },
  { label: 'About', href: '/about' },
  { label: 'Editorial process', href: '/editorial-process' },
  { label: 'Contact', href: '/contact' },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
        <Logo />
        <nav aria-label="Primary">
          <ul className="flex items-center gap-6">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[14px] text-slate-600 hover:text-[#171717] py-3 inline-block"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
