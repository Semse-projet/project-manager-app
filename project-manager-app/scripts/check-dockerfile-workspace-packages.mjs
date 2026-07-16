#!/usr/bin/env node
/**
 * check-dockerfile-workspace-packages — las imágenes Docker deben conocer
 * todos los packages workspace que su app necesita.
 *
 * Incidente que motiva el guard (2026-07-16): PR #304 añadió
 * @semse/product-events como dependencia del API sin actualizar
 * Dockerfile.api. CI pasó verde (no construye imágenes) y el deploy de
 * Railway murió en runtime con ERR_MODULE_NOT_FOUND — API FAILED en prod.
 *
 * Regla, por app (api/web/worker): la clausura transitiva de dependencias
 * @semse/* de la app debe tener, en su Dockerfile:
 *   1. `COPY packages/<dir>/package.json` (etapa deps — sin él, el install
 *      congelado no registra el importer y el link no existe en runtime);
 *   2. solo Dockerfile.api: `packages/<dir>/dist` copiado al runner cuando el
 *      package compila a dist (el runner del API copia dists selectivamente;
 *      web y worker copian packages/ completo).
 *
 * Uso: node scripts/check-dockerfile-workspace-packages.mjs
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// name (@semse/x) → { dir, deps @semse, tieneBuild }
const workspacePackages = new Map();
for (const dir of readdirSync(join(ROOT, "packages"))) {
  const pkgPath = join(ROOT, "packages", dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  workspacePackages.set(pkg.name, {
    dir,
    deps: Object.keys(pkg.dependencies ?? {}).filter((name) => name.startsWith("@semse/")),
    hasBuild: Boolean(pkg.scripts?.build),
  });
}

function transitiveClosure(rootDeps) {
  const seen = new Set();
  const queue = [...rootDeps];
  while (queue.length > 0) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const pkg = workspacePackages.get(name);
    if (pkg) queue.push(...pkg.deps);
  }
  return seen;
}

const APPS = [
  { app: "api", dockerfile: "Dockerfile.api", checkDist: true },
  { app: "web", dockerfile: "Dockerfile.web", checkDist: false },
  { app: "worker", dockerfile: "Dockerfile.worker", checkDist: false },
];

const errors = [];

for (const { app, dockerfile, checkDist } of APPS) {
  const appPkg = JSON.parse(readFileSync(join(ROOT, "apps", app, "package.json"), "utf8"));
  const rootDeps = Object.keys(appPkg.dependencies ?? {}).filter((name) => name.startsWith("@semse/"));
  const needed = transitiveClosure(rootDeps);
  const dockerSource = readFileSync(join(ROOT, dockerfile), "utf8");

  for (const name of [...needed].sort()) {
    const pkg = workspacePackages.get(name);
    if (!pkg) continue; // @semse/db vive en packages/db pero podría no ser package publicable
    if (!dockerSource.includes(`packages/${pkg.dir}/package.json`)) {
      errors.push(
        `${dockerfile}: falta \`COPY packages/${pkg.dir}/package.json\` (etapa deps) — ${name} es dependencia de apps/${app}`,
      );
    }
    if (checkDist && pkg.hasBuild && !dockerSource.includes(`packages/${pkg.dir}/dist`)) {
      errors.push(
        `${dockerfile}: falta copiar \`packages/${pkg.dir}/dist\` al runner — ${name} se importa en runtime`,
      );
    }
  }
}

console.log("check-dockerfile-workspace-packages");
console.log(`  packages workspace: ${workspacePackages.size} · apps verificadas: ${APPS.length}`);
if (errors.length > 0) {
  console.error(`\n${errors.length} package(s) workspace ausentes en Dockerfiles:`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}
console.log("  ✓ Dockerfiles cubren todas las dependencias workspace de cada app");
