#!/usr/bin/env node

import { readFileSync } from "node:fs";

const PLAN_PATH = "docs/AUDIT_REMEDIATION_PLAN.md";
const MAP_PATH = "docs/specs/governance/audit-remediation-program.spec.md";

const plan = readFileSync(PLAN_PATH, "utf8");
const map = readFileSync(MAP_PATH, "utf8");

const planIds = new Set(
  [...plan.matchAll(/^(?:###\s+|-\s+\*\*)([0-3]\.\d+[a-z]?)\b/gm)].map((match) => match[1]),
);
const mappedIds = new Set(
  [...map.matchAll(/`([0-3]\.\d+[a-z]?)`/g)].map((match) => match[1]),
);

for (const match of map.matchAll(/`([0-3])\.(\d+)`[–-]`([0-3])\.(\d+)`/g)) {
  const [, startSection, startRaw, endSection, endRaw] = match;
  if (startSection !== endSection) {
    fail(`Cross-section ranges are not supported: ${match[0]}`);
  }
  const start = Number.parseInt(startRaw, 10);
  const end = Number.parseInt(endRaw, 10);
  if (end < start) {
    fail(`Invalid descending range: ${match[0]}`);
  }
  for (let item = start; item <= end; item += 1) {
    mappedIds.add(`${startSection}.${item}`);
  }
}

const missing = [...planIds].filter((id) => !mappedIds.has(id)).sort(compareIds);
const extra = [...mappedIds].filter((id) => !planIds.has(id)).sort(compareIds);

console.log("\nSEMSE Audit Plan Spec Coverage");
console.log("------------------------------");
console.log(`Plan items: ${planIds.size}`);
console.log(`Mapped items: ${planIds.size - missing.length}`);
console.log(`Missing: ${missing.length}`);
console.log(`Extra: ${extra.length}`);

if (missing.length > 0) {
  console.log(`Missing IDs: ${missing.join(", ")}`);
}
if (extra.length > 0) {
  console.log(`Unknown IDs in map: ${extra.join(", ")}`);
}
if (missing.length > 0 || extra.length > 0) {
  process.exitCode = 1;
}

function compareIds(left, right) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
