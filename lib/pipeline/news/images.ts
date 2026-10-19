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

export const EDITORIAL_FALLBACK_PHOTOS: Array<{ keywords: string[]; url: string; altPrefix: string }> = [
  {
    keywords: ['model', 'llm', 'gpt', 'claude', 'gemini', 'reasoning', 'anthropic', 'openai', 'deepseek'],
    url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Artificial intelligence neural network compute architecture',
  },
  {
    keywords: ['code', 'developer', 'coding', 'programming', 'github', 'copilot', 'cursor', 'software'],
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Software engineering development workstation with code terminal',
  },
  {
    keywords: ['chip', 'hardware', 'nvidia', 'gpu', 'semiconductor', 'processor', 'tpu', 'blackwell'],
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Semiconductor architecture and high performance GPU accelerator hardware',
  },
  {
    keywords: ['robot', 'robotics', 'agent', 'automation', 'drone', 'humanoid'],
    url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Intelligent autonomous robotics and automated systems technology',
  },
  {
    keywords: ['security', 'privacy', 'cyber', 'vulnerability', 'hacker', 'exploit'],
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Cybersecurity infrastructure telemetry and data protection shield',
  },
  {
    keywords: ['cloud', 'datacenter', 'server', 'infrastructure', 'scale', 'aws', 'azure'],
    url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Enterprise cloud datacenter infrastructure and high throughput servers',
  },
  {
    keywords: ['writing', 'author', 'content', 'copy', 'creative', 'prompt'],
    url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Digital editorial author workstation and generative copy production',
  },
  {
    keywords: ['image', 'art', 'design', 'generator', 'vision', 'midjourney', 'video'],
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280&q=80&auto=format&fit=crop',
    altPrefix: 'Creative digital design visuals and generative media production',
  },
];

export const DEFAULT_EDITORIAL_FALLBACK = {
  url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1280&q=80&auto=format&fit=crop',
  altPrefix: 'Enterprise technology intelligence and software systems',
};

export function getEditorialFallbackForStory(headline: string, slug: string): { url: string; altPrefix: string } {
  const combined = `${headline} ${slug}`.toLowerCase();
  for (const entry of EDITORIAL_FALLBACK_PHOTOS) {
    if (entry.keywords.some((kw) => combined.includes(kw))) {
      return entry;
    }
  }
  return DEFAULT_EDITORIAL_FALLBACK;
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

  // If still no image URL, fall back to curated high-resolution editorial photography matching topic
  let isFallback = false;
  let fallbackAltPrefix = '';
  if (!targetImageUrl) {
    const fallback = getEditorialFallbackForStory(headline, slug);
    targetImageUrl = fallback.url;
    fallbackAltPrefix = fallback.altPrefix;
    isFallback = true;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    let res = await fetchFn(targetImageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (Compatible; TierOneAutoBlog/1.0)',
      },
    });

    clearTimeout(timeout);

    // If source URL image fetch failed, attempt editorial fallback
    if (!res.ok && !isFallback) {
      const fallback = getEditorialFallbackForStory(headline, slug);
      targetImageUrl = fallback.url;
      fallbackAltPrefix = fallback.altPrefix;
      isFallback = true;
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 6000);
      res = await fetchFn(targetImageUrl, {
        signal: retryController.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (Compatible; TierOneAutoBlog/1.0)',
        },
      });
      clearTimeout(retryTimeout);
    }

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
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    const destDir = join(outDir, slug);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    const localFilePath = join(destDir, 'hero.webp');
    writeFileSync(localFilePath, webpBuffer);

    const alt = isFallback
      ? `${fallbackAltPrefix} — ${headline}`
      : `${headline} — editorial news overview`;

    return {
      src: `/images/${slug}/hero.webp`,
      alt: alt.length >= 10 ? alt : `${headline} editorial visual`,
      localPath: localFilePath,
    };
  } catch (error) {
    console.warn(`[news-image] Failed to download or process thumbnail from ${targetImageUrl}:`, error);
    return null;
  }
}
