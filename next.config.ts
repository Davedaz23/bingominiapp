// next.config.js
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Keep server-side dynamic routing
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
