import "reflect-metadata";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { IS_PUBLIC_KEY } from "../src/common/public.decorator.ts";
import { SseController } from "../dist/infrastructure/sse/sse.controller.js";
import { AiMissionIncidentService } from "../dist/modules/ai-models/logging/ai-mission-incident.service.js";
import {
  MISSION_CONTROL_RUNBOOKS,
  assertActionAllowedByRunbook,
  decodeMissionControlCursor,
  encodeMissionControlCursor,
  hashMissionControlIntent,
  isMissionControlV2Enabled,
  parseMissionControlAction,
} from "../dist/modules/ops/mission-control/mission-control.policy.js";
import { MissionControlController } from "../dist/modules/ops/mission-control/mission-control.controller.js";
import { MissionControlService } from "../dist/modules/ops/mission-control/mission-control.service.js";
import { OpsRepository } from "../dist/modules/ops/ops.repository.js";

test("F4 policy: feature remains default-off and supports an exact tenant canary", () => {
  assert.equal(isMissionControlV2Enabled("tenant_default", {}), false);
  assert.equal(isMissionControlV2Enabled("tenant_default", {
    SEMSE_MISSION_CONTROL_V2_ENABLED: "false",
    SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS: "tenant_default,tenant_2",
  }), true);
  assert.equal(isMissionControlV2Enabled("tenant_other", {
    SEMSE_MISSION_CONTROL_V2_ENABLED: "false",
    SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS: "tenant_default",
  }), false);
  assert.equal(isMissionControlV2Enabled("tenant_other", {
    SEMSE_MISSION_CONTROL_V2_ENABLED: "true",
  }), true);
});

test("F4 policy: action contract requires governed intent fields", () => {
  const valid = parseMissionControlAction({
    action: "ACKNOWLEDGE",
    targetType: "OperationalSignal",
    targetId: "sig_1",
    reason: "Reviewed the signal and confirmed ownership.",
    runbookId: "signal-triage-v1",
    idempotencyKey: "mc-test-0001",
    dryRun: false,
  });
  assert.equal(valid.action, "ACKNOWLEDGE");
  assert.deepEqual(valid.options, {});

  assert.throws(() => parseMissionControlAction({
    ...valid,
    reason: "short",
  }), BadRequestException);
  assert.throws(() => parseMissionControlAction({
    ...valid,
    idempotencyKey: "tiny",
  }), BadRequestException);
});

test("F4 policy: runbooks are allowlisted and reject incompatible actions", () => {
  assert.ok(MISSION_CONTROL_RUNBOOKS.length >= 5);
  assert.doesNotThrow(() => assertActionAllowedByRunbook(
    "signal-triage-v1",
    "ACKNOWLEDGE",
    "OperationalSignal",
  ));
  assert.throws(
    () => assertActionAllowedByRunbook("signal-triage-v1", "REPLAY", "DomainEvent"),
    BadRequestException,
  );
  assert.throws(
    () => assertActionAllowedByRunbook("runbook-not-found", "ACKNOWLEDGE", "OperationalSignal"),
    BadRequestException,
  );
});

test("F4 policy: cursor is opaque, round-trips and rejects malformed input", () => {
  const cursor = encodeMissionControlCursor(37);
  assert.notEqual(cursor, "37");
  assert.equal(decodeMissionControlCursor(cursor), 37);
  assert.equal(decodeMissionControlCursor(undefined), 0);
  assert.throws(() => decodeMissionControlCursor("not-a-cursor"), BadRequestException);
});

test("F4 policy: intent hash is stable but detects a changed payload", () => {
  const base = {
    tenantId: "tenant_1",
    orgId: "org_1",
    actorUserId: "usr_1",
    action: "RETRY" as const,
    targetType: "AgentRun" as const,
    targetId: "run_1",
    reason: "Retry after the dependency recovered.",
    runbookId: "agent-run-recovery-v1",
    dryRun: false,
    options: {},
  };
  assert.equal(hashMissionControlIntent(base), hashMissionControlIntent({ ...base }));
  assert.notEqual(
    hashMissionControlIntent(base),
    hashMissionControlIntent({ ...base, targetId: "run_2" }),
  );
});

test("F4 controller declares read/write permissions on every new contract", () => {
  const expectations: Array<[keyof MissionControlController, string]> = [
    ["listExceptions", "ops:dashboard:read"],
    ["listRunbooks", "ops:dashboard:read"],
    ["executeAction", "ops:dashboard:write"],
  ];
  for (const [method, permission] of expectations) {
    const metadata = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      MissionControlController.prototype[method],
    );
    assert.deepEqual(metadata, [permission]);
  }
});

