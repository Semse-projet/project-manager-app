/**
 * Transcribed by hand from apps/web/app/globals.css (the `@theme` block for
 * dark, `:root[data-theme="light"]` for light). Web consumes these as CSS
 * custom properties / Tailwind utilities; React Native has no CSS vars, so
 * this package is the single source both sides read from — if the web
 * palette changes, update it here too, not just in globals.css.
 */

export type ColorPalette = {
  brand: string;
  brandDim: string;
  brandBright: string;
  accent: string;
  accentDim: string;
  base: string;
  surface: string;
  raised: string;
  overlay: string;
  border: string;
  border2: string;
  line: string;
  ink: string;
  muted: string;
  faint: string;
  ok: string;
  warn: string;
  error: string;
  info: string;
  violet: string;
};

export const darkColors: ColorPalette = {
  brand: "#3b82f6",
  brandDim: "rgba(59,130,246,.12)",
  brandBright: "#60a5fa",
  accent: "#ff6a00",
  accentDim: "rgba(255,106,0,.12)",
  base: "#050810",
  surface: "#0c1017",
  raised: "#111827",
  overlay: "#1a2333",
  border: "#1f2d3d",
  border2: "#273548",
  line: "rgba(255,255,255,.06)",
  ink: "#f1f5f9",
  muted: "#94a3b8",
  faint: "#4b6280",
  ok: "#10b981",
  warn: "#f59e0b",
  error: "#ef4444",
  info: "#06b6d4",
  violet: "#8b5cf6",
};

export const lightColors: ColorPalette = {
  brand: "#2563eb",
  brandDim: "rgba(37,99,235,.10)",
  brandBright: "#1d4ed8",
  accent: "#ea580c",
  accentDim: "rgba(234,88,12,.10)",
  base: "#f4f7fb",
  surface: "#ffffff",
  raised: "#eef3f9",
  overlay: "#e6edf7",
  border: "#d7e0ea",
  border2: "#c4d0de",
  line: "rgba(15,23,42,.08)",
  ink: "#0f172a",
  muted: "#475569",
  faint: "#64748b",
  ok: "#059669",
  warn: "#d97706",
  error: "#dc2626",
  info: "#0891b2",
  violet: "#7c3aed",
};
