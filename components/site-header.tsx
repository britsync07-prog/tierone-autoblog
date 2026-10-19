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
    <header className="sticky top-0 z-40 bg-[#0a0a0c]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-4 sm:gap-6">
          <ul className="flex items-center gap-2 sm:gap-4">
            {NAV.map((item) => {
              const isNews = item.href === '/ai-news';
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium transition-colors ${
                      isNews
                        ? 'bg-[#fe7141] text-black font-semibold'
                        : 'text-[#d1d1d6] hover:bg-[#141418] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
