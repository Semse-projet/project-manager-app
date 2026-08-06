/**
 * apps/web/app/globals.css doesn't define a custom spacing scale — the web
 * app relies on Tailwind's default 4px-step scale via utility classes
 * (p-1, gap-2, etc.) and the `--radius-*` custom properties it does define
 * explicitly. This module gives React Native the same two scales as plain
 * numbers, since RN StyleSheet has no utility classes to fall back on.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
} as const;

/** Transcribed from globals.css's --radius-* custom properties. */
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;
