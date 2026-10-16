// Canonical + hreflang derivation — single source for SEO-03 / GEO-01 / GEO-03.
// Every route MUST import canonicalFor() and localeAlternates() from here —
// never hardcode the domain (T-01-03 single-source grep gate: the domain
// literal lives only in lib/site.ts).
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

/** Absolute self-referencing canonical for an app path (e.g. `/blog/x`). */
export function canonicalFor(path: string): string {
  return `${SITE_URL}${path}`;
}

type Alternates = NonNullable<Metadata['alternates']>;

/**
 * Single-locale launch alternates fragment (GEO-03, research Corrected
 * Decision): self-referencing canonical plus en-US + x-default pointing at
 * that same canonical. Spread into `generateMetadata` return:
 * `return { alternates: { ...localeAlternates(canonical) }, ... }`.
 */
export function localeAlternates(canonical: string): Alternates {
  return {
    canonical,
    languages: { 'en-US': canonical, 'x-default': canonical },
  };
}
