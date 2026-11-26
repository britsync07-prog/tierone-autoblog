import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import AdSlot from '@/components/ad-slot';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

// Ads are optional. Keeping them off until there is meaningful traffic avoids
// third-party script cost and intrusive ad-network behavior on every page.
const adsEnabled = process.env.NEXT_PUBLIC_ENABLE_ADS === 'true';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

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
  other: {
    ...(adsEnabled ? { 'google-adsense-account': 'ca-pub-1216169179358368' } : {}),
  },
};

// Organization + WebSite structured data in a single sanitized block.
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
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/favicon.svg`,
        },
        sameAs: [
          'https://www.linkedin.com/in/musfiqur-rahman-saimon-a5994b3aa',
          'https://github.com/britsync07-prog',
        ],
        knowsAbout: [
          'Artificial Intelligence',
          'Software Engineering',
          'Autonomous Agents',
          'Large Language Models',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: 'en-US',
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/#topics`,
          },
          'query-input': 'required name=search_term_string',
        },
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
      <head>
        <meta name="theme-color" content="#d92b21" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://plausible.io" />
        <link rel="alternate" type="text/markdown" href="/llms.txt" title="LLMs Context" />
        <link rel="alternate" type="text/markdown" href="/llms-full.txt" title="LLMs Full Knowledge Base" />
        <link rel="mcp-actions" href="/mcp-actions.json" />
        {adsEnabled ? (
          <>
            <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
            <script
              async
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1216169179358368"
              crossOrigin="anonymous"
            />
          </>
        ) : null}
      </head>
      <body className="min-h-svh flex flex-col bg-white text-[#27272a] antialiased selection:bg-[#d92b21] selection:text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-[#d92b21] focus:px-4 focus:py-2 focus:text-white focus:font-semibold focus:outline-none"
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
        {adsEnabled ? (
          <div className="hidden md:block">
            <AdSlot id="header-leaderboard" width={728} height={90} />
          </div>
        ) : null}
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
