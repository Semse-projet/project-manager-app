#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { findSpecFiles, readSpec } from "./spec-lib.mjs";

const PLAN_PATH = "docs/AUDIT_REMEDIATION_PLAN.md";
const MAP_PATH = "docs/specs/governance/audit-remediation-program.spec.md";

// Only routing table rows establish primary coverage. Exceptions supplement
// an existing route; prose and summary counts cannot create one.
export function analyzeAuditCoverage(plan, map, knownSpecIds) {
  const planIds = new Set(
    [...plan.matchAll(/^(?:###\s+|-\s+\*\*)([0-3]\.\d+[a-z]?)\b/gm)].map((match) => match[1]),
  );
  const routes = new Map();
  const exceptions = [];
  const errors = [];
  let inRouting = false;
  let inTable = false;
  let inExceptions = false;

  for (const [index, line] of map.split(/\r?\n/).entries()) {
    const location = `Map line ${index + 1}`;
    if (/^##\s/.test(line)) {
      inRouting = /^##\s+[3-6]\. Routing canónico\b/.test(line);
      inTable = false;
      inExceptions = false;
      continue;
    }
    if (!inRouting) continue;
    if (/^\|\s*Ítems\s*\|.*\|\s*Routing\s*\|\s*$/.test(line)) {
      inTable = true;
      continue;
    }
    if (line.startsWith("Excepciones con contrato adicional obligatorio:")) {
      inTable = false;
      inExceptions = true;
      continue;
    }
    if (inTable && /^\|/.test(line) && !/^\|[\s:|-]+\|\s*$/.test(line)) {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (cells.length !== 3) {
        errors.push(`${location}: expected three routing columns`);
        continue;
      }
      const ids = expandIds(cells[0], location, errors);
      const specs = specReferences(cells[1], location, knownSpecIds, errors);
      if (!/^(EXECUTABLE|REVIEW_REQUIRED|DECISION_REQUIRED|CLOSED)(?:\s*\/\s*regresión)?$/.test(cells[2])) {
        errors.push(`${location}: invalid routing state ${cells[2]}`);
      }
      for (const id of ids) {
        if (routes.has(id)) errors.push(`${location}: duplicate primary route for ${id}`);
        routes.set(id, { specs, state: cells[2] });
      }
    } else if (inExceptions && line.startsWith("- ")) {
      const separator = line.indexOf(":");
      if (separator < 0) {
        errors.push(`${location}: exception must declare IDs and contracts`);
        continue;
      }
      exceptions.push(...expandIds(line.slice(2, separator), location, errors));
      specReferences(line.slice(separator + 1), location, knownSpecIds, errors);
    }
  }

  if (planIds.size === 0) errors.push("No finding IDs found in the audit plan");
  for (const id of exceptions) {
    if (!routes.has(id)) errors.push(`Exception ${id} has no primary route`);
    if (!planIds.has(id)) errors.push(`Exception ${id} is not in the audit plan`);
  }
  const missing = [...planIds].filter((id) => !routes.has(id)).sort(compareIds);
  const extra = [...routes.keys()].filter((id) => !planIds.has(id)).sort(compareIds);
  return { planIds, routes, missing, extra, errors };
}

function expandIds(cell, location, errors) {
  const ids = [];
  const tokens = /`([0-3]\.\d+[a-z]?)`(?:\s*[–-]\s*`([0-3]\.\d+[a-z]?)`)?/g;
  const residue = cell.replace(tokens, (_, first, last) => {
    if (!last) {
      ids.push(first);
      return "";
    }
    const [section, start] = first.split(".");
    const [endSection, end] = last.split(".");
    if (section !== endSection || !/^\d+$/.test(start) || !/^\d+$/.test(end) || Number(end) < Number(start)) {
      errors.push(`${location}: invalid range ${first}–${last}`);
      return "";
    }
    for (let item = Number(start); item <= Number(end); item += 1) ids.push(`${section}.${item}`);
    return "";
  }).replace(/[\s,]/g, "");
  if (residue || ids.length === 0) errors.push(`${location}: invalid finding cell ${cell}`);
  return ids;
}

function specReferences(cell, location, knownSpecIds, errors) {
  const specs = [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  if (specs.length === 0) errors.push(`${location}: no explicit spec contract`);
  for (const id of specs) {
    if (!knownSpecIds.has(id)) errors.push(`${location}: unknown spec ${id}`);
  }
  return specs;
}

function compareIds(left, right) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function main() {
  const result = analyzeAuditCoverage(
    readFileSync(PLAN_PATH, "utf8"),
    readFileSync(MAP_PATH, "utf8"),
    new Set(findSpecFiles().map((file) => readSpec(file).metadata.id)),
  );
  console.log("\nSEMSE Audit Plan Spec Coverage");
  console.log(`Plan items: ${result.planIds.size}`);
  console.log(`Mapped items: ${result.planIds.size - result.missing.length}`);
  console.log(`Missing: ${result.missing.length}`);
  console.log(`Extra: ${result.extra.length}`);
  console.log(`Errors: ${result.errors.length}`);
  if (result.missing.length) console.log(`Missing IDs: ${result.missing.join(", ")}`);
  if (result.extra.length) console.log(`Unknown IDs in map: ${result.extra.join(", ")}`);
  for (const error of result.errors) console.error(error);
  if (result.missing.length || result.extra.length || result.errors.length) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
