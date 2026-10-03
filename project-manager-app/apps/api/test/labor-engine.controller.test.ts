import test from "node:test";
import assert from "node:assert/strict";
import { LaborEngineController } from "../dist/modules/labor-engine/labor-engine.controller.js";

function makeReq() {
  return {
    headers: { "x-request-id": "req_labor_rate_boundary" },
    authContext: {
      tenantId: "tenant-session",
      orgId: "org-session",
      userId: "worker-session",
      roles: ["PRO"],
    },
  };
}

void test("manual entry ignores client-supplied hourlyRate and currency", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const controller = new LaborEngineController(
    {
      async createManualEntry(input: Record<string, unknown>) {
        calls.push(input);
        return { id: "entry-1" };
      },
    } as never,
    {} as never,
  );

  await controller.createManual(makeReq() as never, {
    date: "2026-07-25",
    startTime: "09:00",
    endTime: "10:00",
    purpose: "payable",
    freeProjectId: "fp-1",
    hourlyRate: 999_999,
    currency: "BTC",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.tenantId, "tenant-session");
  assert.equal(calls[0]?.createdBy, "worker-session");
  assert.equal("hourlyRate" in calls[0]!, false);
  assert.equal("currency" in calls[0]!, false);
});
