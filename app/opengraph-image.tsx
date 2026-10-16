import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

// Site fallback title card (D-21): same brand geometry as the per-post card,
// drawing the tagline instead of a post title. System fonts only.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const DOMAIN = SITE_URL.replace(/^https?:\/\//, '');

export default function SiteOpengraphImage() {
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
          {SITE_TAGLINE}
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
