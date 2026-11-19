/**
 * #1148 — regresiones reproducidas en local (Playwright, build de producción):
 *  1. Los inputs de las páginas de acceso no mostraban foco con teclado: un
 *     `outline: "none"` en línea anulaba `input:focus-visible` de globals.css (WCAG 2.4.7).
 *  2. Con la cookie `semse-language=en`, el grupo (public) (landing, /como-funciona,
 *     privacidad, términos…) se servía con `<html lang="en">` y contenido solo en
 *     español (WCAG 3.1.1/3.1.2).
 *  3. El título y la descripción por defecto eran siempre españoles, también en
 *     páginas de acceso servidas en inglés.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const AUTH_PAGES = [
  "apps/web/app/login/page.tsx",
  "apps/web/app/register/page.tsx",
  "apps/web/app/forgot-password/page.tsx",
  "apps/web/app/reset-password/page.tsx",
];

for (const file of AUTH_PAGES) {
  test(`${file}: inputs keep the global keyboard focus ring`, () => {
    assert.doesNotMatch(read(file), /outline:\s*["']none["']/, "an inline outline:none overrides input:focus-visible");
  });
}

test("globals.css still draws the focus ring the auth inputs rely on", () => {
  assert.match(read("apps/web/app/globals.css"), /input:focus-visible,[\s\S]*?outline: 2px solid var\(--brand\)/);
});

test("the Spanish-only public group declares its content language", () => {
  const layout = read("apps/web/app/(public)/layout.tsx");
  assert.match(layout, /<div\s+lang="es"/, "content stays Spanish even when the visitor chose English");
});

test("the public group keeps Spanish title/description to match its content", () => {
  const layout = read("apps/web/app/(public)/layout.tsx");
  assert.match(layout, /title:\s*\{\s*absolute:\s*"SEMSE Project — Profesionales verificados y pagos seguros"/);
  assert.match(layout, /description:\s*"Conecta con profesionales verificados/);
});

test("root layout localizes the default title/description from the language cookie", () => {
  const layout = read("apps/web/app/layout.tsx");
  assert.match(layout, /export async function generateMetadata\(\)/);
  assert.doesNotMatch(layout, /export const metadata\b/, "static metadata cannot follow the cookie");
  assert.match(layout, /SEMSE Project — Verified professionals and secure payments/);
  assert.match(layout, /SEMSE Project — Profesionales verificados y pagos seguros/);
});
