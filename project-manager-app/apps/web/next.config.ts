import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@semse/ui", "@semse/schemas", "@semse/agents"],
  experimental: {
    webpackBuildWorker: false,
    useWasmBinary: true,
    // @ts-expect-error — nodeMiddleware exists at runtime in Next.js 15 but types not yet updated
    nodeMiddleware: true,
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../..")
};

export default nextConfig;