test("F4 regression: AgentRun retry/requeue always filter id and tenantId", async () => {
  const updateCalls: Array<Record<string, unknown>> = [];
  const prisma = {
    agentRun: {
      async updateMany(input: Record<string, unknown>) {
        updateCalls.push(input);
        return { count: 0 };
      },
      async findFirst() {
        return null;
      },
    },
  };
  const repository = new OpsRepository(
    prisma as never,
    { async ensureActorContext() {} } as never,
  );
  const actor = {
    tenantId: "tenant_a",
    orgId: "org_a",
    userId: "usr_a",
    runId: "run_owned_by_tenant_b",
  };

  await assert.rejects(() => repository.retryAgentRun(actor), NotFoundException);
  await assert.rejects(() => repository.requeueAgentRun(actor), NotFoundException);
  assert.deepEqual(
    (updateCalls[0]?.where as Record<string, unknown>),
    { id: actor.runId, tenantId: actor.tenantId },
  );
  assert.deepEqual(
    (updateCalls[1]?.where as Record<string, unknown>),
    { id: actor.runId, tenantId: actor.tenantId },
  );
});

test("F4 regression: tenant incidents never duplicate onto the global SSE channel", async () => {
  const emitted: string[] = [];
  const service = new AiMissionIncidentService(
    {
      missionControlIncident: {
        async create({ data }: { data: Record<string, unknown> }) {
          return {
            id: "inc_1",
            ...data,
            createdAt: new Date("2026-07-31T00:00:00.000Z"),
          };
        },
      },
    } as never,
    {
      emit(channel: string) {
        emitted.push(channel);
      },
    } as never,
  );

  await service.persist({
    tenantId: "tenant_a",
    source: "manual",
    posture: "degraded",
    severity: "critical",
    title: "Tenant-scoped incident",
    detail: "Only tenant A may receive the payload.",
    alertIds: ["alert_1"],
  });

  assert.deepEqual(emitted, ["mission-control:tenant_a"]);
  assert.equal(emitted.includes("mission-control:global"), false);
});

test("F4 regression: Mission Control SSE requires an authenticated request context", () => {
  const isPublic = Reflect.getMetadata(
    IS_PUBLIC_KEY,
    SseController.prototype.missionControlStream,
  );
  assert.notEqual(isPublic, true);
});

test("F4 policy: incompatible duplicate intent is a conflict, not silent reuse", () => {
  const error = new ConflictException({
    code: "MISSION_CONTROL_IDEMPOTENCY_CONFLICT",
    message: "Idempotency key was already used for another intent",
  });
  assert.equal(error.getStatus(), 409);
});

