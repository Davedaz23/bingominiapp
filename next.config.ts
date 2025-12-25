import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NO output: 'export' here!
  output: 'standalone', // For Plesk deployment
  
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;