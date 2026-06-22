import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { ChangeOrdersController } from "../dist/modules/change-orders/change-orders.controller.js";
import { ChangeOrdersService } from "../dist/modules/change-orders/change-orders.service.js";

function createService() {
  const rows = new Map<string, Record<string, unknown>>([
    ["co_1", {
      id: "co_1",
      tenantId: "tenant_1",
      status: "approved",
      title: "Scope expansion",
      trigger: "client requested extra circuits",
      description: "Add circuits for the new mini split",
      pricingMode: "time_and_materials",
      estimatedMin: 1200,
      estimatedMax: 1800,
      probability: 65,
      jobId: "job_1",
      buildOpsProjectId: "bop_1",
      milestoneId: "ms_1",
    }],
    ["co_applied", {
      id: "co_applied",
      tenantId: "tenant_1",
      status: "applied",
      title: "Already applied",
      trigger: "damage discovered",
      description: "",
      pricingMode: "fixed",
      estimatedMin: 500,
      estimatedMax: 800,
      probability: 10,
      jobId: "job_1",
      buildOpsProjectId: "bop_1",
      milestoneId: "ms_1",
    }],
  ]);

  const prisma = {
    changeOrderCandidate: {
      async findMany() {
        return [...rows.values()];
      },
      async create({ data }: { data: Record<string, unknown> }) {
        rows.set(String(data.id), data);
        return data;
      },
      async findFirst({ where }: { where: { id: string; tenantId: string } }) {
        const row = rows.get(where.id);
        if (!row || row.tenantId !== where.tenantId) return null;
        return row;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = rows.get(where.id);
        if (!row) throw new Error("missing row");
        const next = { ...row, ...data };
        rows.set(where.id, next);
        return next;
      },
    },
  };

  return {
    service: new ChangeOrdersService(prisma as never, undefined, undefined),
    rows,
  };
}

test("change-orders controller declares permissions and wraps responses", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const controller = new ChangeOrdersController({
    async list(actor: Record<string, unknown>, input: Record<string, unknown>) {
      calls.push({ method: "list", actor, input });
      return [{ id: "co_1", status: "predicted" }];
    },
    async create(actor: Record<string, unknown>, input: Record<string, unknown>) {
      calls.push({ method: "create", actor, input });
      return { id: "co_2", status: "predicted" };
    },
    async submit(actor: Record<string, unknown>, id: string) {
      calls.push({ method: "submit", actor, id });
      return { id, status: "submitted" };
    },
    async approve(actor: Record<string, unknown>, id: string, clientNote?: string) {
      calls.push({ method: "approve", actor, id, clientNote });
      return { id, status: "approved" };
    },
    async reject(actor: Record<string, unknown>, id: string, note?: string) {
      calls.push({ method: "reject", actor, id, note });
      return { id, status: "rejected" };
    },
    async findOne(actor: Record<string, unknown>, id: string) {
      calls.push({ method: "findOne", actor, id });
      return { id, status: "submitted" };
    },
    async requestChanges(actor: Record<string, unknown>, id: string, body: Record<string, unknown>) {
      calls.push({ method: "requestChanges", actor, id, body });
      return { id, status: "changes_requested" };
    },
    async computeImpact(actor: Record<string, unknown>, id: string) {
      calls.push({ method: "impact", actor, id });
      return { changeOrderId: id, status: "submitted", costDeltaMin: 0, costDeltaMax: 0, costDeltaAvg: 0, affectedMilestones: [], riskLevel: "low", paymentImpact: "none", probability: null, pricingMode: "fixed", auditReason: "ok", computedAt: "2026-06-09T12:00:00.000Z" };
    },
    async applyToBuildOps(actor: Record<string, unknown>, id: string) {
      calls.push({ method: "apply", actor, id });
      return { applied: true, alreadyApplied: false, impact: { changeOrderId: id, status: "approved", costDeltaMin: 0, costDeltaMax: 0, costDeltaAvg: 0, affectedMilestones: [], riskLevel: "low", paymentImpact: "none", probability: null, pricingMode: "fixed", auditReason: "ok", computedAt: "2026-06-09T12:00:00.000Z" } };
    },
    async runRiskAgent(actor: Record<string, unknown>, id: string) {
      calls.push({ method: "risk", actor, id });
      return { riskLevel: "low", summary: "ok", flags: [], recommendation: "ok", confidence: 0.9, analyzedAt: "2026-06-09T12:00:00.000Z" };
    },
  } as never);

  const expectations: Array<[string, string]> = [
    ["list", "change-orders:read"],
    ["create", "change-orders:create"],
    ["submit", "change-orders:create"],
    ["approve", "change-orders:approve"],
    ["reject", "change-orders:approve"],
    ["findOne", "change-orders:read"],
    ["requestChanges", "change-orders:approve"],
    ["getImpact", "change-orders:read"],
    ["applyToBuildOps", "change-orders:approve"],
    ["runRiskAgent", "change-orders:read"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, ChangeOrdersController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }

  const actor = {
    headers: { "x-request-id": "req_co_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_client_1", userId: "usr_client_1", roles: ["CLIENT"] },
  };

  const created = await controller.create(actor as never, { title: "Extra scope", trigger: "hidden damage", jobId: "job_1" });
  assert.equal(created.requestId, "req_co_1");
  assert.equal(created.data.status, "predicted");
  assert.equal(calls[0]?.method, "create");

  const impacted = await controller.getImpact(actor as never, "co_1");
  assert.equal(impacted.data.changeOrderId, "co_1");
});

test("change-orders service rejects cross-tenant access and keeps apply idempotent", async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.findOne({ tenantId: "tenant_2", userId: "usr_1", orgId: "org_1", roles: ["CLIENT"] }, "co_1"),
    NotFoundException
  );

  const applied = await service.applyToBuildOps({ tenantId: "tenant_1", userId: "usr_1", orgId: "org_1", roles: ["CLIENT"] }, "co_applied");
  assert.equal(applied.alreadyApplied, true);
  assert.equal(applied.applied, false);
});
