import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReport, loadAllowlist, toMarkdown } from "../../scripts/architecture/resource-scope-inventory.mjs";

// C51 etapa 3B — la guarda informativa de ResourceScope. Se prueba sobre un árbol de fixtures temporal.

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/architecture/resource-scope-inventory.mjs");

function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rs-inventory-"));
  const w = (rel, body) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  };
  const ctrl = (name, service, route, extra = "") => `
import { Controller, Get, Post, Param, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { ${service} } from "./${name}.service.js";
@Controller("v1/${name}")
export class ${service}Controller {
  constructor(private readonly svc: ${service}) {}
  ${extra}
  ${route}
}
`;
  // 1) scoped: el servicio importa el contrato resource-scope
  w("modules/scoped/scoped.controller.ts", ctrl("scoped", "ScopedService", `@Get(":id") @RequirePermissions("x:read") async get(@Param("id") id: string) { return this.svc.get(id); }`));
  w("modules/scoped/scoped.service.ts", `import { assertScopeAccess } from "../../common/resource-scope.js";\nexport class ScopedService { get(id: string) { return id; } }`);
  // 2) domain-policy: el servicio importa una política de dominio
  w("modules/policy/policy.controller.ts", ctrl("policy", "PolicyService", `@Post(":id/approve") async approve(@Param("id") id: string) { return this.svc.approve(id); }`));
  w("modules/policy/policy.service.ts", `import { canApprove } from "./policy.policy.js";\nexport class PolicyService { approve(id: string) { return id; } }`);
  // 3) profundidad 2: controller → servicio → repositorio con resource-scope
  w("modules/deep/deep.controller.ts", ctrl("deep", "DeepService", `@Get(":id") async get(@Param("id") id: string) { return this.svc.get(id); }`));
  w("modules/deep/deep.service.ts", `import { DeepRepository } from "./deep.repository.js";\nexport class DeepService { constructor(private readonly repo: DeepRepository) {} get(id: string) { return this.repo.find(id); } }`);
  w("modules/deep/deep.repository.ts", `import { sameOrg } from "../../common/resource-scope.js";\nexport class DeepRepository { find(id: string) { return id; } }`);
  // 4) sin evidencia: solo RequirePermissions (NO cuenta como scope)
  w("modules/bare/bare.controller.ts", ctrl("bare", "BareService", `@Get(":id") @RequirePermissions("x:read") async get(@Param("id") id: string) { return this.svc.get(id); }`));
  w("modules/bare/bare.service.ts", `export class BareService { get(id: string) { return id; } }`);
  // 5) query ...Id sin evidencia; y ruta SIN identificador de recurso (se ignora)
  w("modules/query/query.controller.ts", ctrl("query", "QueryService", `@Get("list") async list(@Query("projectId") projectId: string) { return this.svc.list(projectId); }
  @Get("health") async health() { return "ok"; }`));
  w("modules/query/query.service.ts", `export class QueryService { list(p: string) { return p; } }`);
  // 6) pública sin evidencia
  w("modules/pub/pub.controller.ts", ctrl("pub", "PubService", `@Public() @Get(":id") async get(@Param("id") id: string) { return this.svc.get(id); }`));
  w("modules/pub/pub.service.ts", `export class PubService { get(id: string) { return id; } }`);
  // 7) archivo de test (debe ignorarse)
  w("modules/bare/bare.controller.test.ts", `export const x = 1;`);
  return root;
}

const statusOf = (report, file) => report.routes.filter((r) => r.file === file).map((r) => r.status);

test("clasifica por evidencia estática: scoped, domain-policy, profundidad 2, sin evidencia, pública", () => {
  const root = makeTree();
  const report = buildReport({ srcRoot: root, allowlistFile: null });
  assert.deepEqual(statusOf(report, "modules/scoped/scoped.controller.ts"), ["scoped"]);
  assert.deepEqual(statusOf(report, "modules/policy/policy.controller.ts"), ["domain-policy"]);
  assert.deepEqual(statusOf(report, "modules/deep/deep.controller.ts"), ["scoped"]);
  assert.deepEqual(statusOf(report, "modules/bare/bare.controller.ts"), ["no-evidence"]); // RequirePermissions solo ≠ scope
  assert.deepEqual(statusOf(report, "modules/query/query.controller.ts"), ["no-evidence"]); // @Query("projectId") cuenta; /health no
  assert.deepEqual(statusOf(report, "modules/pub/pub.controller.ts"), ["public-unscoped"]);
  assert.equal(report.resourceRoutes, 6);
  assert.equal(report.candidates.length, 2);
  assert.equal(report.routes.find((r) => r.file.includes("bare")).permissionsOnly, true);
});

test("la allowlist exige motivo, marca los candidatos como allowlisted y detecta entradas obsoletas", () => {
  const root = makeTree();
  const allow = path.join(root, "allow.json");
  fs.writeFileSync(allow, JSON.stringify({ entries: [
    { file: "modules/bare/bare.controller.ts", reason: "Recurso global sin dueño por org (catálogo de solo lectura)" },
    { file: "modules/ghost/ghost.controller.ts", reason: "Entrada que ya no coincide con ninguna ruta" },
    { file: "modules/query/query.controller.ts" },
  ] }));
  const loaded = loadAllowlist(allow);
  assert.equal(loaded.errors.length, 1); // la entrada sin "reason"
  const report = buildReport({ srcRoot: root, allowlistFile: allow });
  assert.deepEqual(statusOf(report, "modules/bare/bare.controller.ts"), ["allowlisted"]);
  assert.match(report.routes.find((r) => r.status === "allowlisted").allowReason, /catálogo/);
  assert.deepEqual(report.staleAllowlist.map((e) => e.file), ["modules/ghost/ghost.controller.ts"]);
  assert.equal(report.candidates.length, 1);
  const md = toMarkdown(report);
  assert.match(md, /no bloquea CI/);
  assert.match(md, /obsoletas/);
});

test("CLI: modo report NUNCA falla aunque haya candidatos; enforce sí (no conectado a CI)", () => {
  const root = makeTree();
  const run = (mode) => spawnSync(process.execPath, [SCRIPT, `--src=${root}`, `--allowlist=${path.join(root, "none.json")}`, `--mode=${mode}`], { encoding: "utf8" });
  const report = run("report");
  assert.equal(report.status, 0);
  assert.match(report.stdout, /::notice title=ResourceScope \(informativo\)/);
  assert.equal(run("enforce").status, 1);
  assert.equal(spawnSync(process.execPath, [SCRIPT, `--src=${root}`, `--allowlist=${path.join(root, "none.json")}`], { encoding: "utf8" }).status, 0); // por defecto = report
});

test("CLI: si el inventario no puede generarse, el modo report sale en 0 con un warning", () => {
  const res = spawnSync(process.execPath, [SCRIPT, "--src=/ruta/que/no/existe", "--mode=report"], { encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /::warning title=ResourceScope inventario/);
});

test("sobre el repo real: produce un inventario y no falla (informativo)", () => {
  const res = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /ResourceScope — inventario de endpoints/);
  assert.match(res.stdout, /Controllers: \d+ · rutas con identificador de recurso: \d+/);
});
