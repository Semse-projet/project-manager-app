import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { FieldOpsController } from "../dist/modules/field-ops/field-ops.controller.js";
import { FieldOpsService } from "../dist/modules/field-ops/field-ops.service.js";
import type { TrackerSessionRecord } from "../src/modules/field-ops/tracker-session.ts";

const baseTime = new Date("2026-06-07T10:00:00.000Z");

function makeSession(
  status: TrackerSessionRecord["status"],
  overrides: Partial<TrackerSessionRecord> = {}
): TrackerSessionRecord {
  const startedAt = overrides.startedAt ?? baseTime;
  return {
    id: overrides.id ?? "sess_1",
    tenantId: overrides.tenantId ?? "tenant_1",
    orgId: overrides.orgId ?? "org_1",
    jobId: overrides.jobId ?? "job_1",
    createdBy: overrides.createdBy ?? "usr_1",
    status,
    startedAt,
    resumedAt:
      overrides.resumedAt ??
      (status === "RUNNING" ? new Date("2026-06-07T10:05:00.000Z") : null),
    pausedAt:
      overrides.pausedAt ??
      (status === "PAUSED" ? new Date("2026-06-07T10:15:00.000Z") : null),
    stoppedAt:
      overrides.stoppedAt ??
      (status === "STOPPED" ? new Date("2026-06-07T10:30:00.000Z") : null),
    accumulatedSeconds: overrides.accumulatedSeconds ?? 600,
    notes: overrides.notes ?? "nota",
    createdAt: overrides.createdAt ?? startedAt,
    updatedAt: overrides.updatedAt ?? new Date("2026-06-07T10:30:00.000Z"),
    job:
      overrides.job ?? {
        id: overrides.jobId ?? "job_1",
        title: "Instalacion split",
        status: "IN_PROGRESS",
      },
  };
}

function createService(input?: {
  activeSession?: TrackerSessionRecord | null;
  currentSession?: TrackerSessionRecord;
  jobExists?: boolean;
}) {
  let currentSession = input?.currentSession ?? makeSession("RUNNING");
  let createdSession: TrackerSessionRecord | null = null;
  const repo = {
    findJobForTracker: async ({ jobId }: { tenantId: string; jobId: string }) =>
      input?.jobExists === false || jobId !== "job_1"
        ? null
        : { id: "job_1", title: "Instalacion split", status: "IN_PROGRESS" },
    findActiveTrackerSession: async () => input?.activeSession ?? null,
    createTrackerSession: async (session: Partial<TrackerSessionRecord> & { status: TrackerSessionRecord["status"] }) => {
      createdSession = makeSession(session.status, {
        ...session,
        id: "sess_created",
        tenantId: session.tenantId ?? "tenant_1",
        orgId: session.orgId ?? "org_1",
        jobId: session.jobId ?? "job_1",
        createdBy: session.createdBy ?? "usr_1",
        notes: session.notes ?? null,
        resumedAt: session.resumedAt ?? null,
        pausedAt: session.pausedAt ?? null,
        stoppedAt: session.stoppedAt ?? null,
        startedAt: session.startedAt ?? baseTime,
        createdAt: session.startedAt ?? baseTime,
        updatedAt: session.startedAt ?? baseTime,
        job: {
          id: session.jobId ?? "job_1",
          title: "Instalacion split",
          status: "IN_PROGRESS",
        },
      });
      currentSession = createdSession;
      return createdSession;
    },
    findTrackerSessionById: async () => currentSession,
    updateTrackerSession: async (update: {
      sessionId: string;
      status: TrackerSessionRecord["status"];
      resumedAt: Date | null;
      pausedAt: Date | null;
      stoppedAt?: Date | null;
      accumulatedSeconds: number;
      notes?: string | null | undefined;
    }) => {
      currentSession = {
        ...currentSession,
        status: update.status,
        resumedAt: update.resumedAt,
        pausedAt: update.pausedAt,
        stoppedAt: update.stoppedAt ?? currentSession.stoppedAt,
        accumulatedSeconds: update.accumulatedSeconds,
        notes: update.notes ?? currentSession.notes,
        updatedAt: new Date("2026-06-07T10:40:00.000Z"),
      };
      return currentSession;
    },
    listUnits: async () => [],
    findUnitById: async () => null,
    createUnit: async () => null,
    updateUnitStatus: async () => null,
    listWorklogs: async () => [],
    createWorklog: async () => null,
    listFacts: async () => [],
    createFact: async () => null,
    listVendors: async () => [],
    createVendor: async () => null,
    upsertComplianceDoc: async () => null,
  };
  const audit = { append: async () => undefined };
  const service = new FieldOpsService(repo as never, audit as never);
  return { service, repo, getCreatedSession: () => createdSession };
}

