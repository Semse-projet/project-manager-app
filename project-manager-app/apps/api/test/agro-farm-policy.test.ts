import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { canPerformAgroFarmAction, isProfessionalFarmRole } from "../dist/modules/agro/agro-farm-policy.js";
import { AgroFarmAccessService } from "../dist/modules/agro/agro-farm-access.service.js";
import { hasPermission } from "@semse/auth";

// ── Matriz de política de finca ──────────────────────────────────────────────

test("agro-policy: every farm role can report incidents", () => {
  for (const role of ["OWNER", "MANAGER", "SUPERVISOR", "WORKER", "TECHNICIAN", "SPECIALIST", "VETERINARIAN", "AGRONOMIST"] as const) {
    assert.equal(canPerformAgroFarmAction(role, "incident.report"), true, role);
  }
});

test("agro-policy: no role → nothing allowed", () => {
  assert.equal(canPerformAgroFarmAction(null, "incident.read"), false);
});

test("agro-policy: worker cannot triage, assign, close or verify", () => {
  for (const action of ["incident.triage", "incident.assign", "incident.close", "incident.reopen", "capability.verify", "workforce.assign", "members.manage"] as const) {
    assert.equal(canPerformAgroFarmAction("WORKER", action), false, action);
  }
});

test("agro-policy: supervisor can assign and close but not manage members", () => {
  assert.equal(canPerformAgroFarmAction("SUPERVISOR", "incident.assign"), true);
  assert.equal(canPerformAgroFarmAction("SUPERVISOR", "incident.close"), true);
  assert.equal(canPerformAgroFarmAction("SUPERVISOR", "members.manage"), false);
});

test("agro-policy: worker can start/resolve only when assignee", () => {
  assert.equal(canPerformAgroFarmAction("WORKER", "incident.resolve"), false);
  assert.equal(canPerformAgroFarmAction("WORKER", "incident.resolve", { isAssignee: true }), true);
  assert.equal(canPerformAgroFarmAction("WORKER", "incident.start", { isAssignee: true }), true);
  // isAssignee no abre acciones distintas de start/resolve
  assert.equal(canPerformAgroFarmAction("WORKER", "incident.close", { isAssignee: true }), false);
});

test("agro-policy: professional assessment is only for professional roles (not owner)", () => {
  assert.equal(canPerformAgroFarmAction("VETERINARIAN", "incident.assess"), true);
  assert.equal(canPerformAgroFarmAction("AGRONOMIST", "incident.assess"), true);
  assert.equal(canPerformAgroFarmAction("OWNER", "incident.assess"), false);
  assert.equal(canPerformAgroFarmAction("SUPERVISOR", "incident.assess"), false);
});

test("agro-policy: professional capabilities verifiable only by professionals", () => {
  assert.equal(canPerformAgroFarmAction("VETERINARIAN", "capability.verify_professional"), true);
  assert.equal(canPerformAgroFarmAction("OWNER", "capability.verify_professional"), false);
  assert.equal(canPerformAgroFarmAction("OWNER", "capability.verify"), true);
  assert.equal(isProfessionalFarmRole("TECHNICIAN"), true);
  assert.equal(isProfessionalFarmRole("WORKER"), false);
});

// ── RBAC: permisos Agro nuevos ───────────────────────────────────────────────

test("agro-rbac: WORKER can read and report Agro but not write or verify", () => {
  assert.equal(hasPermission(["WORKER"], "agro:read"), true);
  assert.equal(hasPermission(["WORKER"], "agro:report"), true);
  assert.equal(hasPermission(["WORKER"], "agro:write"), false);
  assert.equal(hasPermission(["WORKER"], "agro:workforce:verify"), false);
  assert.equal(hasPermission(["FIELD_WORKER"], "agro:report"), true);
});

test("agro-rbac: catalog admin only for OPS_ADMIN; DEMO_AGRO stays agro-only", () => {
  assert.equal(hasPermission(["OPS_ADMIN"], "agro:workforce:admin"), true);
  assert.equal(hasPermission(["CLIENT"], "agro:workforce:admin"), false);
  assert.equal(hasPermission(["PRO"], "agro:workforce:verify"), true);
  // T-050: la demo sigue operando tareas/movimientos, que ahora piden agro:report.
  assert.equal(hasPermission(["DEMO_AGRO"], "agro:report"), true);
  assert.equal(hasPermission(["DEMO_AGRO"], "agro:workforce:verify"), false);
  for (const p of ["jobs:read", "payments:connect:self", "matching:read", "evidence:write"]) {
    assert.equal(hasPermission(["DEMO_AGRO"], p), false, p);
  }
});

