/**
 * Regression coverage for the bilingual operational panels.
 * Run: node --experimental-strip-types --test tests/unit/operational-panels-i18n.test.ts
 *
 * Static dictionary checks cannot translate API-generated prose. Those
 * responses require separate, locale-aware backend handling.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(path.join(root, "apps/web/lib/language-context.tsx"), "utf8");

function keysBetween(start: string, end: string): Set<string> {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "language dictionaries not found");
  return new Set(
    [...src.slice(a, b).matchAll(/"([A-Za-z0-9_.-]+)":/g)].map((m) => m[1]),
  );
}

const es = keysBetween("\n  es: {", "\n  en: {");
const en = keysBetween("\n  en: {", "\nconst LanguageContext");

test("Spanish and English translation dictionaries remain in full key parity", () => {
  assert.ok(es.size > 0);
  assert.deepEqual([...es].filter((k) => !en.has(k)), []);
  assert.deepEqual([...en].filter((k) => !es.has(k)), []);
});

test("all static operational panel translation keys exist in both languages", () => {
  const files = [
    "apps/web/components/milestones/MilestoneGovernancePanel.tsx",
    "apps/web/components/buildops/BuildOpsProjectHealthPanel.tsx",
    "apps/web/components/change-orders/ChangeOrderImpactCard.tsx",
  ];
  const required = new Set(["nav.workspace"]);
  for (const filename of files) {
    const panel = readFileSync(path.join(root, filename), "utf8");
    assert.match(panel, /useLanguage/, `${filename} must access locale context`);
    for (const match of panel.matchAll(/\bt\(["']([A-Za-z0-9_.-]+)["']\)/g)) {
      required.add(match[1]);
    }
  }
  for (const status of ["ready", "blocked", "needs_review", "released", "disputed"]) {
    required.add(`governance.status.${status}`);
  }
  for (const risk of ["low", "medium", "high", "critical"]) {
    required.add(`risk.${risk}`);
  }
  for (const key of required) {
    assert.ok(es.has(key), `Missing Spanish translation: ${key}`);
    assert.ok(en.has(key), `Missing English translation: ${key}`);
  }
});
