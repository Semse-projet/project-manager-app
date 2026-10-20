#!/usr/bin/env node
// Exports the real SEMSE palette (packages/design-tokens/src/colors.ts) into
// the token-file shape contrast.py reads, so the WCAG check runs against what
// web and mobile actually ship instead of a hand-copied JSON that drifts.
//
//   node --experimental-strip-types .claude/skills/semse-release-gate/scripts/semse-tokens.mjs --theme dark > /tmp/semse-dark.json
//   python3 .claude/skills/semse-release-gate/scripts/contrast.py /tmp/semse-dark.json
//
// Read-only: it never writes into the repo unless --out points there.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const COLORS_TS = new URL("../../../../packages/design-tokens/src/colors.ts", import.meta.url);

// White text on filled buttons: apps/web/app/globals.css `.btn-primary` and
// `.btn-accent` hard-code `color: #fff` instead of using a token.
export const ON_FILL = "#ffffff";

// Text/background pairs the web UI really uses. "ui" = borders and focus
// rings, which WCAG only asks 3:1 of.
export const PAIRS = [
  ["ink", "base"], ["ink", "surface"], ["ink", "raised"], ["ink", "overlay"],
  ["muted", "base"], ["muted", "surface"], ["muted", "raised"],
  ["faint", "base"], ["faint", "surface"],
  ["brand", "base"], ["brand", "surface"],
  ["accent", "base"], ["accent", "surface"],
  ["ok", "surface"], ["warn", "surface"], ["error", "surface"], ["info", "surface"],
  ["onFill", "brand"], ["onFill", "accent"],
  ["border2", "surface", "ui"],
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function toContrastTokens(palette, theme) {
  const color = { onFill: ON_FILL };
  for (const [name, value] of Object.entries(palette)) {
    // rgba() tints (brandDim, line...) are overlays, not text or surfaces.
    if (HEX.test(value)) color[name] = value;
  }
  return {
    _about: `SEMSE ${theme} palette exported from packages/design-tokens/src/colors.ts for contrast.py`,
    color,
    pairs: PAIRS,
  };
}

export async function loadPalettes() {
  const { darkColors, lightColors } = await import(COLORS_TS.href);
  return { dark: darkColors, light: lightColors };
}

async function main(argv) {
  const theme = argv[argv.indexOf("--theme") + 1] ?? "dark";
  const outIdx = argv.indexOf("--out");
  if (!argv.includes("--theme") || !["dark", "light"].includes(theme)) {
    console.error("usage: semse-tokens.mjs --theme dark|light [--out file.json]");
    return 2;
  }
  const palettes = await loadPalettes();
  const json = JSON.stringify(toContrastTokens(palettes[theme], theme), null, 2) + "\n";
  if (outIdx !== -1 && argv[outIdx + 1]) writeFileSync(argv[outIdx + 1], json);
  else process.stdout.write(json);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
