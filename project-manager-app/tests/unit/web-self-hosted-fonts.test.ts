/** Fonts are self-hosted: the web CSP (style-src/font-src 'self') blocks Google Fonts. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("globals.css loads no external font stylesheet and uses the next/font variables", () => {
  const css = read("apps/web/app/globals.css");
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(css, /--font-sans: var\(--font-geist-sans\),/);
  assert.match(css, /--font-mono: var\(--font-geist-mono\),/);
});

test("the root layout applies the self-hosted Geist variables to <html>", () => {
  const layout = read("apps/web/app/layout.tsx");
  assert.match(layout, /import \{ GeistSans \} from "geist\/font\/sans";/);
  assert.match(layout, /import \{ GeistMono \} from "geist\/font\/mono";/);
  assert.match(layout, /\$\{GeistSans\.variable\} \$\{GeistMono\.variable\}/);
});

test("the CSP still allows only same-origin fonts and styles", () => {
  const config = read("apps/web/next.config.ts");
  assert.match(config, /"font-src 'self' data:"/);
  assert.match(config, /"style-src 'self' 'unsafe-inline'"/);
});

test("the geist package is pinned to an exact version", () => {
  const pkg = JSON.parse(read("apps/web/package.json")) as { dependencies: Record<string, string> };
  assert.match(pkg.dependencies.geist, /^\d+\.\d+\.\d+$/);
});
