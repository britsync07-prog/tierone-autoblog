import { ImageResponse } from 'next/og';
import { allPosts } from 'content-collections';
import { SITE_NAME, SITE_URL } from '@/lib/site';

// Brand title card (D-21): light editorial background, post title +
// geometric mark. Titles are author-controlled frontmatter — truncated to 110
// chars and stripped of markup before drawing (T-02-02). System fonts only:
// no remote fetch at image-render time.
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
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          padding: 80,
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{ width: '100%', height: 8, backgroundColor: '#4f46e5' }}
        />
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.2,
            color: '#171717',
            marginTop: 48,
            flex: 1,
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
                width: 48,
                height: 48,
                borderRadius: 10,
                backgroundColor: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: '#ffffff',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            <div
              style={{ fontSize: 32, fontWeight: 600, color: '#171717' }}
            >
              {SITE_NAME}
            </div>
          </div>
          <div style={{ fontSize: 28, color: '#64748b' }}>{DOMAIN}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
