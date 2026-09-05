/**
 * apps/web/app/globals.css defines --font-sans/--font-mono as Geist/Geist
 * Mono (web font, loaded via @import in that same file) but no explicit
 * font-size scale — the web app uses Tailwind's default type scale via
 * classes (text-sm, text-lg, etc.). This module gives React Native the
 * equivalent numeric scale directly, since RN has no utility classes.
 *
 * Font family names are aspirational: using them in a React Native
 * StyleSheet requires actually bundling Geist as a font asset (e.g. via
 * @expo-google-fonts/geist or a local .ttf + expo-font) — that's a
 * follow-up task, not something this token module can do on its own.
 */

export const fontFamily = {
  sans: "System",
  mono: "monospace",
} as const;

/** Same scale as Tailwind's default text-xs..text-4xl, in px. */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
