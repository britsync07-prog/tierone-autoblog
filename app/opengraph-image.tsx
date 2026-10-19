import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

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
          style={{ width: 120, height: 6, backgroundColor: '#d92b21' }}
        />
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#09090b',
            marginTop: 48,
            flex: 1,
            letterSpacing: '-0.03em',
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
                width: 44,
                height: 44,
                borderRadius: 4,
                backgroundColor: '#d92b21',
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
                  backgroundColor: '#ffffff',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            <div
              style={{ fontSize: 30, fontWeight: 700, color: '#09090b', letterSpacing: '-0.02em' }}
            >
              {SITE_NAME}
            </div>
          </div>
          <div style={{ fontSize: 24, color: '#52525b' }}>{DOMAIN}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
