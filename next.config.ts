import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development checks
  reactStrictMode: true,

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Enable compression
  compress: true,

  // Optimize production builds
  poweredByHeader: false,

  // Experimental optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
