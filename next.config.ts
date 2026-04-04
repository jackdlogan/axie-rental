import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.axieinfinity.com",
      },
      {
        protocol: "https",
        hostname: "assets.axieinfinity.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.axieinfinity.com",
      },
    ],
  },
};

export default nextConfig;
