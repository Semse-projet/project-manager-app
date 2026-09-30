import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AgentWorkPlanService, planDefinitionFingerprint } from "../dist/modules/agents/agent-work-plan.service.js";

// C46 — plan version + approval bound to the approved definition. Editing
// tools/gates after approval invalidates the approval; execution progress
// (status/timestamps/evidence) does not.

function makeService() {
  let row: any = null;
  const prisma = {
    agentWorkPlan: {
      async create({ data }: any) {
        row = { id: "plan_1", version: 1, approvedAt: null, approvedBy: null, rejectedAt: null, rejectedBy: null, cancelledAt: null, cancelledBy: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        return row;
      },
      async findFirst() { return row; },
      async findUnique() { return row; },
      async update({ data }: any) {
        const { version, ...rest } = data;
        row = { ...row, ...rest, ...(version?.increment ? { version: row.version + version.increment } : {}), updatedAt: new Date() };
        return row;
      },
    },
  };
  return { svc: new AgentWorkPlanService(prisma as never), get: () => row };
}

const baseSteps = [
  { id: "s1", order: 1, title: "Buscar contexto", description: "", expectedOutcome: "", capability: "searching", toolsAllowed: ["read_file"], riskLevel: "low", requiresApproval: false, requiresApprovedPlan: false },
  { id: "s2", order: 2, title: "Redactar", description: "", expectedOutcome: "", capability: "composing", toolsAllowed: ["draft_message"], riskLevel: "low", requiresApproval: false, requiresApprovedPlan: false },
] as any[];

async function createAndApprove() {
  const h = makeService();
  const created = await h.svc.create({ tenantId: "t1", orgId: "o1", createdBy: "u1", agentId: "a1", title: "p", steps: baseSteps } as any);
  assert.equal(created.version, 1);
  assert.equal(created.approvalValid, true);
  const approved = await h.svc.approve({ tenantId: "t1", planId: "plan_1", userId: "u2", orgId: "o1" });
  return { h, approved };
}

test("approve stores a fingerprint of the approved definition and the approval is valid", async () => {
  const { approved } = await createAndApprove();
  assert.match(approved.meta?.approvedDefinitionHash ?? "", /^[0-9a-f]{64}$/);
  assert.equal(approved.approvalValid, true);
  assert.equal(approved.version, 1);
});

test("execution progress does not change version or approval validity", async () => {
  const { h, approved } = await createAndApprove();
  const progressed = approved.steps.map((s) => (s.id === "s1" ? { ...s, status: "completed" as const, completedAt: new Date().toISOString(), evidenceStatus: "satisfied" as const } : s));
  const saved = await h.svc.saveGraph({ tenantId: "t1", planId: "plan_1", steps: progressed, status: "executing" });
  assert.equal(saved.version, 1);
  assert.equal(saved.approvalValid, true);
});

test("changing a step's tools after approval bumps version and invalidates the approval", async () => {
  const { h, approved } = await createAndApprove();
  const tampered = approved.steps.map((s) => (s.id === "s1" ? { ...s, toolsAllowed: [...s.toolsAllowed, "propose_escrow_release"] } : s));
  const saved = await h.svc.saveGraph({ tenantId: "t1", planId: "plan_1", steps: tampered });
  assert.equal(saved.version, 2);
  assert.equal(saved.approvalValid, false);
});

test("reverting to the approved definition restores validity (version still counts the revisions)", async () => {
  const { h, approved } = await createAndApprove();
  const tampered = approved.steps.map((s) => (s.id === "s1" ? { ...s, toolsAllowed: ["read_file", "x"] } : s));
  await h.svc.saveGraph({ tenantId: "t1", planId: "plan_1", steps: tampered });
  const back = await h.svc.saveGraph({ tenantId: "t1", planId: "plan_1", steps: approved.steps });
  assert.equal(back.version, 3);
  assert.equal(back.approvalValid, true);
});

test("legacy approved plan (no stored hash) stays valid", async () => {
  const h = makeService();
  await h.svc.create({ tenantId: "t1", orgId: "o1", createdBy: "u1", agentId: "a1", title: "p", steps: baseSteps } as any);
  const row = h.get();
  row.status = "active";
  row.approvedAt = new Date();
  row.metaJson = null;
  const rec = await h.svc.findById("t1", "plan_1");
  assert.equal(rec.approvalValid, true);
});

test("fingerprint ignores progress fields and step order in the array, reacts to tools/gates", () => {
  const a = planDefinitionFingerprint(baseSteps);
  assert.equal(planDefinitionFingerprint([...baseSteps].reverse()), a);
  assert.equal(planDefinitionFingerprint(baseSteps.map((s) => ({ ...s, status: "completed", completedAt: "x" }))), a);
  assert.notEqual(planDefinitionFingerprint(baseSteps.map((s) => ({ ...s, requiresApprovedPlan: true }))), a);
  assert.notEqual(planDefinitionFingerprint(baseSteps.map((s) => ({ ...s, riskLevel: "high" }))), a);
});
