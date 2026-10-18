import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest | Request): Promise<Response> {
  let requestedKey: string | null = null;
  if ('nextUrl' in request && request.nextUrl) {
    requestedKey = request.nextUrl.searchParams.get('key');
  } else {
    try {
      const url = new URL(request.url);
      requestedKey = url.searchParams.get('key');
    } catch {
      requestedKey = null;
    }
  }

  const configuredKey = process.env.INDEXNOW_KEY;

  if (!configuredKey || !requestedKey || requestedKey !== configuredKey) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return new NextResponse(configuredKey, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
