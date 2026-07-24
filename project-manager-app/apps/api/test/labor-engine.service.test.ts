import test from "node:test";
import assert from "node:assert/strict";
import { LaborEngineService } from "../dist/modules/labor-engine/labor-engine.service.js";

type Call = { method: string; args: unknown[] };

function createRepoStub(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: Call[] = [];
  const record = (method: string, args: unknown[], result: unknown) => {
    calls.push({ method, args });
    return result;
  };
  const repo = {
    calls,
    async getActiveTimeEntry(...args: unknown[]) {
      return record("getActiveTimeEntry", args, null);
    },
    async startRealtimeEntry(...args: unknown[]) {
      return record("startRealtimeEntry", args, { id: "te1", status: "running" });
    },
    async pauseTimeEntry(...args: unknown[]) {
      return record("pauseTimeEntry", args, { id: "te1", status: "paused" });
    },
    async resumeTimeEntry(...args: unknown[]) {
      return record("resumeTimeEntry", args, { id: "te1", status: "running" });
    },
    async stopTimeEntry(...args: unknown[]) {
      return record("stopTimeEntry", args, { id: "te1", status: "completed" });
    },
    async updateTimeEntryNotes(...args: unknown[]) {
      return record("updateTimeEntryNotes", args, { id: "te1", notes: args[3] });
    },
    async createTimeEntry(...args: unknown[]) {
      return record("createTimeEntry", args, { id: "te2", mode: "manual" });
    },
    async listActiveEntriesForTenant(...args: unknown[]) {
      return record("listActiveEntriesForTenant", args, []);
    },
    async getTeamSummary(...args: unknown[]) {
      return record("getTeamSummary", args, []);
    },
    async listLongEntries(...args: unknown[]) {
      return record("listLongEntries", args, []);
    },
    // 2.9 — ownership checks added to startTimer/createManualEntry. Default
    // stubs simulate "job/free project belongs to this tenant and worker" so
    // existing happy-path tests keep exercising the same behavior; tests that
    // want to exercise the IDOR rejection path can override these to return
    // null.
    async findJobForLaborEntry(...args: unknown[]) {
      return record("findJobForLaborEntry", args, { id: (args[0] as { jobId?: string })?.jobId ?? "job-stub" });
    },
    async findFreeProjectForLaborEntry(...args: unknown[]) {
      return record("findFreeProjectForLaborEntry", args, { id: (args[0] as { freeProjectId?: string })?.freeProjectId ?? "fp-stub" });
    },
    ...overrides,
  };
  return repo;
}

function createService(overrides: Partial<Record<string, unknown>> = {}) {
  const repo = createRepoStub(overrides);
  const service = new LaborEngineService(repo as never);
  return { service, repo };
}

void test("startTimer rejects when an active timer already exists", async () => {
  const { service } = createService({
    async getActiveTimeEntry() {
      return { id: "te0", status: "running" };
    },
  });

  await assert.rejects(
    service.startTimer({ tenantId: "tnt", orgId: "org", createdBy: "user-1", purpose: "personal" }),
    /active timer/i,
  );
});

void test("startTimer rejects job_linked purpose without jobId or freeProjectId", async () => {
  const { service } = createService();

  await assert.rejects(
    service.startTimer({ tenantId: "tnt", orgId: "org", createdBy: "user-1", purpose: "job_linked" }),
    /job_linked/,
  );
});

void test("startTimer starts a realtime entry for valid input", async () => {
  const { service, repo } = createService();

  const result = await service.startTimer({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "payable",
    freeProjectId: "fp1",
  });

  assert.equal((result as { id: string }).id, "te1");
  const startCall = repo.calls.find((call) => call.method === "startRealtimeEntry");
  assert.ok(startCall, "should call startRealtimeEntry");
});

void test("startTimer rejects a jobId not assigned to this worker (2.9 IDOR)", async () => {
  const { service } = createService({
    async findJobForLaborEntry() {
      return null;
    },
  });

  await assert.rejects(
    service.startTimer({
      tenantId: "tnt",
      orgId: "org",
      createdBy: "user-1",
      purpose: "job_linked",
      jobId: "job-not-mine",
    }),
    /not assigned/i,
  );
});

void test("createManualEntry rejects a freeProjectId not owned by this worker (2.9 IDOR)", async () => {
  const { service } = createService({
    async findFreeProjectForLaborEntry() {
      return null;
    },
  });

  await assert.rejects(
    service.createManualEntry({
      tenantId: "tnt",
      orgId: "org",
      createdBy: "user-1",
      purpose: "job_linked",
      freeProjectId: "fp-not-mine",
      date: "2026-07-08",
      startTime: "09:00",
      endTime: "13:00",
    }),
    /not found/i,
  );
});

