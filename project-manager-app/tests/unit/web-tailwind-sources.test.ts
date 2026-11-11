/**
 * Tailwind v4 only scans the app that imports it. Shared components in
 * packages/ui (AppShell, StatCard, EmptyState…) used classes that never made
 * it into the CSS: the signed-in sidebar border fell back to the text colour.
 * globals.css must list packages/ui as a source, and the path must exist.
 * Run: node --experimental-strip-types --test tests/unit/web-tailwind-sources.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cssPath = path.join(root, "apps/web/app/globals.css");
// Comments stripped the way a browser does, so a commented-out @source does not count.
const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

test("globals.css declares packages/ui as a Tailwind source, after the tailwindcss import", () => {
  const sources = [...css.matchAll(/@source\s+["']([^"']+)["']\s*;/g)].map((m) => m[1]);
  const ui = sources.find((s) => /packages\/ui\/src\/?$/.test(s));
  assert.ok(ui, `no @source for packages/ui/src (found: ${sources.join(", ") || "none"})`);
  assert.ok(existsSync(path.resolve(path.dirname(cssPath), ui)), `@source path does not exist: ${ui}`);
  assert.ok(css.indexOf("@import \"tailwindcss\"") < css.indexOf("@source"), "@source must follow @import \"tailwindcss\"");
});
