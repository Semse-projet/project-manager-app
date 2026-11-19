import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const previewRoot = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(previewRoot, ".sources/apps/web");
const outDir = process.env.SEMSE_PREVIEW_OUT_DIR
  ? resolve(previewRoot, process.env.SEMSE_PREVIEW_OUT_DIR)
  : resolve(previewRoot, "dist");

export default defineConfig({
  base: process.env.SEMSE_PREVIEW_BASE ?? "./",
  plugins: [tailwindcss()],
  resolve: {
    alias: [
      { find: "next/dynamic", replacement: resolve(previewRoot, "src/next-dynamic.tsx") },
      { find: "@", replacement: sourceRoot },
    ],
  },
  esbuild: { jsx: "automatic" },
  build: { outDir, emptyOutDir: true, sourcemap: false },
});
