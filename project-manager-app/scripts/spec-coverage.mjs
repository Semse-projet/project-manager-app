#!/usr/bin/env node
import { classifyCoverage, findSpecFiles, readSpec } from "./spec-lib.mjs";

const failOnGaps = process.argv.includes("--fail-on-gaps");
const specs = findSpecFiles().map(readSpec);

const withTests = [];
const verified = [];
const withoutRelatedFiles = [];
const withoutTests = [];
const highRiskNotVerified = [];

for (const spec of specs) {
  const coverage = classifyCoverage(spec);
  const metadata = spec.metadata;

  if (coverage.tests) {
    withTests.push(spec);
  } else {
    withoutTests.push(spec);
  }

  if (metadata.status === "VERIFIED") {
    verified.push(spec);
  }

  if (metadata.related_files.length === 0) {
    withoutRelatedFiles.push(spec);
  }

  if (["high", "critical"].includes(metadata.risk) && metadata.status !== "VERIFIED") {
    highRiskNotVerified.push(spec);
  }
}

printSection("SEMSE Spec Coverage");
console.log(`Specs: ${specs.length}`);
console.log(`Specs with related_tests: ${formatPercent(withTests.length, specs.length)}`);
console.log(`Specs VERIFIED: ${formatPercent(verified.length, specs.length)}`);
console.log(`Specs without related_files: ${withoutRelatedFiles.length}`);
console.log(`Specs without related_tests: ${withoutTests.length}`);
console.log(`High/critical risk specs not VERIFIED: ${highRiskNotVerified.length}`);

printPaths("Specs without related_files", withoutRelatedFiles);
printPaths("Specs without related_tests", withoutTests);
printPaths("High/critical risk specs not VERIFIED", highRiskNotVerified);

if (failOnGaps && (withoutRelatedFiles.length > 0 || withoutTests.length > 0 || highRiskNotVerified.length > 0)) {
  process.exitCode = 1;
}

function formatPercent(count, total) {
  if (total === 0) return "0/0 (0%)";
  return `${count}/${total} (${Math.round((count / total) * 100)}%)`;
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function printPaths(title, specs) {
  if (specs.length === 0) return;
  console.log(`\n${title}:`);
  for (const spec of specs) {
    console.log(`- ${spec.relativePath}`);
  }
}
