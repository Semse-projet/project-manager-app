#!/usr/bin/env node
/**
 * check-toolchain-alignment — una sola versión de Node y pnpm en todo el repo.
 *
 * Fuente de verdad:
 *   - Node:  .nvmrc (major canónico)
 *   - pnpm:  package.json → packageManager
 *
 * Verifica que no diverjan:
 *   - Dockerfile.api / Dockerfile.web / Dockerfile.worker (FROM node:<major>-…,
 *     corepack prepare pnpm@<ver>)
 *   - .github/workflows/*.yml (setup-node node-version, pnpm/action-setup version)
 *   - package.json engines.node (piso >= major canónico)
 *
 * Incidente que motiva el guard (P0 2026-07-13): CI probaba con Node 22
 * mientras Railway construía imágenes con Node 20 — lo validado no era lo
 * desplegado.
 *
 * Uso: node scripts/check-toolchain-alignment.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(ROOT, "..");

const errors = [];

// ── Fuente de verdad ─────────────────────────────────────────────────────────
const nvmrc = readFileSync(join(ROOT, ".nvmrc"), "utf8").trim();
const nodeMajor = nvmrc.split(".")[0];
if (!/^\d+$/.test(nodeMajor)) {
  console.error(`✗ .nvmrc ilegible: "${nvmrc}"`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const pmMatch = /^pnpm@(\d+\.\d+\.\d+)/.exec(pkg.packageManager ?? "");
if (!pmMatch) {
  console.error(`✗ package.json packageManager no declara pnpm@x.y.z: "${pkg.packageManager}"`);
  process.exit(1);
}
const pnpmVersion = pmMatch[1];

// ── engines ──────────────────────────────────────────────────────────────────
const enginesNode = pkg.engines?.node ?? "";
if (!enginesNode.includes(`>=${nodeMajor}`)) {
  errors.push(`package.json engines.node ("${enginesNode}") no fija el piso >=${nodeMajor} (canónico .nvmrc=${nvmrc})`);
}

// ── Dockerfiles ──────────────────────────────────────────────────────────────
for (const dockerfile of ["Dockerfile.api", "Dockerfile.web", "Dockerfile.worker"]) {
  const source = readFileSync(join(ROOT, dockerfile), "utf8");
  for (const [, version] of source.matchAll(/FROM node:(\d+)[-\w.]*/g)) {
    if (version !== nodeMajor) {
      errors.push(`${dockerfile}: FROM node:${version} ≠ Node ${nodeMajor} canónico (.nvmrc)`);
    }
  }
  for (const [, version] of source.matchAll(/corepack prepare pnpm@(\d+\.\d+\.\d+)/g)) {
    if (version !== pnpmVersion) {
      errors.push(`${dockerfile}: corepack prepare pnpm@${version} ≠ pnpm ${pnpmVersion} (packageManager)`);
    }
  }
}

// ── GitHub workflows ─────────────────────────────────────────────────────────
const workflowsDir = join(REPO_ROOT, ".github", "workflows");
let workflowFiles = [];
try {
  workflowFiles = readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file));
} catch {
  // repo sin workflows (p. ej. fixture): nada que verificar
}
for (const file of workflowFiles) {
  const source = readFileSync(join(workflowsDir, file), "utf8");
  for (const [, version] of source.matchAll(/node-version:\s*["']?(\d+)/g)) {
    if (version !== nodeMajor) {
      errors.push(`.github/workflows/${file}: node-version ${version} ≠ Node ${nodeMajor} canónico (.nvmrc)`);
    }
  }
  // Solo el `version:` inmediato a pnpm/action-setup.
  for (const [, version] of source.matchAll(/pnpm\/action-setup@[^\n]+\n\s+with:\n\s+version:\s*["']?(\d+\.\d+\.\d+)/g)) {
    if (version !== pnpmVersion) {
      errors.push(`.github/workflows/${file}: pnpm/action-setup version ${version} ≠ pnpm ${pnpmVersion} (packageManager)`);
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("check-toolchain-alignment");
console.log(`  Node canónico: ${nvmrc} (.nvmrc) · pnpm canónico: ${pnpmVersion} (packageManager)`);
if (errors.length > 0) {
  console.error(`\n${errors.length} divergencia(s) de toolchain:`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}
console.log("  ✓ Node y pnpm alineados en Dockerfiles, CI y engines");
