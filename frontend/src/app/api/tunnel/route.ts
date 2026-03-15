import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { target_url } = await req.json();
    
    if (!target_url) {
      return NextResponse.json({ error: 'No target URL provided' }, { status: 400 });
    }

    // Vercel server Open-Meteo se data mangega apne fresh IP ka use karke
    const response = await fetch(target_url, {
      headers: { 'User-Agent': 'OpenPlanet-Engine/1.0' }
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}