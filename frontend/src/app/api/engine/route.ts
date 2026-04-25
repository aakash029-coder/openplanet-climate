import { NextRequest, NextResponse } from 'next/server';

const ENGINE_BASE = 'https://albus2903-openplanet-engine.hf.space';

const ALLOWED = ['/api/predict', '/api/climate-risk', '/api/research-analysis'];

export async function POST(req: NextRequest) {
  try {
    const { endpoint, payload } = await req.json();

    if (!ALLOWED.includes(endpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const response = await fetch(`${ENGINE_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; OpenPlanet/1.0)',
        'Origin': 'https://www.openplanetrisk.com',
        'Referer': 'https://www.openplanetrisk.com/',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Engine ${response.status}: ${errorText.slice(0, 200)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Proxy failed' },
      { status: 500 }
    );
  }
}