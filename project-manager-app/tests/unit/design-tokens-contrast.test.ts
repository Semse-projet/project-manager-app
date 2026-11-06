/**
 * WCAG 2.2 AA for the SEMSE palette, computed from packages/design-tokens/src/colors.ts,
 * plus a sync check against apps/web/app/globals.css (nothing else keeps them aligned).
 * Pairs mirror .claude/skills/semse-release-gate/scripts/semse-tokens.mjs, with buttons
 * measured on the background they actually use (brandFill/accentFill).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { darkColors, lightColors, type ColorPalette } from "../../packages/design-tokens/src/colors.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(path.join(root, "apps/web/app/globals.css"), "utf8");

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Key = keyof ColorPalette | "onFill";
const PAIRS: [Key, keyof ColorPalette, number][] = [
  ["ink", "base", 4.5], ["ink", "surface", 4.5], ["ink", "raised", 4.5], ["ink", "overlay", 4.5],
  ["muted", "base", 4.5], ["muted", "surface", 4.5], ["muted", "raised", 4.5],
  ["faint", "base", 4.5], ["faint", "surface", 4.5], ["faint", "raised", 4.5],
  ["brand", "base", 4.5], ["brand", "surface", 4.5],
  ["accent", "base", 4.5], ["accent", "surface", 4.5],
  ["ok", "surface", 4.5], ["warn", "surface", 4.5], ["error", "surface", 4.5], ["info", "surface", 4.5],
  ["onFill", "brandFill", 4.5], ["onFill", "accentFill", 4.5],
  ["border2", "surface", 3], ["border2", "raised", 3],
];

for (const [theme, palette] of [["dark", darkColors], ["light", lightColors]] as const) {
  test(`${theme} palette meets WCAG AA on every measured pair`, () => {
    const failures = PAIRS.flatMap(([fg, bg, need]) => {
      const ratio = contrast(fg === "onFill" ? "#ffffff" : palette[fg], palette[bg]);
      return ratio >= need ? [] : [`${fg} on ${bg}: ${ratio.toFixed(2)} < ${need}`];
    });
    assert.deepEqual(failures, []);
  });
}

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block must exist`);
  return css.slice(start, css.indexOf("\n}", start));
}

function cssVar(source: string, name: string): string | undefined {
  return source.match(new RegExp(`\\n\\s*${name}:\\s*([^;]+);`))?.[1].trim().toLowerCase();
}

// globals.css name → colors.ts field, for the tokens this palette fix touches.
const SYNCED: [string, keyof ColorPalette][] = [
  ["--faint", "faint"], ["--border-2", "border2"], ["--brand-fill", "brandFill"], ["--accent", "accent"],
  ["--accent-dim", "accentDim"], ["--accent-fill", "accentFill"], ["--ok", "ok"], ["--ok-dark", "okBright"],
  ["--warn", "warn"], ["--signal", "info"],
];

test("globals.css legacy blocks carry the same values as colors.ts", () => {
  const blocks: [string, string, ColorPalette][] = [
    [":root", block(":root"), darkColors],
    [':root[data-theme="light"]', block(':root[data-theme="light"]'), lightColors],
    [".public-theme", block(".public-theme"), lightColors],
    ["dark .public-theme", block('html[data-theme="dark"] .public-theme,\n.public-theme[data-theme="dark"]'), darkColors],
  ];
  const mismatches = blocks.flatMap(([label, source, palette]) =>
    SYNCED.flatMap(([name, field]) => {
      const value = cssVar(source, name);
      return value === palette[field].toLowerCase() ? [] : [`${label} ${name}: ${value} ≠ ${field} ${palette[field]}`];
    }),
  );
  assert.deepEqual(mismatches, []);
});

test("the Tailwind @theme block (dark) matches colors.ts for the touched tokens", () => {
  const theme = block("@theme");
  assert.equal(cssVar(theme, "--color-faint"), darkColors.faint);
  assert.equal(cssVar(theme, "--color-border-2"), darkColors.border2);
  assert.equal(cssVar(theme, "--color-brand-fill"), darkColors.brandFill);
  assert.equal(cssVar(theme, "--color-accent-fill"), darkColors.accentFill);
});

test("filled buttons use the fill tokens, not the text-colour tokens", () => {
  assert.match(css, /\.btn-primary \{\n\s*background: var\(--brand-fill\);\n\s*color: #fff;/);
  assert.match(css, /\.btn-accent \{\n\s*background: var\(--accent-fill\);\n\s*color: #fff;/);
});
