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
    async isJobAssignedToWorker(...args: unknown[]) {
      return record("isJobAssignedToWorker", args, true);
    },
    async isFreeProjectOwnedByWorker(...args: unknown[]) {
      return record("isFreeProjectOwnedByWorker", args, true);
    },
    async getJobCoordinates(...args: unknown[]) {
      return record("getJobCoordinates", args, null);
    },
    async getFreeProjectCoordinates(...args: unknown[]) {
      return record("getFreeProjectCoordinates", args, null);
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

void test("startTimer rejects a jobId not assigned to the worker", async () => {
  const { service } = createService({
    async isJobAssignedToWorker() {
      return false;
    },
  });

  await assert.rejects(
    service.startTimer({ tenantId: "tnt", orgId: "org", createdBy: "user-1", purpose: "job_linked", jobId: "job-not-mine" }),
    /not assigned to you/i,
  );
});

void test("createManualEntry rejects a freeProjectId not owned by the worker", async () => {
  const { service } = createService({
    async isFreeProjectOwnedByWorker() {
      return false;
    },
  });

  await assert.rejects(
    service.createManualEntry({
      tenantId: "tnt",
      orgId: "org",
      createdBy: "user-1",
      purpose: "personal",
      freeProjectId: "fp-not-mine",
      date: "2026-07-20",
      startTime: "09:00",
      endTime: "13:00",
    }),
    /does not belong to you/i,
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

void test("createManualEntry rejects a negative hourlyRate", async () => {
  const { service } = createService();

  await assert.rejects(
    service.createManualEntry({
      tenantId: "tnt",
      orgId: "org",
      createdBy: "user-1",
      purpose: "personal",
      date: "2026-07-08",
      startTime: "09:00",
      endTime: "13:00",
      hourlyRate: -30,
    }),
    /hourlyRate/,
  );
});

void test("createManualEntry rejects an absurdly large hourlyRate", async () => {
  const { service } = createService();

  await assert.rejects(
    service.createManualEntry({
      tenantId: "tnt",
      orgId: "org",
      createdBy: "user-1",
      purpose: "personal",
      date: "2026-07-08",
      startTime: "09:00",
      endTime: "13:00",
      hourlyRate: 999_999_999,
    }),
    /hourlyRate/,
  );
});

void test("createManualEntry rejects a malformed currency code", async () => {
  const { service } = createService();

  await assert.rejects(
    service.createManualEntry({
      tenantId: "tnt",
      orgId: "org",
      createdBy: "user-1",
      purpose: "personal",
      date: "2026-07-08",
      startTime: "09:00",
      endTime: "13:00",
      hourlyRate: 25,
      currency: "usd",
    }),
    /currency/,
  );
});

void test("createManualEntry accepts a valid hourlyRate/currency pair", async () => {
  const { service, repo } = createService();

  await service.createManualEntry({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "personal",
    date: "2026-07-08",
    startTime: "09:00",
    endTime: "13:00",
    hourlyRate: 25,
    currency: "USD",
  });

  const createCall = repo.calls.find((call) => call.method === "createTimeEntry");
  assert.ok(createCall, "should call createTimeEntry");
  const payload = createCall.args[0] as Record<string, unknown>;
  assert.equal(payload.hourlyRate, 25);
  assert.equal(payload.currency, "USD");
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

// ── Proximity check-in ──────────────────────────────────────────────────────

void test("startTimer without checkIn never touches site coordinates", async () => {
  const { service, repo } = createService();

  await service.startTimer({ tenantId: "tnt", orgId: "org", createdBy: "user-1", purpose: "personal" });

  assert.ok(!repo.calls.some((c) => c.method === "getJobCoordinates" || c.method === "getFreeProjectCoordinates"));
  const startCall = repo.calls.find((c) => c.method === "startRealtimeEntry");
  const payload = startCall!.args[0] as Record<string, unknown>;
  assert.equal(payload.checkInLatitude, undefined);
});

void test("startTimer with checkIn but no site coordinates records position without distance", async () => {
  const { service, repo } = createService();

  await service.startTimer({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "payable",
    freeProjectId: "fp1",
    checkIn: { latitude: 19.4326, longitude: -99.1332, method: "proximity_confirmed" },
  });

  const startCall = repo.calls.find((c) => c.method === "startRealtimeEntry");
  const payload = startCall!.args[0] as Record<string, unknown>;
  assert.equal(payload.checkInLatitude, 19.4326);
  assert.equal(payload.checkInLongitude, -99.1332);
  assert.equal(payload.checkInMethod, "proximity_confirmed");
  assert.equal(payload.checkInDistanceMeters, undefined);
});

void test("startTimer with checkIn and known site coordinates computes distance and never blocks on it", async () => {
  const { service, repo } = createService({
    async getFreeProjectCoordinates() {
      return { latitude: 19.4363, longitude: -99.0721 }; // ~6-9km from the checkIn below
    },
  });

  const entry = await service.startTimer({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "payable",
    freeProjectId: "fp1",
    checkIn: { latitude: 19.4326, longitude: -99.1332, method: "proximity_auto" },
  });

  assert.ok(entry, "far-away checkIn must not block starting the timer");
  const startCall = repo.calls.find((c) => c.method === "startRealtimeEntry");
  const payload = startCall!.args[0] as Record<string, unknown>;
  assert.equal(typeof payload.checkInDistanceMeters, "number");
  assert.ok((payload.checkInDistanceMeters as number) > 1000);
});

void test("startTimer ignores an invalid checkIn coordinate", async () => {
  const { service, repo } = createService();

  await service.startTimer({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "personal",
    checkIn: { latitude: 999, longitude: 0, method: "proximity_confirmed" },
  });

  const startCall = repo.calls.find((c) => c.method === "startRealtimeEntry");
  const payload = startCall!.args[0] as Record<string, unknown>;
  assert.equal(payload.checkInLatitude, undefined);
});

void test("createManualEntry with checkIn always tags method as manual_tagged", async () => {
  const { service, repo } = createService({
    async getJobCoordinates() {
      return { latitude: 19.4326, longitude: -99.1332 };
    },
  });

  await service.createManualEntry({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "job_linked",
    jobId: "job-9",
    date: "2026-07-08",
    startTime: "09:00",
    endTime: "13:00",
    checkIn: { latitude: 19.4326, longitude: -99.1332 },
  });

  const createCall = repo.calls.find((c) => c.method === "createTimeEntry");
  const payload = createCall!.args[0] as Record<string, unknown>;
  assert.equal(payload.checkInMethod, "manual_tagged");
  assert.equal(payload.checkInDistanceMeters, 0);
});

void test("createManualEntry without checkIn omits all check-in fields", async () => {
  const { service, repo } = createService();

  await service.createManualEntry({
    tenantId: "tnt",
    orgId: "org",
    createdBy: "user-1",
    purpose: "personal",
    date: "2026-07-08",
    startTime: "09:00",
    endTime: "13:00",
  });

  const createCall = repo.calls.find((c) => c.method === "createTimeEntry");
  const payload = createCall!.args[0] as Record<string, unknown>;
  assert.equal(payload.checkInLatitude, undefined);
  assert.equal(payload.checkInMethod, undefined);
});
