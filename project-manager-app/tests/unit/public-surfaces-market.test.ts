/**
 * Regresión de mercado público (Florida/USD) — escaneo estático.
 *
 * Incidente P0 2026-07-13: tras el PR #297 la landing pública siguió
 * mostrando "MXN" porque el endpoint público de presupuesto lo tenía
 * hardcodeado. Este test recorre las superficies públicas (web y API) y
 * falla si reaparece cualquier referencia a MXN o al locale es-MX.
 *
 * Run: node --experimental-strip-types --test tests/unit/public-surfaces-market.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Superficies visibles para visitantes anónimos del mercado Florida. */
const PUBLIC_SURFACES = [
  "apps/web/app/(public)",
  "apps/web/app/pro",
  "apps/web/app/como-funciona",
  "apps/web/components/landing",
  "apps/web/lib/public-landing.ts",
  "apps/web/app/api/semse/public",
  "apps/api/src/modules/intelligence/public-insights.service.ts",
  "apps/api/src/modules/intelligence/budget-intelligence.service.ts",
  "apps/api/src/modules/intelligence/professional-credential.service.ts",
];

const FORBIDDEN = [/\bMXN\b/, /es-MX/];

function* walk(path: string): Generator<string> {
  const st = statSync(path);
  if (st.isFile()) {
    if (/\.(ts|tsx|mts|mjs|js|jsx)$/.test(path)) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    yield* walk(join(path, entry));
  }
}

test("las superficies públicas no contienen MXN ni es-MX", () => {
  const offenders: string[] = [];
  for (const surface of PUBLIC_SURFACES) {
    for (const file of walk(join(ROOT, surface))) {
      const source = readFileSync(file, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(source)) {
          offenders.push(`${file.replace(`${ROOT}/`, "")} contiene ${re}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `moneda/locale no público en superficies públicas:\n${offenders.join("\n")}`);
});
