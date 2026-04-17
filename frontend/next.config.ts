import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: [
    '@deck.gl/core',
    '@deck.gl/layers',     // <--- Ye ab mandatory hai
    '@deck.gl/geo-layers',
    '@deck.gl/react',
    'h3-js',
    'recharts' 
  ],
};

export default nextConfig;