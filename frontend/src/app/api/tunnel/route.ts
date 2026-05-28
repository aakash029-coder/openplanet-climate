import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/tunnel — Server-side proxy for Open-Meteo requests.
 * Routes requests through Vercel's server IP to avoid client-side CORS
 * and rate-limit restrictions on the Open-Meteo API.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { target_url?: string };
    const { target_url } = body;

    if (!target_url) {
      return NextResponse.json({ error: 'No target URL provided' }, { status: 400 });
    }

    const response = await fetch(target_url, {
      method: 'GET',
      headers: {
        'User-Agent': 'OpenPlanet-Engine/2.0 (Vercel Tunnel)',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    const textData = await response.text();
    return NextResponse.json(
      { error: 'Upstream returned non-JSON response', details: textData },
      { status: response.status },
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Tunnel error: ${message}` }, { status: 500 });
  }
}
