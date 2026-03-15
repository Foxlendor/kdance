import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mediapipe/pose", "@tensorflow/tfjs-node"],
  webpack: (config: any) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@mediapipe/pose": path.resolve(__dirname, "src/mock-mediapipe-pose.ts"),
    };
    return config;
  },
  // Use turbopack config at top level (not under experimental)
  turbopack: {
    resolveAlias: {
      "@mediapipe/pose": "./src/mock-mediapipe-pose.ts",
    },
  },
};

export default nextConfig;