test("field-ops controller methods declare the expected permissions", () => {
  const expectations: Array<[string, string]> = [
    ["listUnits", "field-ops:read"],
    ["getUnit", "field-ops:read"],
    ["createUnit", "field-ops:write"],
    ["updateUnitStatus", "field-ops:write"],
    ["listWorklogs", "field-ops:read"],
    ["createWorklog", "field-ops:write"],
    ["getTrackerSnapshot", "field-ops:read"],
    ["startTrackerSession", "field-ops:write"],
    ["createManualTrackerSession", "field-ops:write"],
    ["pauseTrackerSession", "field-ops:write"],
    ["resumeTrackerSession", "field-ops:write"],
    ["stopTrackerSession", "field-ops:write"],
    ["listFacts", "field-ops:read"],
    ["createFact", "field-ops:write"],
    ["listVendors", "field-ops:read"],
    ["createVendor", "field-ops:write"],
    ["upsertCompliance", "field-ops:write"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, FieldOpsController.prototype[methodName]);
    assert.deepEqual(metadata, [permission], `${methodName} should require ${permission}`);
  }
});

test("field-ops tracker start returns the existing running session when the same job is already active", async () => {
  const existing = makeSession("RUNNING", { jobId: "job_1" });
  const { service, getCreatedSession } = createService({ activeSession: existing });

  const result = await service.startTrackerSession({
    tenantId: "tenant_1",
    orgId: "org_1",
    createdBy: "usr_1",
    requestId: "req_1",
    jobId: "job_1",
    notes: "  turno de campo  ",
  });

  assert.equal(result.id, existing.id);
  assert.equal(result.status, "RUNNING");
  assert.equal(getCreatedSession(), null);
});

test("field-ops tracker start rejects when a different active session already exists", async () => {
  const active = makeSession("PAUSED", { jobId: "job_2" });
  const { service } = createService({ activeSession: active });

  await assert.rejects(
    () =>
      service.startTrackerSession({
        tenantId: "tenant_1",
        orgId: "org_1",
        createdBy: "usr_1",
        requestId: "req_2",
        jobId: "job_1",
      }),
    ConflictException
  );
});

test("field-ops tracker transition methods reject invalid state changes", async () => {
  const pausedSession = makeSession("PAUSED");
  const runningSession = makeSession("RUNNING");
  const stoppedSession = makeSession("STOPPED");

  const pausedService = createService({ currentSession: pausedSession }).service;
  const runningService = createService({ currentSession: runningSession }).service;
  const stoppedService = createService({ currentSession: stoppedSession }).service;

  await assert.rejects(
    () =>
      pausedService.pauseTrackerSession({
        tenantId: "tenant_1",
        orgId: "org_1",
        createdBy: "usr_1",
        requestId: "req_3",
        sessionId: "sess_1",
      }),
    ConflictException
  );

  await assert.rejects(
    () =>
      runningService.resumeTrackerSession({
        tenantId: "tenant_1",
        orgId: "org_1",
        createdBy: "usr_1",
        requestId: "req_4",
        sessionId: "sess_1",
      }),
    ConflictException
  );

  const result = await stoppedService.stopTrackerSession({
    tenantId: "tenant_1",
    orgId: "org_1",
    createdBy: "usr_1",
    requestId: "req_5",
    sessionId: "sess_1",
  });

  assert.equal(result.status, "STOPPED");
});
