/**
 * Tests for scripts/quality/validate-critical-i18n.ts (SEMSE quality kit,
 * phase 3): each rule must catch its defect on a fixture, and the real
 * apps/web catalogs must pass with zero errors.
 * Run: node --experimental-strip-types --test tests/unit/validate-critical-i18n.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  checkCatalog,
  checkUsages,
  extractCatalogs,
  placeholders,
  validateRepository,
  type Catalog,
} from "../../scripts/quality/validate-critical-i18n.ts";

function catalogFrom(body: string, file = "apps/web/app/fixture/page.tsx"): Catalog {
  const catalogs = extractCatalogs(`\nconst COPY = {\n${body}\n} as const;\n`, file);
  assert.equal(catalogs.length, 1, "fixture must parse into one catalog");
  return catalogs[0];
}

const codes = (catalog: Catalog) => checkCatalog(catalog).map((f) => `${f.code}:${f.key}`);

test("parser flattens nested keys, reads functions and skips type assertions", () => {
  const c = catalogFrom(`  es: {
    title: "Título",
    // comment with a "quote": and a colon
    invited: (company: string, count?: number) => \`\${company} te invitó\`,
    status: { SENT: "Enviada", "NEEDS_REVIEW": 'Revisar, por favor' } as Record<string, string>,
  },
  en: {
    title: "Title",
    invited: (company: string, count?: number) => \`\${company} invited you\`,
    status: { SENT: "Sent", "NEEDS_REVIEW": 'Please review' } as Record<string, string>,
  }`);
  assert.deepEqual([...c.es.keys()], ["title", "invited", "status.SENT", "status.NEEDS_REVIEW"]);
  assert.equal(c.es.get("invited")?.kind, "function");
  assert.deepEqual(c.es.get("invited")?.params, ["company", "count"]);
  assert.deepEqual(codes(c), []);
});

test("missing keys are reported in both directions", () => {
  const c = catalogFrom(`  es: { a: "Uno", onlyEs: "Sólo" },\n  en: { a: "One", onlyEn: "Only" }`);
  assert.deepEqual(codes(c).sort(), ["missing-key:onlyEn", "missing-key:onlyEs"]);
});

test("empty values, placeholder drift and Spanish left in English are errors", () => {
  const c = catalogFrom(`  es: { empty: "", count: "Tienes {n} tareas", greet: "Hola {{name}}", pct: "%s de %d", copy: "Guardar" },
  en: { empty: "Empty", count: "You have tasks", greet: "Hi {{user}}", pct: "%s of %d", copy: "Guardar cambios ahora sí" }`);
  assert.deepEqual(codes(c).sort(), [
    "empty-value:empty",
    "placeholder-mismatch:count",
    "placeholder-mismatch:greet",
    "spanish-in-en:copy",
  ]);
});

test("plural/interpolation functions must keep the same shape and parameters", () => {
  const c = catalogFrom(`  es: { items: (n: number) => n === 1 ? "1 elemento" : \`\${n} elementos\`, who: (name: string) => \`Hola \${name}\` },
  en: { items: "items", who: (user: string) => \`Hi \${user}\` }`);
  assert.deepEqual(codes(c).sort(), ["function-mismatch:items", "function-mismatch:who", "placeholder-mismatch:who"]);
});

test("critical messages copied verbatim are warnings, not errors", () => {
  const c = catalogFrom(`  es: { "payment.error": "Error de pago", "ui.cancel": "Cancel" },\n  en: { "payment.error": "Payment error", "ui.cancel": "Cancel" }`);
  const findings = checkCatalog(c);
  assert.deepEqual(findings.map((f) => `${f.level}:${f.code}:${f.key}`), ["warning:critical-identical:ui.cancel"]);
});

test("allowlist entries silence exactly their rule and key", () => {
  const c = catalogFrom(`  es: { a: "Hace" },\n  en: { a: "" }`);
  assert.deepEqual(codes(c), ["empty-value:a"]);
  assert.deepEqual(checkCatalog(c, { "empty-value": { "apps/web/app/fixture/page.tsx#a": "fixture: intentionally empty" } }), []);
});

test("t() usages: raw static keys and dead dynamic prefixes are errors", () => {
  const central = catalogFrom(`  es: { "nav.home": "Inicio", "mc.status.open": "Abierto" },\n  en: { "nav.home": "Home", "mc.status.open": "Open" }`, "apps/web/lib/language-context.tsx");
  const page = `const { t } = useLanguage(); t("nav.home"); t("nav.missing"); t(\`mc.status.\${s}\`); t(\`ghost.\${x}\`);`;
  const ownT = `const { language } = useLanguage(); const t = (k) => k; t("anything.goes");`;
  const findings = checkUsages([{ file: "apps/web/app/p.tsx", src: page }, { file: "apps/web/app/q.tsx", src: ownT }], central);
  assert.deepEqual(findings.map((f) => `${f.code}:${f.key}`), ["raw-key:nav.missing", "raw-key-prefix:ghost.*"]);
});

test("translated text stored in state is a warning (it will not follow a language switch)", () => {
  const central = catalogFrom(`  es: { "dash.loadError": "No se pudo cargar" },\n  en: { "dash.loadError": "Could not load" }`, "apps/web/lib/language-context.tsx");
  const page = `const { t } = useLanguage(); setApiError(displayText(err, t("dash.loadError"))); setTitle(t('dash.loadError')); setKey("dash.loadError");`;
  const findings = checkUsages([{ file: "apps/web/app/p.tsx", src: page }], central);
  assert.deepEqual(findings.map((f) => `${f.level}:${f.code}:${f.key}`), [
    "warning:translated-text-in-state:dash.loadError",
    "warning:translated-text-in-state:dash.loadError",
  ]);
});

test("placeholders() ignores literal braces in prose but sees template variables", () => {
  assert.deepEqual(placeholders({ kind: "template", raw: "`${a} y ${b.c}`", params: [] }), ["${a}", "${b.c}"]);
  assert.deepEqual(placeholders({ kind: "string", raw: '"Total: {total} ({{currency}})"', params: [] }), ["{currency}", "{total}"]);
});

test("the real apps/web ES/EN catalogs pass with zero errors", () => {
  const result = validateRepository();
  const central = result.catalogs.find((c) => c.file === "apps/web/lib/language-context.tsx");
  assert.ok(central && central.es > 1000, "central dictionary must be found and parsed");
  assert.ok(result.catalogs.length >= 10, `expected the page-local COPY catalogs too, got ${result.catalogs.length}`);
  assert.deepEqual(result.errors, [], result.errors.map((e) => `${e.code} ${e.where} ${e.key ?? ""}: ${e.message}`).join("\n"));
});
