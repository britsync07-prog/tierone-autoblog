import { createHash } from 'node:crypto';
import type { RawNewsItem } from './types';

/**
 * Decodes XML/HTML entities, unwraps CDATA sections, strips HTML tags,
 * and normalizes whitespace.
 */
export function cleanCdataAndEntities(str: string): string {
  if (!str) return '';

  let text = str;

  // Unwrap CDATA blocks: <![CDATA[...]]>
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

  // Strip any lingering CDATA markers
  text = text.replace(/<!\[CDATA\[|\]\]>/gi, '');

  // Strip HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common named XML/HTML entities
  const namedEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#039;': "'",
    '&#8216;': "'",
    '&#8217;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&nbsp;': ' ',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  for (const [entity, replacement] of Object.entries(namedEntities)) {
    text = text.split(entity).join(replacement);
  }

  // Decode decimal entities: &#123;
  text = text.replace(/&#(\d+);/g, (_, dec) => {
    try {
      return String.fromCharCode(Number(dec));
    } catch {
      return '';
    }
  });

  // Decode hex entities: &#x1f;
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return '';
    }
  });

  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parses RSS 2.0 (<item>) or Atom 1.0 (<entry>) XML text into RawNewsItem[].
 * Does not depend on native compilation or heavy dependencies.
 */
export function parseRssOrAtomXml(xmlText: string, sourceName: string): RawNewsItem[] {
  if (!xmlText || typeof xmlText !== 'string') {
    return [];
  }

  const items: RawNewsItem[] = [];

  // Determine if feed has <item> (RSS) or <entry> (Atom)
  const isAtom = /<entry[\s>]/i.test(xmlText) && !/<item[\s>]/i.test(xmlText);

  if (isAtom) {
    // Atom 1.0 feed
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(xmlText)) !== null) {
      const block = match[1];

      // Title
      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const rawTitle = titleMatch ? titleMatch[1] : '';
      const title = cleanCdataAndEntities(rawTitle);

      // Link: Atom links can be <link href="..."/> or <link>...</link>
      let link = '';
      const linkHrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
      if (linkHrefMatch) {
        link = linkHrefMatch[1].trim();
      } else {
        const linkTagMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        if (linkTagMatch) {
          link = cleanCdataAndEntities(linkTagMatch[1]);
        }
      }

      // Publication Date: <published> or <updated>
      const dateMatch =
        block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
        block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
      const rawDate = dateMatch ? cleanCdataAndEntities(dateMatch[1]) : '';

      // Summary or Content
      const summaryMatch =
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
        block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
      const rawSummary = summaryMatch ? summaryMatch[1] : '';
      const summary = cleanCdataAndEntities(rawSummary).slice(0, 500);

      // Author: <author><name>...</name></author>
      const authorMatch = block.match(/<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);
      const author = authorMatch ? cleanCdataAndEntities(authorMatch[1]) : undefined;

      if (!title || !link) {
        continue;
      }

      const parsedTimestamp = Date.parse(rawDate);
      if (Number.isNaN(parsedTimestamp)) {
        continue;
      }

      const id = createHash('sha256').update(link).digest('hex').slice(0, 16);

      items.push({
        id,
        title,
        link,
        pubDate: new Date(parsedTimestamp).toISOString(),
        source: sourceName,
        summary,
        author: author || undefined,
      });
    }
  } else {
    // RSS 2.0 feed
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const block = match[1];

      // Title
      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const rawTitle = titleMatch ? titleMatch[1] : '';
      const title = cleanCdataAndEntities(rawTitle);

      // Link: <link>...</link> or sometimes <link href="..."/>
      let link = '';
      const linkTagMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      if (linkTagMatch) {
        link = cleanCdataAndEntities(linkTagMatch[1]);
      } else {
        const linkHrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
        if (linkHrefMatch) {
          link = linkHrefMatch[1].trim();
        }
      }

      // Publication Date: <pubDate> or <dc:date>
      const dateMatch =
        block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
        block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
      const rawDate = dateMatch ? cleanCdataAndEntities(dateMatch[1]) : '';

      // Summary: <description> or <content:encoded>
      const descMatch =
        block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
        block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
      const rawSummary = descMatch ? descMatch[1] : '';
      const summary = cleanCdataAndEntities(rawSummary).slice(0, 500);

      // Author: <author> or <dc:creator>
      const authorMatch =
        block.match(/<author[^>]*>([\s\S]*?)<\/author>/i) ||
        block.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      const author = authorMatch ? cleanCdataAndEntities(authorMatch[1]) : undefined;

      if (!title || !link) {
        continue;
      }

      const parsedTimestamp = Date.parse(rawDate);
      if (Number.isNaN(parsedTimestamp)) {
        continue;
      }

      const id = createHash('sha256').update(link).digest('hex').slice(0, 16);

      items.push({
        id,
        title,
        link,
        pubDate: new Date(parsedTimestamp).toISOString(),
        source: sourceName,
        summary,
        author: author || undefined,
      });
    }
  }

  return items;
}

// Convenient alias matching both plan and task naming
export const parseXmlFeed = parseRssOrAtomXml;
