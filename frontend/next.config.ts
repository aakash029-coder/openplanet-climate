import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,

  // ── THE FIX: Put EVERYTHING in transpilePackages only ──
  // Recharts ko compile hone do, taaki wo browser aur server dono pe chale.
  transpilePackages: [
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/geo-layers',
    '@deck.gl/react',
    'h3-js',
    'recharts' 
  ],

  // serverExternalPackages ki ab zaroorat nahi hai, isey delete kar do ya khali rakho
  // serverExternalPackages: [] 
};

export default nextConfig;