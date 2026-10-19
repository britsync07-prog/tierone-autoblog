import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

export interface NewsHeroImage {
  src: string;
  alt: string;
  localPath: string;
}

export interface ProcessThumbnailOptions {
  imageUrl?: string;
  sourceUrl?: string;
  slug: string;
  headline: string;
  outDir?: string;
  fetchFn?: typeof fetch;
}

/**
 * Probes the target news article URL to extract OpenGraph or Twitter preview image.
 */
export async function extractSourceOgImage(
  pageUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  if (!pageUrl || !pageUrl.startsWith('http')) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetchFn(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (Compatible; TierOneAutoBlog/1.0; +https://tierone-autoblog.pages.dev)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();

    // Check og:image or twitter:image
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    if (ogMatch && ogMatch[1]) {
      let foundUrl = ogMatch[1].trim();
      if (foundUrl.startsWith('//')) {
        foundUrl = 'https:' + foundUrl;
      } else if (foundUrl.startsWith('/') && pageUrl) {
        const parsedBase = new URL(pageUrl);
        foundUrl = `${parsedBase.origin}${foundUrl}`;
      }
      if (foundUrl.startsWith('http://') || foundUrl.startsWith('https://')) {
        return foundUrl;
      }
    }
  } catch {
    // Graceful fallback on timeout or fetch error
  }

  return null;
}

/**
 * Downloads the source/RSS thumbnail image, optimizes it via sharp into WebP (1280x720),
 * and persists it to public/images/{slug}/hero.webp.
 */
export async function downloadAndProcessNewsThumbnail(
  options: ProcessThumbnailOptions,
): Promise<NewsHeroImage | null> {
  const { slug, headline, outDir = resolve(process.cwd(), 'public', 'images'), fetchFn = fetch } = options;

  let targetImageUrl = options.imageUrl;

  // If no RSS image tag, attempt extraction from source URL
  if (!targetImageUrl && options.sourceUrl) {
    targetImageUrl = (await extractSourceOgImage(options.sourceUrl, fetchFn)) || undefined;
  }

  if (!targetImageUrl) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetchFn(targetImageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (Compatible; TierOneAutoBlog/1.0)',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    if (inputBuffer.length < 500) {
      return null; // Empty or invalid image response
    }

    // Process and optimize with sharp into modern WebP
    const webpBuffer = await sharp(inputBuffer)
      .resize({
        width: 1280,
        height: 720,
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    const destDir = join(outDir, slug);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    const localFilePath = join(destDir, 'hero.webp');
    writeFileSync(localFilePath, webpBuffer);

    const alt = `${headline} — editorial news overview`;

    return {
      src: `/images/${slug}/hero.webp`,
      alt: alt.length >= 10 ? alt : `${headline} editorial news`,
      localPath: localFilePath,
    };
  } catch (error) {
    console.warn(`[news-image] Failed to download or process thumbnail from ${targetImageUrl}:`, error);
    return null;
  }
}
