import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const target_url = body.target_url;
    
    if (!target_url) {
      return NextResponse.json({ error: 'No target URL provided' }, { status: 400 });
    }

    // console.log(`[Tunnel] Fetching data for: ${target_url}`);

    // Vercel server Open-Meteo se data mangega apne fresh IP ka use karke
    const response = await fetch(target_url, {
      method: 'GET',
      headers: { 
        'User-Agent': 'OpenPlanet-Engine/2.0 (Vercel Tunnel)',
        'Accept': 'application/json'
      },
      cache: 'no-store' // 🔥 CRITICAL: Next.js ko bolo data cache NA kare!
    });
    
    // SAFE PARSING: Check if response is actually JSON before parsing
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } else {
        const textData = await response.text();
        return NextResponse.json(
            { error: 'Open-Meteo returned non-JSON data (possibly a block page)', details: textData }, 
            { status: response.status }
        );
    }

  } catch (err: any) {
    return NextResponse.json({ error: `Tunnel execution failed: ${err.message}` }, { status: 500 });
  }
}