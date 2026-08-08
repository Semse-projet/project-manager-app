import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const mobilePort = Number(env.VITE_SEMSE_MOBILE_PORT || 4174);

  return {
    base: './',
    plugins: [inspectAttr(), react()],
    server: {
      host: "127.0.0.1",
      port: mobilePort,
    },
    preview: {
      host: "127.0.0.1",
      port: mobilePort,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            motion: ["framer-motion"],
            charts: ["recharts"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
