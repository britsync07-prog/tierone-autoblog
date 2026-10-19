import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import AdSlot from '@/components/ad-slot';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

// Organization + WebSite structured data in a single sanitized block.
// Plausible snippet below is the ONLY third-party script in v1 (T-01-02).
function SiteJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        slogan: SITE_TAGLINE,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: 'en-US',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\u003c'),
      }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en-US">
      <body className="min-h-svh flex flex-col bg-[#0a0a0c] text-[#d1d1d6] antialiased selection:bg-[#fe7141] selection:text-black">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-[#fe7141] focus:px-4 focus:py-2 focus:text-black focus:font-semibold focus:outline-none"
        >
          Skip to content
        </a>
        <script
          defer
          data-domain={SITE_URL.replace(/^https?:\/\//, '')}
          src="https://plausible.io/js/script.js"
        />
        <SiteJsonLd />
        <SiteHeader />
        <div className="hidden md:block">
          <AdSlot id="header-leaderboard" width={728} height={90} />
        </div>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