void test("pause/resume/stop/updateNotes scope by owner (createdBy)", async () => {
  const { service, repo } = createService();

  await service.pauseTimer("te1", "tnt", "user-1");
  await service.resumeTimer("te1", "tnt", "user-1");
  await service.stopTimer("te1", "tnt", "user-1", "cierre de jornada");
  await service.updateTimerNotes("te1", "tnt", "user-1", "nota actualizada");

  const byMethod = new Map(repo.calls.map((call) => [call.method, call.args]));
  assert.deepEqual(byMethod.get("pauseTimeEntry"), ["te1", "tnt", "user-1"]);
  assert.deepEqual(byMethod.get("resumeTimeEntry"), ["te1", "tnt", "user-1"]);
  assert.deepEqual(byMethod.get("stopTimeEntry"), ["te1", "tnt", "user-1", "cierre de jornada"]);
  assert.deepEqual(byMethod.get("updateTimeEntryNotes"), ["te1", "tnt", "user-1", "nota actualizada"]);
});

void test("createManualEntry rejects invalid time ranges", async () => {
  const { service } = createService();

  await assert.rejects(
    service.createManualEntry({
      tenantId: "tnt",
      orgId: "org",
      createdBy: "user-1",
      purpose: "personal",
      date: "2026-07-08",
      startTime: "13:00",
      endTime: "09:00",
    }),
    /endTime/,
  );
});

void test("createManualEntry rolls endedAt to the next day for a real overnight shift", async () => {
  const { service, repo } = createService();

  const entry = await service.createManualEntry({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "personal",
    date: "2026-07-08",
    startTime: "22:00",
    endTime: "06:00",
  });

  assert.ok(entry);
  const createCall = repo.calls.find((c) => c.method === "createTimeEntry");
  assert.ok(createCall);
  const input = createCall!.args[0] as { startedAt: Date; endedAt: Date };
  assert.equal(input.startedAt.toISOString(), new Date("2026-07-08T22:00:00").toISOString());
  assert.equal(input.endedAt.toISOString(), new Date("2026-07-09T06:00:00").toISOString());
});

void test("createManualEntry creates a manual entry with break minutes", async () => {
  const { service, repo } = createService();

  await service.createManualEntry({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "job_linked",
    jobId: "job-9",
    date: "2026-07-08",
    startTime: "09:00",
    endTime: "13:00",
    breakMinutes: 30,
  });

  const createCall = repo.calls.find((call) => call.method === "createTimeEntry");
  assert.ok(createCall, "should call createTimeEntry");
  const payload = createCall.args[0] as Record<string, unknown>;
  assert.equal(payload.mode, "manual");
  assert.equal(payload.jobId, "job-9");
  assert.equal(payload.breakMinutes, 30);
});

void test("getAdminOverview flags stale timers, overtime and long entries", async () => {
  const now = Date.now();
  const { service } = createService({
    async listActiveEntriesForTenant() {
      return [
        {
          id: "te-stale",
          createdBy: "worker-1",
          status: "running",
          startedAt: new Date(now - 14 * 3600 * 1000),
          resumedAt: new Date(now - 13 * 3600 * 1000),
          accumulatedSeconds: 3600,
        },
        {
          id: "te-fresh",
          createdBy: "worker-2",
          status: "running",
          startedAt: new Date(now - 30 * 60 * 1000),
          resumedAt: new Date(now - 30 * 60 * 1000),
          accumulatedSeconds: 0,
        },
      ];
    },
    async getTeamSummary() {
      return [
        { workerId: "worker-1", totalMinutes: 50 * 60, totalEntries: 6, knownCost: 900, minutesWithoutRate: 0 },
        { workerId: "worker-2", totalMinutes: 20 * 60, totalEntries: 3, knownCost: 0, minutesWithoutRate: 20 * 60 },
      ];
    },
    async listLongEntries() {
      return [
        { id: "te-long", createdBy: "worker-3", durationMinutes: 13 * 60 },
      ];
    },
  });

  const overview = await service.getAdminOverview("tnt");

  assert.equal(overview.activeTimers.length, 2);
  assert.equal(overview.team.length, 2);

  const types = overview.alerts.map((alert: { type: string; workerId: string }) => `${alert.type}:${alert.workerId}`);
  assert.ok(types.includes("stale_timer:worker-1"), "should flag the 14h running timer");
  assert.ok(types.includes("overtime:worker-1"), "should flag 50h week as overtime");
  assert.ok(types.includes("long_entry:worker-3"), "should flag the 13h single entry");
  assert.ok(!types.some((t: string) => t.endsWith(":worker-2")), "worker-2 has no alerts");
});

void test("getAdminOverview returns empty alerts for a quiet week", async () => {
  const { service } = createService();
  const overview = await service.getAdminOverview("tnt");
  assert.deepEqual(overview.alerts, []);
  assert.equal(typeof overview.period.from, "string");
  assert.equal(overview.thresholds.staleTimerHours, 12);
});
