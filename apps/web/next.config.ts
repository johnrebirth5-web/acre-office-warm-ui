import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@acre/backoffice", "@acre/ui"],
  webpack: (config, { dev }) => {
    if (dev) {
      // pdfjs-dist breaks under webpack eval-based source maps in local dev.
      config.devtool = "source-map";
    }

    return config;
  },
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url))
  }
};

export default nextConfig;
