import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const REGISTRY_PATH = path.join(REPO_ROOT, "docs", "CANONICAL_STATE_REGISTRY.md");

const REQUIRED_COLUMNS = [
  "Capacidad",
  "Propietario",
  "Estado real",
  "Evidencia",
  "Entorno",
  "Commit verificado",
  "Limitaciones",
  "Riesgos",
  "Última verificación",
  "Documentos obsoletos",
  "Próxima decisión",
];

const VALID_ESTADO_REAL = new Set(["no_iniciada", "simulada", "parcial", "operativa", "verificada"]);

function readRegistry(): string {
  assert.ok(existsSync(REGISTRY_PATH), `expected registry file at ${REGISTRY_PATH}`);
  return readFileSync(REGISTRY_PATH, "utf8");
}

function extractCapabilityRows(content: string): string[][] {
  const lines = content.split("\n");
  const headerIndex = lines.findIndex((line) => REQUIRED_COLUMNS.every((column) => line.includes(column)));
  assert.notEqual(headerIndex, -1, "expected a table header row containing all required columns");

  const rows: string[][] = [];
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    rows.push(cells);
  }
  return rows;
}

function extractEvidencePaths(evidenceCell: string): string[] {
  const matches = evidenceCell.match(/`([^`]+)`/g) ?? [];
  return matches
    .map((match) => match.slice(1, -1))
    .filter((value) => value.startsWith("docs/") || value.startsWith("apps/") || value.startsWith("packages/") || value.startsWith("tests/"))
    .map((value) => value.split(" ")[0].replace(/[,;]$/, ""));
}

test("canonical state registry exists and declares the required schema columns", () => {
  const content = readRegistry();
  for (const column of REQUIRED_COLUMNS) {
    assert.ok(content.includes(column), `expected schema column "${column}" to be documented`);
  }
});

test("canonical state registry defines the 9-level truth hierarchy", () => {
  const content = readRegistry();
  assert.match(content, /Jerarquía de verdad/);
  for (let level = 1; level <= 9; level += 1) {
    assert.ok(content.includes(`${level}. **`), `expected truth hierarchy level ${level} to be documented`);
  }
});

test("every seeded capability row uses a valid Estado real value", () => {
  const content = readRegistry();
  const rows = extractCapabilityRows(content);
  assert.ok(rows.length > 0, "expected at least one seeded capability row");

  for (const row of rows) {
    const estadoReal = row[2];
    const normalized = estadoReal.split(" ")[0];
    assert.ok(
      VALID_ESTADO_REAL.has(normalized),
      `row "${row[0]}" has invalid Estado real "${estadoReal}"; expected one of ${[...VALID_ESTADO_REAL].join(", ")}`,
    );
  }
});

test("rows marked operativa or verificada cite evidence paths that exist in the repository", () => {
  const content = readRegistry();
  const rows = extractCapabilityRows(content);

  for (const row of rows) {
    const [capability, , estadoReal, evidencia] = row;
    const normalized = estadoReal.split(" ")[0];
    if (normalized !== "operativa" && normalized !== "verificada") continue;

    const paths = extractEvidencePaths(evidencia);
    assert.ok(paths.length > 0, `row "${capability}" is "${normalized}" but cites no checkable evidence path`);

    for (const relativePath of paths) {
      const absolutePath = path.join(REPO_ROOT, relativePath);
      assert.ok(existsSync(absolutePath), `row "${capability}" cites evidence path "${relativePath}" which does not exist`);
    }
  }
});

test("no seeded row fabricates a verificada state without an independent re-verification note", () => {
  const content = readRegistry();
  const rows = extractCapabilityRows(content);

  for (const row of rows) {
    const [capability, , estadoReal] = row;
    assert.notEqual(
      estadoReal.trim(),
      "verificada",
      `row "${capability}" claims a bare "verificada" state; this registry's Phase 1 seed should qualify inherited claims (e.g. "operativa (según spec, no re-verificado aquí)") rather than assert independent verification it did not perform`,
    );
  }
});
