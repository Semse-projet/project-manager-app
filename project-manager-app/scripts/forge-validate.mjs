#!/usr/bin/env node
import {
  forgeAgentRegistry,
  forgeAgentRoles,
  forgeRunStates,
  forgeRunTransitions,
  forgeToolNames
} from "../packages/forge/dist/index.js";

const errors = [];
const warnings = [];

const manifests = Object.values(forgeAgentRegistry);
const ids = new Set();

for (const role of forgeAgentRoles) {
  const manifest = forgeAgentRegistry[role];
  if (!manifest) {
    errors.push(`Missing manifest for role: ${role}`);
    continue;
  }

  if (manifest.role !== role) errors.push(`Manifest role mismatch: ${role}`);
  if (ids.has(manifest.id)) errors.push(`Duplicate manifest id: ${manifest.id}`);
  ids.add(manifest.id);

  if (manifest.allowedTools.length === 0) {
    errors.push(`${role}: no allowed tools`);
  }
  if (manifest.fileScopes.length === 0) {
    warnings.push(`${role}: no file scopes`);
  }

  for (const tool of manifest.allowedTools) {
    if (!forgeToolNames.includes(tool)) {
      errors.push(`${role}: unknown tool ${tool}`);
    }
  }
}

for (const state of forgeRunStates) {
  if (!forgeRunTransitions[state]) {
    errors.push(`Missing transition definition for state: ${state}`);
  }
}

console.log("\nSEMSE Forge Validate");
console.log("--------------------");
console.log(`Agents: ${manifests.length}`);
console.log(`States: ${forgeRunStates.length}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log("\nErrors:");
  for (const error of errors) console.log(`- ${error}`);
}

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (errors.length > 0) process.exitCode = 1;
