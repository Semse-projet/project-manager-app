/**
 * Tailwind v4 puts utilities in @layer utilities, and unlayered CSS beats every layer.
 * The base reset must live in @layer base, or `* { padding: 0 }` and `a { color }`
 * silently override every p-*, m-* and text-* utility (invisible white-on-blue CTAs).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(path.join(root, "apps/web/app/globals.css"), "utf8");

function baseLayer(): string {
  const start = css.indexOf("@layer base {");
  assert.ok(start >= 0, "globals.css must declare @layer base");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error("unterminated @layer base");
}

test("the universal reset and the link colour live inside @layer base", () => {
  const layer = baseLayer();
  assert.match(layer, /\*,\s*\*::before,\s*\*::after\s*\{[^}]*margin: 0;[^}]*padding: 0;/);
  assert.match(layer, /\ba\s*\{\s*color: var\(--brand\);/);
  assert.match(layer, /button,\s*input,\s*textarea,\s*select\s*\{\s*font: inherit;\s*color: inherit;/);
});

test("no unlayered rule resets margin/padding on every element or colours every link", () => {
  const outside = css.replace(baseLayer(), "");
  assert.doesNotMatch(outside, /(^|\n)\*,\s*\n?\*::before[\s\S]*?\{[^}]*padding: 0;/);
  assert.doesNotMatch(outside, /(^|\n)a\s*\{[^}]*color:/);
});
