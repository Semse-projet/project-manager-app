/**
 * F1 Automaton / Plan Mode: real PostgreSQL transaction and serialization gates.
 * Runs only in the isolated API Integration job after migrations. No Railway.
 * Unlike test doubles, this proves the rollback and cross-request invariants
 * of AgentWorkPlanService.createReplacingActivePlan().
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AgentWorkPlanService } from "../dist/modules/agents/agent-work-plan.service.js";

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const prisma = new PrismaClient();
const plans = new AgentWorkPlanService(prisma as never);
const id = (prefix: string) => prefix + "_" + randomUUID().replaceAll("-", "");

function step(stepId: string, dependencies: string[] = []) {
  return {
    id: stepId,
    order: 1,
    title: stepId,
    description: "",
    expectedOutcome: "",
    capability: "searching" as const,
    toolsAllowed: ["read_file"],
    riskLevel: "low" as const,
    requiresApproval: false,
    requiresApprovedPlan: false,
    dependsOnStepIds: dependencies,
  };
}

async function fixture() {
  const tenantId = id("ten");
  const projectId = id("project");
  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Test Plan Replacement" } });
  async function oldPlan(status: "draft" | "active" | "executing") {
    return prisma.agentWorkPlan.create({
      data: {
        tenantId, orgId: "org_synthetic", projectId,
        createdBy: "user_synthetic", agentId: "prometeo",
        title: "Historical " + status, status,
        stepsJson: [],
      },
    });
  }
  const input = (title: string | null) => ({
    tenantId, orgId: "org_synthetic", projectId,
    createdBy: "user_synthetic", agentId: "prometeo",
    title, steps: [step("inspect"), step("review", ["inspect"])],
  });
  async function cleanup() {
    await prisma.agentWorkPlan.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  }
  return { tenantId, projectId, oldPlan, input, cleanup };
}

dbTest("PostgreSQL: replacement cancels every legacy active plan and leaves one new draft", async () => {
  const f = await fixture();
  try {
    const first = await f.oldPlan("draft");
    const second = await f.oldPlan("active");
    const result = await plans.createReplacingActivePlan(f.input("New plan") as never);
    assert.deepEqual(new Set(result.archived.map((p) => p.id)), new Set([first.id, second.id]));
    const rows = await prisma.agentWorkPlan.findMany({
      where: { tenantId: f.tenantId, projectId: f.projectId },
    });
    assert.equal(rows.length, 3);
    assert.equal(rows.filter((p) => p.status === "cancelled").length, 2);
    assert.deepEqual(rows.filter((p) => p.status === "draft").map((p) => p.id), [result.created.id]);
  } finally {
    await f.cleanup();
  }
});

dbTest("PostgreSQL: insertion failure rolls back archive of an existing active plan", async () => {
  const f = await fixture();
  try {
    const old = await f.oldPlan("active");
    // Required title deliberately invalid: Prisma raises inside the same
    // transaction after UPDATE, proving PostgreSQL reverses that UPDATE.
    await assert.rejects(plans.createReplacingActivePlan(f.input(null) as never));
    const saved = await prisma.agentWorkPlan.findMany({
      where: { tenantId: f.tenantId, projectId: f.projectId },
    });
    assert.equal(saved.length, 1, "failed replacement must not create a new plan");
    assert.equal(saved[0]?.id, old.id);
    assert.equal(saved[0]?.status, "active", "cancel update must roll back");
    assert.equal(saved[0]?.cancelledAt, null);
  } finally {
    await f.cleanup();
  }
});

dbTest("PostgreSQL: two concurrent replacements never leave two active plans", async () => {
  const f = await fixture();
  try {
    const old = await f.oldPlan("executing");
    const outcomes = await Promise.allSettled([
      plans.createReplacingActivePlan(f.input("Concurrent A") as never),
      plans.createReplacingActivePlan(f.input("Concurrent B") as never),
    ]);
    assert.ok(outcomes.some((o) => o.status === "fulfilled"));
    for (const result of outcomes) {
      if (result.status === "rejected") {
        assert.equal(result.reason?.getStatus?.(), 409, "only a safe bounded serialization conflict may be rejected");
      }
    }
    const live = await prisma.agentWorkPlan.findMany({
      where: {
        tenantId: f.tenantId, projectId: f.projectId,
        status: { in: ["draft", "active", "executing"] },
      },
    });
    assert.equal(live.length, 1, "at most one replacement may remain active");
    const previous = await prisma.agentWorkPlan.findUnique({ where: { id: old.id } });
    assert.equal(previous?.status, "cancelled");
  } finally {
    await f.cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
