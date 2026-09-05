import test from "node:test";
import assert from "node:assert/strict";
import { BudgetIntelligenceService } from "../dist/modules/intelligence/budget-intelligence.service.js";

const SIMILAR_JOBS = [
  { budgetMin: 1000, budgetMax: 1400, title: "Reparación de tubería de cocina", category: "plumbing" },
  { budgetMin: 900, budgetMax: 1300, title: "Reparación de tubería de baño", category: "plumbing" },
  { budgetMin: 1100, budgetMax: 1500, title: "Reparación de fuga de tubería", category: "plumbing" },
];

function createGatewayStub() {
  return { async generate() { throw new Error("no AI in unit tests"); } };
}

function createPrismaStub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    job: {
      async findMany() {
        return SIMILAR_JOBS;
      },
      async findFirst(args: { where: { id: string; tenantId: string } }) {
        return (overrides.jobLookup as ((args: unknown) => unknown) | undefined)?.(args) ?? null;
      },
    },
  };
}

function createContractorRateStub(overrideByUserId: Record<string, { laborRatePerHr: number; laborMultiplier: number }>) {
  return {
    async getOverride(userId: string) {
      const found = overrideByUserId[userId];
      if (!found) return null;
      return {
        userId,
        laborRatePerHr: found.laborRatePerHr,
        materialMarkup: 0,
        laborMultiplier: found.laborMultiplier,
        materialMultiplier: 1,
        updatedAt: new Date().toISOString(),
      };
    },
  };
}

void test("suggestBudget applies the assigned professional's real rate when jobId resolves to an owned job with a contract", async () => {
  const prisma = createPrismaStub({
    jobLookup: () => ({ clientOrgId: "org_client_1", contract: { professionalUserId: "pro_1" } }),
  });
  const contractorRate = createContractorRateStub({ pro_1: { laborRatePerHr: 60, laborMultiplier: 1.5 } });
  const service = new BudgetIntelligenceService(prisma as never, createGatewayStub() as never, undefined, contractorRate as never);

  const result = await service.suggestBudget({
    tenantId: "tnt", userId: "usr_client", orgId: "org_client_1", roles: ["CLIENT"],
    title: "Reparación de tubería", scope: "Fuga en la cocina", category: "plumbing",
    jobId: "job_1",
  });

  const factor = result.factors.find((f) => f.name === "Tarifa real del profesional asignado");
  assert.ok(factor, "should add a factor explaining the rate adjustment");
  assert.equal(factor!.impact, "increases");
});

void test("suggestBudget skips the rate adjustment when the caller doesn't own the job (different org, not OPS_ADMIN)", async () => {
  const prisma = createPrismaStub({
    jobLookup: () => ({ clientOrgId: "org_someone_else", contract: { professionalUserId: "pro_1" } }),
  });
  const contractorRate = createContractorRateStub({ pro_1: { laborRatePerHr: 60, laborMultiplier: 1.5 } });
  const service = new BudgetIntelligenceService(prisma as never, createGatewayStub() as never, undefined, contractorRate as never);

  const result = await service.suggestBudget({
    tenantId: "tnt", userId: "usr_client", orgId: "org_client_1", roles: ["CLIENT"],
    title: "Reparación de tubería", scope: "Fuga en la cocina", category: "plumbing",
    jobId: "job_1",
  });

  assert.equal(result.factors.some((f) => f.name === "Tarifa real del profesional asignado"), false);
});

void test("suggestBudget skips the rate adjustment when OPS_ADMIN requests it regardless of org", async () => {
  const prisma = createPrismaStub({
    jobLookup: () => ({ clientOrgId: "org_someone_else", contract: { professionalUserId: "pro_1" } }),
  });
  const contractorRate = createContractorRateStub({ pro_1: { laborRatePerHr: 30, laborMultiplier: 0.75 } });
  const service = new BudgetIntelligenceService(prisma as never, createGatewayStub() as never, undefined, contractorRate as never);

  const result = await service.suggestBudget({
    tenantId: "tnt", userId: "usr_admin", orgId: "org_admin", roles: ["OPS_ADMIN"],
    title: "Reparación de tubería", scope: "Fuga en la cocina", category: "plumbing",
    jobId: "job_1",
  });

  const factor = result.factors.find((f) => f.name === "Tarifa real del profesional asignado");
  assert.ok(factor, "OPS_ADMIN should see the adjustment even for a job outside their own org");
  assert.equal(factor!.impact, "decreases");
});

void test("suggestBudget skips the rate adjustment when the job has no contract yet (no assigned professional)", async () => {
  const prisma = createPrismaStub({
    jobLookup: () => ({ clientOrgId: "org_client_1", contract: null }),
  });
  const contractorRate = createContractorRateStub({});
  const service = new BudgetIntelligenceService(prisma as never, createGatewayStub() as never, undefined, contractorRate as never);

  const result = await service.suggestBudget({
    tenantId: "tnt", userId: "usr_client", orgId: "org_client_1", roles: ["CLIENT"],
    title: "Reparación de tubería", scope: "Fuga en la cocina", category: "plumbing",
    jobId: "job_1",
  });

  assert.equal(result.factors.some((f) => f.name === "Tarifa real del profesional asignado"), false);
});

void test("suggestBudget without a jobId behaves exactly as before (no rate adjustment attempted)", async () => {
  const prisma = createPrismaStub();
  const service = new BudgetIntelligenceService(prisma as never, createGatewayStub() as never);

  const result = await service.suggestBudget({
    tenantId: "tnt", userId: "usr_client",
    title: "Reparación de tubería", scope: "Fuga en la cocina", category: "plumbing",
  });

  assert.equal(result.factors.some((f) => f.name === "Tarifa real del profesional asignado"), false);
});
