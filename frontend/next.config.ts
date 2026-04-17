import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aapka existing option
  reactStrictMode: false, 

  // ── THE ACTUAL SILVER BULLET FOR DECK.GL ──
  // Ye Next.js ko bolta hai ki in modules ko build ke waqt sahi se link kare
  transpilePackages: [
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/geo-layers',
    '@deck.gl/react',
    'h3-js'
  ],

  // ESM support fix for charts
  serverExternalPackages: ['recharts'],
};

export default nextConfig;