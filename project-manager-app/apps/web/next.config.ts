import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' http: https: ws: wss:",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "same-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), serial=()",
  },
];

// Sense Vision (spec: vision/sense-vision-field-library) is the one page that
// opens the camera via getUserMedia, which camera=() blocks outright. Next
// applies the LAST matching header with the same key, so this narrower entry
// overrides only camera — same-origin only, every other feature unchanged.
const senseVisionPermissionsPolicy = {
  key: "Permissions-Policy",
  value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), serial=()",
};

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@semse/ui", "@semse/schemas", "@semse/agents"],
  experimental: {
    webpackBuildWorker: false,
    useWasmBinary: true,
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/worker/sense-vision",
        headers: [senseVisionPermissionsPolicy],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/como-funciona",
        destination: "/?semse_usage_guide=1",
      },
    ];
  },
};

export default nextConfig;
