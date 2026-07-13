#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { findSpecFiles, classifyCoverage, readSpec } from "./spec-lib.mjs";

const INDEX_PATH = "docs/SPEC_INDEX.md";
const START = "<!-- SPEC_INDEX:START -->";
const END = "<!-- SPEC_INDEX:END -->";

const specs = findSpecFiles().map(readSpec);
const generated = buildGeneratedIndex(specs);
const current = readFileSync(INDEX_PATH, "utf8");
const next = upsertBlock(current, generated);

writeFileSync(INDEX_PATH, next);
console.log(`Updated ${INDEX_PATH} with ${specs.length} specs.`);

function buildGeneratedIndex(specs) {
  const lines = [
    START,
    "## Matriz SDD Generada",
    "",
    "> Bloque generado por `pnpm spec:index`. Editar metadata en cada spec, no esta tabla.",
    "",
    "| Spec ID | Domain | Status | Risk | API | UI | Tests | Related Files | Last Verified |",
    "|---|---|---|---|---|---|---|---|---|",
  ];

  for (const spec of specs) {
    const coverage = classifyCoverage(spec);
    const metadata = spec.metadata;
    lines.push(
      [
        link(metadata.id, relative(dirname(INDEX_PATH), spec.relativePath).replaceAll("\\", "/")),
        metadata.domain || "missing",
        metadata.status || "missing",
        metadata.risk || "missing",
        coverage.api ? "yes" : "no",
        coverage.ui ? "yes" : "no",
        coverage.tests ? "yes" : "no",
        String(coverage.relatedFiles),
        metadata.last_verified || "missing",
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
  }

  lines.push("", END);
  return lines.join("\n");
}

function upsertBlock(current, generated) {
  const startIndex = current.indexOf(START);
  const endIndex = current.indexOf(END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const prefix = current.slice(0, startIndex).trimEnd();
    const suffix = current.slice(endIndex + END.length).trim();
    return `${prefix}\n\n${generated}\n\n${suffix}\n`;
  }

  const insertionPoint = current.indexOf("\n## NIVEL 0");
  if (insertionPoint !== -1) {
    return `${current.slice(0, insertionPoint)}\n${generated}${current.slice(insertionPoint)}`;
  }

  return `${current.trimEnd()}\n\n${generated}`;
}

function link(label, href) {
  return `[${escapeCell(label)}](${href})`;
}

function escapeCell(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}
