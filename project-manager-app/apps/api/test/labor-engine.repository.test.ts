import assert from "node:assert/strict";
import test from "node:test";

import { LaborEngineRepository } from "../dist/modules/labor-engine/labor-engine.repository.js";
import { NATIONAL_BASELINE_HOURLY_RATE } from "../dist/modules/pricing/contractor-rate.service.js";

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

test("getTeamSummary ignores untrusted historical rate/currency values (2.10)", async () => {
  const startedAt = new Date("2026-07-21T09:00:00.000Z");
  const prisma = {
    timeEntry: {
      async findMany() {
        return [
          { createdBy: "worker_1", durationMinutes: 60, hourlyRate: 85, currency: "USD", startedAt },
          { createdBy: "worker_1", durationMinutes: 60, hourlyRate: -25, currency: "USD", startedAt },
          { createdBy: "worker_1", durationMinutes: 60, hourlyRate: 999_999, currency: "USD", startedAt },
          { createdBy: "worker_1", durationMinutes: 60, hourlyRate: 85, currency: "MXN", startedAt },
        ];
      },
    },
  };
  const repository = new LaborEngineRepository(prisma as never);

  const [summary] = await repository.getTeamSummary({
    tenantId: "tenant_1",
    from: new Date("2026-07-21T00:00:00.000Z"),
    to: new Date("2026-07-22T00:00:00.000Z"),
  });

  assert.equal(summary?.totalMinutes, 240);
  assert.equal(
    summary?.knownCost,
    Math.round(NATIONAL_BASELINE_HOURLY_RATE * 4 * 100) / 100,
  );
  assert.equal(summary?.minutesWithoutRate, 0);
});
