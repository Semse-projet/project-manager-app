#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const workspaceFile = path.join(rootDir, "pnpm-workspace.yaml");
const requiredWorkspaceGlobs = ['  - "apps/*"', '  - "packages/*"'];

const packageChecks = [
  { dir: "packages/schemas", name: "@semse/schemas", kind: "package", build: true },
  { dir: "packages/tools", name: "@semse/tools", kind: "package", build: true },
  { dir: "packages/shared", name: "@semse/shared", kind: "package", build: true },
  { dir: "packages/auth", name: "@semse/auth", kind: "package", build: true },
  { dir: "packages/db", name: "@semse/db", kind: "package", build: false },
  { dir: "packages/agents", name: "@semse/agents", kind: "package", build: true },
  { dir: "packages/knowledge", name: "@semse/knowledge", kind: "package", build: true },
  { dir: "packages/autonomy", name: "@semse/autonomy", kind: "package", build: true },
  { dir: "packages/ui", name: "@semse/ui", kind: "package", build: false },
  { dir: "apps/api", name: "@semse/api", kind: "app", build: true },
  { dir: "apps/web", name: "@semse/web", kind: "app", build: true },
  { dir: "apps/worker", name: "@semse/worker", kind: "app", build: false },
];

function collectFiles(dir) {
  const output = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "dist" ||
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "coverage"
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...collectFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      output.push(fullPath);
    }
  }
  return output;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function hasField(pkg, field) {
  return typeof pkg[field] === "string" && pkg[field].length > 0;
}

function gatherInternalImports(files) {
  const imports = new Set();
  const pattern = /from\s+["'](@semse\/[^"']+)["']|import\s+["'](@semse\/[^"']+)["']/g;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1] ?? match[2];
      if (specifier) {
        imports.add(specifier.split("/").slice(0, 2).join("/"));
      }
    }
  }

  return imports;
}

const errors = [];
const warnings = [];

const workspaceContents = readFileSync(workspaceFile, "utf8");
for (const glob of requiredWorkspaceGlobs) {
  if (!workspaceContents.includes(glob)) {
    errors.push(`pnpm-workspace.yaml is missing ${glob}`);
  }
}

for (const check of packageChecks) {
  const packageJsonPath = path.join(rootDir, check.dir, "package.json");
  const tsconfigPath = path.join(rootDir, check.dir, "tsconfig.json");

  if (!statSync(path.join(rootDir, check.dir)).isDirectory()) {
    errors.push(`Missing workspace directory: ${check.dir}`);
    continue;
  }

  const pkg = readJson(packageJsonPath);
  const declaredName = pkg.name;
  if (declaredName !== check.name) {
    errors.push(`${check.dir} expected name ${check.name} but found ${declaredName ?? "<missing>"}`);
  }

  if (check.build) {
    if (!pkg.scripts?.build) {
      errors.push(`${check.dir} is missing scripts.build`);
    }
    if (!statSync(tsconfigPath).isFile()) {
      errors.push(`${check.dir} is missing tsconfig.json`);
    }
  }

  if (check.kind === "package") {
    for (const field of ["main", "types"]) {
      if (!hasField(pkg, field) && check.dir !== "packages/db") {
        errors.push(`${check.dir} is missing ${field}`);
      }
    }

    if (check.dir !== "packages/db" && !pkg.exports) {
      errors.push(`${check.dir} is missing exports`);
    }
  }

  const files = collectFiles(path.join(rootDir, check.dir));
  const imports = gatherInternalImports(files);
  const declaredDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);

  for (const internalImport of imports) {
    if (!declaredDeps.has(internalImport)) {
      errors.push(`${check.dir} imports ${internalImport} but does not declare it in package.json`);
    }
  }

  if (check.dir === "apps/worker" && !pkg.scripts?.check) {
    warnings.push("apps/worker is runtime-only; add scripts.check so preflight can validate syntax");
  }
}

if (errors.length > 0) {
  console.error("[validate-workspace] failed");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[validate-workspace] passed");
for (const warning of warnings) {
  console.log(`- warning: ${warning}`);
}
