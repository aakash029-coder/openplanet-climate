import { NextRequest, NextResponse } from 'next/server';

const ENGINE_BASE = 'https://albus2903-openplanet-engine.hf.space';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const upstream = await fetch(
      `${ENGINE_BASE}/api/geocode-search?q=${encodeURIComponent(q.trim())}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'OpenPlanet-Frontend/2.0',
        },
        next: { revalidate: 300 },
      }
    );

    if (!upstream.ok) {
      return NextResponse.json({ results: [] }, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
