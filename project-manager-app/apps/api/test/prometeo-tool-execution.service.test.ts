import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";

function actor(overrides: Partial<{ roles: string[] }> = {}) {
  return {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "usr_1",
    roles: overrides.roles ?? ["CLIENT"],
  };
}

function makeService() {
  // None of the injected collaborators are exercised when the policy denies
  // before reaching the execution switch.
  return new PrometeoToolExecutionService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

test("T-013: invokeReadTool rejects with 403 when the actor lacks the tool's declared permission, even though agents:run:create already passed the controller gate", async () => {
  const service = makeService();

  // CLIENT does not hold field-ops:read in rbac.ts, so time_tracker.get_status must be denied here.
  await assert.rejects(
    () => service.invokeReadTool(actor({ roles: ["CLIENT"] }) as never, "req_1", {
      namespace: "time_tracker",
      name: "get_status",
      input: {},
    }),
    ForbiddenException,
  );
});

test("T-013b: invokeReadTool still rejects unknown tools with a 400, not silently allowing them through the policy check", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.invokeReadTool(actor() as never, "req_1", {
      namespace: "does_not",
      name: "exist",
      input: {},
    }),
    /Unknown Prometeo tool/,
  );
});

test("T-013c: invokeReadTool still rejects write/critical tools before the policy check even runs", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.invokeReadTool(actor({ roles: ["OPS_ADMIN"] }) as never, "req_1", {
      namespace: "payments",
      name: "propose_release",
      input: { milestoneId: "m_1" },
    }),
    /Prometeo P1 can only invoke read tools/,
  );
});