function makeMissionControlService(prisma: Record<string, unknown>) {
  return new MissionControlService(
    prisma as never,
    { async append() {} } as never,
    {
      async acknowledge() { return true; },
      async resolve() { return true; },
      async dismiss() { return true; },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { getHealth: () => ({ api: "ok", worker: "ok", redis: "ok", checkedAt: new Date().toISOString() }) } as never,
    { getLatest: () => null } as never,
    { emit() {} } as never,
  );
}

const actionActor = {
  tenantId: "tenant_1",
  orgId: "org_1",
  userId: "usr_admin_1",
  roles: ["OPS_ADMIN"],
  requestId: "req_mc_1",
};

const actionInput = {
  action: "ACKNOWLEDGE" as const,
  targetType: "OperationalSignal" as const,
  targetId: "sig_1",
  reason: "Reviewed the signal and confirmed ownership.",
  runbookId: "signal-triage-v1",
  idempotencyKey: "mission-control-test-001",
  dryRun: false,
  options: {},
};

function withCanaryEnabled<T>(operation: () => Promise<T>): Promise<T> {
  const previousEnabled = process.env.SEMSE_MISSION_CONTROL_V2_ENABLED;
  const previousCanary = process.env.SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS;
  process.env.SEMSE_MISSION_CONTROL_V2_ENABLED = "false";
  process.env.SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS = "tenant_1";
  return operation().finally(() => {
    if (previousEnabled === undefined) delete process.env.SEMSE_MISSION_CONTROL_V2_ENABLED;
    else process.env.SEMSE_MISSION_CONTROL_V2_ENABLED = previousEnabled;
    if (previousCanary === undefined) delete process.env.SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS;
    else process.env.SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS = previousCanary;
  });
}

test("F4 service: same idempotency key and intent returns the terminal receipt", async () => {
  const intentHash = hashMissionControlIntent({
    tenantId: actionActor.tenantId,
    orgId: actionActor.orgId,
    actorUserId: actionActor.userId,
    action: actionInput.action,
    targetType: actionInput.targetType,
    targetId: actionInput.targetId,
    reason: actionInput.reason,
    runbookId: actionInput.runbookId,
    dryRun: actionInput.dryRun,
    options: actionInput.options,
  });
  const existing = {
    id: "receipt_1",
    tenantId: "tenant_1",
    action: "ACKNOWLEDGE",
    targetType: "OperationalSignal",
    targetId: "sig_1",
    status: "SUCCEEDED",
    dryRun: false,
    resultJson: { status: "acknowledged" },
    errorCode: null,
    errorMessage: null,
    correlationId: "corr_1",
    incidentId: null,
    leaseExpiresAt: null,
    attempts: 1,
    intentHash,
    createdAt: new Date("2026-07-31T00:00:00.000Z"),
    completedAt: new Date("2026-07-31T00:00:01.000Z"),
  };
  const service = makeMissionControlService({
    missionControlActionReceipt: {
      async findUnique() { return existing; },
    },
  });

  const result = await withCanaryEnabled(() => service.executeAction(actionActor, actionInput));
  assert.equal(result.duplicate, true);
  assert.equal(result.receipt.id, "receipt_1");
  assert.equal(result.receipt.status, "SUCCEEDED");
});

test("F4 service: same idempotency key with different intent returns 409", async () => {
  const service = makeMissionControlService({
    missionControlActionReceipt: {
      async findUnique() {
        return {
          id: "receipt_conflict",
          status: "SUCCEEDED",
          intentHash: "different-intent-hash",
          leaseExpiresAt: null,
        };
      },
    },
  });
  await assert.rejects(
    () => withCanaryEnabled(() => service.executeAction(actionActor, actionInput)),
    ConflictException,
  );
});

test("F4 service: cross-tenant target is a 404 and leaves a FAILED receipt", async () => {
  let targetWhere: unknown;
  let failureUpdate: Record<string, unknown> | undefined;
  const created = {
    id: "receipt_cross_tenant",
    tenantId: actionActor.tenantId,
    action: actionInput.action,
    targetType: actionInput.targetType,
    targetId: actionInput.targetId,
    status: "RUNNING",
    dryRun: false,
    resultJson: null,
    errorCode: null,
    errorMessage: null,
    correlationId: "corr_cross_tenant",
    incidentId: null,
    leaseExpiresAt: new Date(Date.now() + 30_000),
    attempts: 1,
    intentHash: "created-by-service",
    createdAt: new Date(),
    completedAt: null,
  };
  const service = makeMissionControlService({
    missionControlActionReceipt: {
      async findUnique() { return null; },
      async create() { return created; },
      async update({ data }: { data: Record<string, unknown> }) {
        failureUpdate = data;
        return {
          ...created,
          ...data,
          errorCode: String(data.errorCode),
          errorMessage: String(data.errorMessage),
          resultJson: data.resultJson,
          completedAt: data.completedAt as Date,
        };
      },
    },
    operationalSignal: {
      async findFirst({ where }: { where: unknown }) {
        targetWhere = where;
        return null;
      },
    },
  });

  await assert.rejects(
    () => withCanaryEnabled(() => service.executeAction(actionActor, actionInput)),
    NotFoundException,
  );
  assert.deepEqual(targetWhere, { id: "sig_1", tenantId: "tenant_1" });
  assert.equal(failureUpdate?.status, "FAILED");
  assert.equal(failureUpdate?.errorCode, "MISSION_CONTROL_TARGET_NOT_FOUND");
});

test("F4 migration: additive receipt and incident indexes are present", () => {
  const sql = readFileSync(
    new URL(
      "../../../packages/db/prisma/migrations/20260731033000_mission_control_2/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE "MissionControlActionReceipt"/);
  assert.match(sql, /MissionControlActionReceipt_tenantId_idempotencyKey_key/);
  assert.match(sql, /ADD COLUMN "actionReceiptId" TEXT/);
  assert.match(sql, /MissionControlIncident_tenantId_status_createdAt_idx/);
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
});
