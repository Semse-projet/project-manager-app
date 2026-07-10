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
