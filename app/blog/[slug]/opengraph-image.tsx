import { ImageResponse } from 'next/og';
import { allPosts } from 'content-collections';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const DOMAIN = SITE_URL.replace(/^https?:\/\//, '');

export default async function PostOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = allPosts.find((p) => p.slug === slug);
  const rawTitle = post ? post.title : SITE_NAME;
  const clean = rawTitle.replace(/[<>&"]/g, '');
  const title = clean.length > 110 ? `${clean.slice(0, 110).trimEnd()}…` : clean;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          backgroundColor: '#0a0a0c',
          display: 'flex',
          flexDirection: 'column',
          padding: 80,
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{ width: 120, height: 6, backgroundColor: '#fe7141' }}
        />
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#ffffff',
            marginTop: 48,
            flex: 1,
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 4,
                backgroundColor: '#fe7141',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  backgroundColor: '#0a0a0c',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            <div
              style={{ fontSize: 30, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}
            >
              {SITE_NAME}
            </div>
          </div>
          <div style={{ fontSize: 24, color: '#82828e' }}>{DOMAIN}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
