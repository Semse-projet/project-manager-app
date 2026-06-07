#!/usr/bin/env node
import {
  ALLOWED_STATUSES,
  CANONICAL_STATUSES,
  findSpecFiles,
  isFile,
  missingCanonicalMetadata,
  pathExists,
  readSpec,
  searchRepo,
} from "./spec-lib.mjs";

const strict = process.argv.includes("--strict") || process.env.SEMSE_SPEC_STRICT === "1";
const specFiles = findSpecFiles();
const errors = [];
const warnings = [];

if (specFiles.length === 0) {
  errors.push("No specs found under docs/specs/**/*.spec.md");
}

for (const file of specFiles) {
  const spec = readSpec(file);
  const { metadata } = spec;
  const label = spec.relativePath;

  requireField(label, "id", metadata.id);
  requireField(label, "title", metadata.title);
  requireField(label, "domain", metadata.domain);
  requireField(label, "status", metadata.status);

  if (metadata.status && !ALLOWED_STATUSES.has(metadata.status)) {
    errors.push(`${label}: invalid status "${metadata.status}"`);
  }

  if (metadata.status && !CANONICAL_STATUSES.has(metadata.status)) {
    warnings.push(`${label}: status "${metadata.status}" is legacy; prefer DRAFT, REVIEW, APPROVED, IMPLEMENTED, VERIFIED or DEPRECATED`);
  }

  const missingMetadata = missingCanonicalMetadata(spec);
  if (missingMetadata.length > 0) {
    const message = `${label}: missing canonical metadata fields: ${missingMetadata.join(", ")}`;
    if (strict) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  for (const relatedFile of metadata.related_files) {
    if (!pathExists(relatedFile)) {
      errors.push(`${label}: related_files entry does not exist: ${relatedFile}`);
    }
  }

  for (const relatedTest of metadata.related_tests) {
    if (!isFile(relatedTest)) {
      errors.push(`${label}: related_tests entry does not exist or is not a file: ${relatedTest}`);
    }
  }

  if (["IMPLEMENTED", "VERIFIED"].includes(metadata.status) && metadata.related_tests.length === 0) {
    errors.push(`${label}: ${metadata.status} specs must declare related_tests`);
  }

  if (metadata.related_endpoints.length > 0 && !searchRepo(["apps/api/src"], metadata.related_endpoints)) {
    errors.push(`${label}: related_endpoints declared but no matching reference was found in apps/api/src`);
  }

  if (
    metadata.related_events.length > 0 &&
    !searchRepo(["apps/api/src", "apps/web", "apps/angular", "apps/worker", "packages"], metadata.related_events)
  ) {
    errors.push(`${label}: related_events declared but no matching reference was found in app/package event code`);
  }
}

printSection("SEMSE Spec Validate");
console.log(`Specs scanned: ${specFiles.length}`);
console.log(`Mode: ${strict ? "strict" : "baseline"}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);

if (errors.length > 0) {
  printList("Errors", errors);
}

if (warnings.length > 0) {
  printList("Warnings", warnings);
}

if (errors.length > 0) {
  process.exitCode = 1;
}

function requireField(label, field, value) {
  if (!value) errors.push(`${label}: missing required metadata field "${field}"`);
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function printList(title, items) {
  console.log(`\n${title}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}
