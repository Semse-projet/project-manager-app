#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  ALLOWED_STATUSES,
  CANONICAL_STATUSES,
  DELIVERY_METADATA_FIELDS,
  DELIVERY_STATUS_VALUES,
  SDD_VERSION,
  deliveryStateErrors,
  findSpecFiles,
  isSddV2,
  isFile,
  missingCanonicalMetadata,
  missingDeliveryMetadata,
  pathExists,
  readSpec,
  searchRepo,
} from "./spec-lib.mjs";

const strict = process.argv.includes("--strict") || process.env.SEMSE_SPEC_STRICT === "1";
const specFiles = findSpecFiles();
const errors = [];
const warnings = [];
const ids = new Map();

validateTemplateParity(
  ".specify/templates/overrides/semse-spec.md",
  "docs/specs/templates/semse-spec-template.md",
);

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

  if (ids.has(metadata.id)) {
    errors.push(`${label}: duplicate spec id "${metadata.id}" (already used by ${ids.get(metadata.id)})`);
  } else if (metadata.id) {
    ids.set(metadata.id, label);
  }

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

  if (metadata.sdd_version && metadata.sdd_version !== SDD_VERSION) {
    errors.push(`${label}: unsupported sdd_version "${metadata.sdd_version}"; expected "${SDD_VERSION}"`);
  }

  if (isSddV2(spec)) {
    const missingDelivery = missingDeliveryMetadata(spec);
    if (missingDelivery.length > 0) {
      errors.push(`${label}: SDD ${SDD_VERSION} is missing delivery metadata fields: ${missingDelivery.join(", ")}`);
    }

    for (const field of DELIVERY_METADATA_FIELDS) {
      const allowed = DELIVERY_STATUS_VALUES[field];
      const value = metadata[field];
      if (allowed && value && !allowed.has(value)) {
        errors.push(`${label}: invalid ${field} "${value}"`);
      }
    }

    errors.push(...deliveryStateErrors(label, metadata));
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

function validateTemplateParity(canonicalPath, mirrorPath) {
  const canonical = readFileSync(canonicalPath, "utf8").replace(/\r\n/g, "\n");
  const mirror = readFileSync(mirrorPath, "utf8").replace(/\r\n/g, "\n");
  if (canonical !== mirror) {
    errors.push(`${mirrorPath}: template diverges from canonical ${canonicalPath}`);
  }
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
