import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@semse/ui", "@semse/schemas", "@semse/agents"],
  experimental: {
    webpackBuildWorker: false,
    useWasmBinary: true,
    nodeMiddleware: true,
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../..")
};

export default nextConfig;
