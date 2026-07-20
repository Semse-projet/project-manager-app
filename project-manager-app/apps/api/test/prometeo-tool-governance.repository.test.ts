import test from "node:test";
import assert from "node:assert/strict";
import { ToolGovernanceRepository } from "../dist/modules/prometeo/tool-governance/tool-governance.repository.js";

test("T-022: recordInvocation writes to prometeoToolInvocationAudit with the given fields", async () => {
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    prometeoToolInvocationAudit: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: "audit_1", ...data };
      },
    },
  };
  const repository = new ToolGovernanceRepository(prisma as never);

  await repository.recordInvocation({
    tenantId: "tenant_1",
    actorId: "usr_1",
    namespace: "time_tracker",
    name: "get_status",
    mode: "read",
    status: "succeeded",
    requestId: "req_1",
  });

  assert.equal(created.length, 1);
  assert.equal(created[0]?.tenantId, "tenant_1");
  assert.equal(created[0]?.namespace, "time_tracker");
  assert.equal(created[0]?.status, "succeeded");
  assert.equal(created[0]?.blockedReason, undefined);
});

test("T-023: recordInvocation is a no-op (does not throw) when no PrismaService is injected", async () => {
  const repository = new ToolGovernanceRepository();

  await repository.recordInvocation({
    tenantId: "tenant_1",
    actorId: "usr_1",
    namespace: "time_tracker",
    name: "get_status",
    mode: "read",
    status: "succeeded",
    requestId: "req_1",
  });
  // no assertion needed beyond "did not throw" — this is the same @Optional()
  // degrade-gracefully pattern used by OutboxRepository elsewhere in this repo.
});
