import assert from "node:assert/strict";
import test from "node:test";

import { LaborEngineRepository } from "../dist/modules/labor-engine/labor-engine.repository.js";

test("createTimeEntry clamps negative break minutes before calculating and persisting payable duration (2.8)", async () => {
  let persisted: Record<string, unknown> | undefined;
  const prisma = {
    timeEntry: {
      async create({ data }: { data: Record<string, unknown> }) {
        persisted = data;
        return data;
      },
    },
  };
  const repository = new LaborEngineRepository(prisma as never);

  const entry = await repository.createTimeEntry({
    tenantId: "tenant_1",
    orgId: "org_1",
    createdBy: "worker_1",
    mode: "manual",
    purpose: "job_linked",
    jobId: "job_1",
    startedAt: new Date("2026-07-23T09:00:00.000Z"),
    endedAt: new Date("2026-07-23T13:00:00.000Z"),
    breakMinutes: -30,
  });

  assert.equal(persisted?.breakMinutes, 0);
  assert.equal(persisted?.durationMinutes, 240);
  assert.equal(persisted?.accumulatedSeconds, 14_400);
  assert.equal(entry.breakMinutes, 0);
  assert.equal(entry.durationMinutes, 240);
});