// ── AgroFarmAccessService ────────────────────────────────────────────────────

function makePrisma(members: Array<{ farmId: string; userId: string; role: string; status: string }>) {
  return {
    agroFarm: { findUnique: async ({ where }: any) => (where.id === "farm_1" ? { ownerId: "owner" } : null) },
    agroFarmMember: {
      findUnique: async ({ where }: any) =>
        members.find((m) => m.farmId === where.farmId_userId.farmId && m.userId === where.farmId_userId.userId) ?? null,
    },
  } as never;
}

test("agro-access: owner resolves as OWNER", async () => {
  const svc = new AgroFarmAccessService(makePrisma([]));
  assert.equal(await svc.resolveRole("farm_1", "owner"), "OWNER");
});

test("agro-access: active member resolves to its role; suspended/revoked do not", async () => {
  const svc = new AgroFarmAccessService(makePrisma([
    { farmId: "farm_1", userId: "w1", role: "WORKER", status: "ACTIVE" },
    { farmId: "farm_1", userId: "w2", role: "SUPERVISOR", status: "SUSPENDED" },
    { farmId: "farm_1", userId: "w3", role: "WORKER", status: "REVOKED" },
  ]));
  assert.equal(await svc.resolveRole("farm_1", "w1"), "WORKER");
  assert.equal(await svc.resolveRole("farm_1", "w2"), null);
  assert.equal(await svc.resolveRole("farm_1", "w3"), null);
});

test("agro-access: non-member gets 404 (existence not leaked), member without right gets 403", async () => {
  const svc = new AgroFarmAccessService(makePrisma([{ farmId: "farm_1", userId: "w1", role: "WORKER", status: "ACTIVE" }]));
  await assert.rejects(() => svc.requireMember("farm_1", "stranger"), NotFoundException);
  await assert.rejects(() => svc.requireMember("farm_unknown", "owner"), NotFoundException);
  await assert.rejects(() => svc.require("farm_1", "w1", "incident.assign"), ForbiddenException);
  const actor = await svc.require("farm_1", "w1", "incident.report");
  assert.equal(actor.role, "WORKER");
});

// ── T-050: operación diaria de la finca ──────────────────────────────────────

test("agro-policy T-050: workers operate the field but not structure or finances", () => {
  for (const a of ["farm.read", "animal.operate", "evidence.create", "inventory.consume"] as const) {
    assert.equal(canPerformAgroFarmAction("WORKER", a), true, a);
  }
  for (const a of ["farm.manage", "farm.finance", "farm.audit_read", "task.create", "task.update", "animal.status", "inventory.manage", "evidence.update_any"] as const) {
    assert.equal(canPerformAgroFarmAction("WORKER", a), false, a);
  }
});

test("agro-policy T-050: task execution — supervisors any, workers only own/unassigned", () => {
  assert.equal(canPerformAgroFarmAction("SUPERVISOR", "task.execute"), true);
  assert.equal(canPerformAgroFarmAction("WORKER", "task.execute"), false);
  assert.equal(canPerformAgroFarmAction("WORKER", "task.execute", { isAssignee: true }), true);
  // isAssignee no abre cancelar/editar
  assert.equal(canPerformAgroFarmAction("WORKER", "task.update", { isAssignee: true }), false);
});

test("agro-policy: finances for owner and manager only; vet may change animal status", () => {
  assert.equal(canPerformAgroFarmAction("OWNER", "farm.finance"), true);
  assert.equal(canPerformAgroFarmAction("MANAGER", "farm.finance"), true);
  for (const role of ["SUPERVISOR", "WORKER", "TECHNICIAN", "SPECIALIST", "VETERINARIAN", "AGRONOMIST"] as const) {
    assert.equal(canPerformAgroFarmAction(role, "farm.finance"), false, role);
  }
  assert.equal(canPerformAgroFarmAction("VETERINARIAN", "animal.status"), true);
  assert.equal(canPerformAgroFarmAction("AGRONOMIST", "animal.status"), false);
  assert.equal(canPerformAgroFarmAction("MANAGER", "farm.manage"), true);
  assert.equal(canPerformAgroFarmAction("SUPERVISOR", "farm.manage"), false);
});
