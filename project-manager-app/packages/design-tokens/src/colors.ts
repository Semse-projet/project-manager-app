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
  /** Background for filled buttons with white text (`.btn-primary`); 4.5:1 with #fff. */
  brandFill: string;
  accent: string;
  accentDim: string;
  /** Background for filled buttons with white text (`.btn-accent`); 4.5:1 with #fff. */
  accentFill: string;
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
  okBright: string;
  warn: string;
  error: string;
  info: string;
  violet: string;
};

export const darkColors: ColorPalette = {
  brand: "#3b82f6",
  brandDim: "rgba(59,130,246,.12)",
  brandBright: "#60a5fa",
  brandFill: "#2563eb",
  accent: "#ff6a00",
  accentDim: "rgba(255,106,0,.12)",
  accentFill: "#c2410c",
  base: "#050810",
  surface: "#0c1017",
  raised: "#111827",
  overlay: "#1a2333",
  border: "#1f2d3d",
  border2: "#56667c",
  line: "rgba(255,255,255,.06)",
  ink: "#f1f5f9",
  muted: "#94a3b8",
  faint: "#728298",
  ok: "#10b981",
  okBright: "#34d399",
  warn: "#f59e0b",
  error: "#ef4444",
  info: "#06b6d4",
  violet: "#8b5cf6",
};

export const lightColors: ColorPalette = {
  brand: "#2563eb",
  brandDim: "rgba(37,99,235,.10)",
  brandBright: "#1d4ed8",
  brandFill: "#2563eb",
  accent: "#c2410c",
  accentDim: "rgba(194,65,12,.10)",
  accentFill: "#c2410c",
  base: "#f4f7fb",
  surface: "#ffffff",
  raised: "#eef3f9",
  overlay: "#e6edf7",
  border: "#d7e0ea",
  border2: "#7e8da1",
  line: "rgba(15,23,42,.08)",
  ink: "#0f172a",
  muted: "#475569",
  faint: "#617087",
  ok: "#047857",
  okBright: "#065f46",
  warn: "#b45309",
  error: "#dc2626",
  info: "#0e7490",
  violet: "#7c3aed",
};
