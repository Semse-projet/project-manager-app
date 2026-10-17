import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

function read(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

const dictionary = read("apps/web/lib/language-context.tsx");

function translations(key: string): string[] {
  return dictionary.split("\n")
    .filter((line) => line.trimStart().startsWith(`"${key}": `))
    .map((line) => {
      const value = line.match(/^\s*"[^"]+":\s*"([^"]*)"/);
      assert.ok(value, `Invalid translation entry: ${key}`);
      return value[1];
    });
}

function assertLocalized(source: string, key: string, spanish: string, english: string): void {
  assert.ok(source.includes(`t("${key}")`), `UI must render localized key: ${key}`);
  const values = translations(key);
  assert.equal(values.length, 2, `Expected ES/EN values for ${key}`);
  assert.ok(values[0].includes(spanish), `Missing Spanish UI copy for ${key}`);
  assert.ok(values[1].includes(english), `Missing English UI copy for ${key}`);
}

test("F4 web: all BFF contracts derive identity from the incoming session", () => {
  for (const route of [
    "apps/web/app/api/semse/ops/mission-control/exceptions/route.ts",
    "apps/web/app/api/semse/ops/mission-control/runbooks/route.ts",
    "apps/web/app/api/semse/ops/mission-control/actions/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /fetchSemseDataForRequest/);
    assert.doesNotMatch(source, /\bfetchSemseData\(/);
  }
});

test("F4 web: exception UI uses only the governed action endpoint", () => {
  const source = read("apps/web/app/(app)/admin/mission-control/page.tsx");
  assert.match(source, /\/api\/semse\/ops\/mission-control\/actions/);
  assert.match(source, /runbookId/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /draft\.reason\.trim\(\)\.length < 10/);
  assertLocalized(source, "mc.operatorReason", "Motivo del operador", "Operator reason");
  assert.ok(translations("mc.operatorReason").every((value) => value.includes("10–500")),
    "Operator reason limits must remain visible in both locales");
  assertLocalized(source, "mc.dryRun", "Simulación", "Dry-run");
  assert.doesNotMatch(source, /operational-signals\/\$\{id\}\/(acknowledge|resolve|dismiss)/);
  assert.doesNotMatch(source, /ops\/loops\/\$\{.*\}\/(pause|resume)/);
});

test("F4 web: loading, empty, forbidden, inactive, degraded and error states are visible", () => {
  const source = read("apps/web/app/(app)/admin/mission-control/page.tsx");
  for (const [key, spanish, english] of [
    ["mc.loading", "Cargando excepciones", "Loading canonical exceptions"],
    ["mc.empty", "No hay excepciones", "No exceptions match this view"],
    ["mc.access.denied", "Acceso denegado", "Access denied"],
    ["mc.access.inactive", "no está activo", "is not active"],
    ["mc.partialData.pre", "Datos parciales", "Partial data"],
    ["mc.access.unavailable", "no disponible", "unavailable"],
  ]) {
    assertLocalized(source, key, spanish, english);
  }
});
