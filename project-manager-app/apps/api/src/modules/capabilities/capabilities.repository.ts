import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";

const { Prisma: PrismaRuntime } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

type CapabilityObservedState =
  | "PENDING"
  | "PLANNED"
  | "AWAITING_APPROVAL"
  | "APPLYING"
  | "VERIFYING"
  | "ACTIVE"
  | "DEGRADED"
  | "SUSPENDING"
  | "SUSPENDED"
  | "ROLLING_BACK"
  | "ROLLED_BACK"
  | "BLOCKED";

type CapabilityTransaction = Prisma.TransactionClient;

export type ClaimedCapabilityOperation = {
  id: string;
  tenantId: string;
  workspaceId: string;
  installationId: string;
  runtimeTargetId: string;
  status: CapabilityObservedState;
  attempts: number;
  maxAttempts: number;
  planDigest: string;
  configurationRevision: number;
  lockedBy: string;
  lockedAt: Date;
  lockExpiresAt: Date;
};

export type CreateCapabilityOperationInput = {
  tenantId: string;
  workspaceId: string;
  installationId: string;
  intent: "ACTIVATE" | "UPDATE" | "SUSPEND" | "ROLLBACK" | "RECONCILE";
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  idempotencyKey: string;
  policyDecisionJson: Prisma.InputJsonValue;
  planJson: Prisma.InputJsonValue;
  planDigest: string;
  correlationId: string;
  requestedByType: "USER" | "AGENT" | "SYSTEM";
  requestedById: string;
  configurationRevision: number;
  initialStatus?: "PLANNED" | "AWAITING_APPROVAL";
  maxAttempts?: number;
  now?: Date;
};

export type TransitionCapabilityOperationInput = {
  tenantId: string;
  workspaceId: string;
  operationId: string;
  expectedStatus: CapabilityObservedState;
  nextStatus: CapabilityObservedState;
  configurationRevision: number;
  actorType: "USER" | "AGENT" | "SYSTEM";
  actorId: string;
  reason?: string;
  now?: Date;
};

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function assertDigest(value: string, label: string): string {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * F4 persistence boundary for capability control-plane state.
 *
 * This class is deliberately not registered as a Nest provider yet: wiring
 * controllers/services belongs to F5. Every mutable state operation remains
 * tenant/workspace scoped and keeps database transactions free of network or
 * adapter calls.
 */
export class CapabilitiesRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  findInstallation(input: {
    tenantId: string;
    workspaceId: string;
    installationId: string;
  }) {
    return this.prisma.capabilityInstallation.findFirst({
      where: {
        id: input.installationId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      },
    });
  }

  listInstallations(input: {
    tenantId: string;
    workspaceId: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = boundedInteger(input.limit ?? 50, 1, 100, "limit");
    return this.prisma.capabilityInstallation.findMany({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      ...(input.cursor
        ? { cursor: { id: input.cursor }, skip: 1 }
        : {}),
    });
  }

  async createOperation(input: CreateCapabilityOperationInput) {
    const tenantId = requiredText(input.tenantId, "tenantId");
    const workspaceId = requiredText(input.workspaceId, "workspaceId");
    const installationId = requiredText(
      input.installationId,
      "installationId",
    );
    const idempotencyKey = requiredText(
      input.idempotencyKey,
      "idempotencyKey",
    );
    const planDigest = assertDigest(input.planDigest, "planDigest");
    const configurationRevision = boundedInteger(
      input.configurationRevision,
      1,
      Number.MAX_SAFE_INTEGER,
      "configurationRevision",
    );
    const maxAttempts = boundedInteger(
      input.maxAttempts ?? 5,
      1,
      25,
      "maxAttempts",
    );
    const now = input.now ?? new Date();
    const status = input.initialStatus ?? "PLANNED";

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const installation = await tx.capabilityInstallation.findFirst({
            where: {
              id: installationId,
              tenantId,
              workspaceId,
              configurationRevision,
              org: { tenantId },
              runtimeTarget: {
                tenantId,
                workspaceId,
                status: "ACTIVE",
              },
            },
          });
          if (!installation) {
            throw new Error(
              "Capability installation was not found in the tenant/workspace or its revision changed",
            );
          }

          const operation = await tx.capabilityOperation.create({
            data: {
              tenantId,
              workspaceId,
              installationId,
              runtimeTargetId: installation.runtimeTargetId,
              intent: input.intent,
              status,
              risk: input.risk,
              idempotencyKey,
              policyDecisionJson: input.policyDecisionJson,
              planJson: input.planJson,
              planDigest,
              correlationId: requiredText(
                input.correlationId,
                "correlationId",
              ),
              requestedByType: input.requestedByType,
              requestedById: requiredText(
                input.requestedById,
                "requestedById",
              ),
              configurationRevision,
              maxAttempts,
              nextAttemptAt: now,
            },
          });

          const installationUpdate =
            await tx.capabilityInstallation.updateMany({
              where: {
                id: installation.id,
                tenantId,
                workspaceId,
                configurationRevision,
              },
              data: {
                observedState: status,
                lastOperationId: operation.id,
              },
            });
          if (installationUpdate.count !== 1) {
            throw new Error(
              "Capability installation compare-and-set failed while creating operation",
            );
          }

          await this.appendStateEvidence(tx, {
            tenantId,
            orgId: installation.orgId,
            workspaceId,
            installationId,
            operationId: operation.id,
            previousStatus: installation.observedState,
            nextStatus: status,
            planDigest,
            configurationRevision,
            correlationId: operation.correlationId,
            actorType: input.requestedByType,
            actorId: input.requestedById,
            action: "capability.operation.created",
            eventType: "capability.operation_requested.v1",
            idempotencyKey: `capability-operation:${idempotencyKey}:created`,
            occurredAt: now,
          });

          return operation;
        },
        { isolationLevel: "Serializable", ...TRANSACTION_OPTIONS },
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prisma.capabilityOperation.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey },
        },
      });
      if (
        !existing ||
        existing.workspaceId !== workspaceId ||
        existing.installationId !== installationId ||
        existing.planDigest !== planDigest ||
        existing.configurationRevision !== configurationRevision
      ) {
        throw error;
      }
      return existing;
    }
  }

  async recordObservation(input: {
    tenantId: string;
    workspaceId: string;
    operationId: string;
    configurationRevision: number;
    observationJson: Prisma.InputJsonValue;
    actorType: "USER" | "AGENT" | "SYSTEM";
    actorId: string;
    now?: Date;
  }): Promise<boolean> {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const operation = await tx.capabilityOperation.findFirst({
        where: {
          id: input.operationId,
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          configurationRevision: input.configurationRevision,
          installation: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
          },
        },
        include: { installation: { select: { orgId: true } } },
      });
      if (!operation) {
        return false;
      }

      const result = await tx.capabilityOperation.updateMany({
        where: {
          id: operation.id,
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          configurationRevision: input.configurationRevision,
          observedAt: null,
        },
        data: { observationJson: input.observationJson, observedAt: now },
      });
      if (result.count !== 1) {
        return false;
      }

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId:
            input.actorType === "USER" ? input.actorId : undefined,
          entityType: "CapabilityOperation",
          entityId: operation.id,
          action: "capability.operation.observed",
          afterJson: asJson({
            workspaceId: input.workspaceId,
            planDigest: operation.planDigest,
            configurationRevision: input.configurationRevision,
            actor: { type: input.actorType, id: input.actorId },
            observedAt: now.toISOString(),
          }),
        },
      });
      return true;
    }, TRANSACTION_OPTIONS);
  }

  async claimNext(input: {
    tenantId: string;
    reconcilerId: string;
    batchSize?: number;
    leaseMs: number;
    now?: Date;
  }): Promise<ClaimedCapabilityOperation[]> {
    const tenantId = requiredText(input.tenantId, "tenantId");
    const reconcilerId = requiredText(input.reconcilerId, "reconcilerId");
    const batchSize = boundedInteger(input.batchSize ?? 1, 1, 25, "batchSize");
    const leaseMs = boundedInteger(input.leaseMs, 1_000, 300_000, "leaseMs");
    const now = input.now ?? new Date();
    const lockExpiresAt = new Date(now.getTime() + leaseMs);

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<ClaimedCapabilityOperation[]>(
        PrismaRuntime.sql`
          WITH ranked AS MATERIALIZED (
            SELECT
              operation."id",
              ROW_NUMBER() OVER (
                PARTITION BY operation."installationId"
                ORDER BY operation."createdAt", operation."id"
              ) AS installation_rank,
              ROW_NUMBER() OVER (
                PARTITION BY operation."runtimeTargetId"
                ORDER BY operation."createdAt", operation."id"
              ) AS target_rank
            FROM "CapabilityOperation" AS operation
            WHERE operation."tenantId" = ${tenantId}
              AND operation."status" = 'PLANNED'::"CapabilityObservedState"
              AND operation."observationJson" IS NOT NULL
              AND operation."observedAt" IS NOT NULL
              AND operation."nextAttemptAt" <= ${now}
              AND operation."attempts" < operation."maxAttempts"
          ), candidates AS (
            SELECT operation."id"
            FROM "CapabilityOperation" AS operation
            JOIN ranked ON ranked."id" = operation."id"
            JOIN "CapabilityInstallation" AS installation
              ON installation."id" = operation."installationId"
             AND installation."tenantId" = operation."tenantId"
             AND installation."workspaceId" = operation."workspaceId"
            JOIN "CapabilityRuntimeTarget" AS target
              ON target."id" = operation."runtimeTargetId"
             AND target."tenantId" = operation."tenantId"
             AND target."workspaceId" = operation."workspaceId"
            WHERE ranked.installation_rank = 1
              AND ranked.target_rank = 1
              AND NOT EXISTS (
                SELECT 1
                FROM "CapabilityOperation" AS leased
                WHERE leased."tenantId" = operation."tenantId"
                  AND leased."id" <> operation."id"
                  AND (
                    leased."installationId" = operation."installationId"
                    OR leased."runtimeTargetId" = operation."runtimeTargetId"
                  )
                  AND leased."lockedBy" IS NOT NULL
                  AND leased."lockExpiresAt" > ${now}
              )
            ORDER BY operation."createdAt", operation."id"
            FOR UPDATE OF operation, installation, target SKIP LOCKED
            LIMIT ${batchSize}
          )
          UPDATE "CapabilityOperation" AS operation
          SET
            "status" = 'APPLYING'::"CapabilityObservedState",
            "attempts" = operation."attempts" + 1,
            "lockedAt" = ${now},
            "lockExpiresAt" = ${lockExpiresAt},
            "lockedBy" = ${reconcilerId},
            "startedAt" = COALESCE(operation."startedAt", ${now}),
            "updatedAt" = ${now}
          FROM candidates
          WHERE operation."id" = candidates."id"
          RETURNING
            operation."id",
            operation."tenantId",
            operation."workspaceId",
            operation."installationId",
            operation."runtimeTargetId",
            operation."status",
            operation."attempts",
            operation."maxAttempts",
            operation."planDigest",
            operation."configurationRevision",
            operation."lockedBy",
            operation."lockedAt",
            operation."lockExpiresAt"
        `,
      );

      for (const operation of claimed) {
        const installation = await tx.capabilityInstallation.findUniqueOrThrow({
          where: { id: operation.installationId },
          select: {
            orgId: true,
            observedState: true,
            configurationRevision: true,
          },
        });
        const update = await tx.capabilityInstallation.updateMany({
          where: {
            id: operation.installationId,
            tenantId,
            workspaceId: operation.workspaceId,
            configurationRevision: operation.configurationRevision,
            observedState: "PLANNED",
          },
          data: { observedState: "APPLYING", observedAt: now },
        });
        if (update.count !== 1) {
          throw new Error(
            "Capability installation compare-and-set failed while claiming operation",
          );
        }

        await this.appendStateEvidence(tx, {
          tenantId,
          orgId: installation.orgId,
          workspaceId: operation.workspaceId,
          installationId: operation.installationId,
          operationId: operation.id,
          previousStatus: "PLANNED",
          nextStatus: "APPLYING",
          planDigest: operation.planDigest,
          configurationRevision: operation.configurationRevision,
          correlationId: operation.id,
          actorType: "SYSTEM",
          actorId: reconcilerId,
          action: "capability.operation.claimed",
          eventType: "capability.apply_started.v1",
          idempotencyKey: `capability-operation:${operation.id}:claim:${operation.attempts}`,
          occurredAt: now,
        });
      }

      return claimed;
    }, TRANSACTION_OPTIONS);
  }

  async transitionOperation(
    input: TransitionCapabilityOperationInput,
  ): Promise<boolean> {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          installationId: string;
          runtimeTargetId: string;
          planDigest: string;
          correlationId: string;
          observationJson: Prisma.JsonValue | null;
          orgId: string;
        }>
      >(PrismaRuntime.sql`
        SELECT
          operation."id",
          operation."installationId",
          operation."runtimeTargetId",
          operation."planDigest",
          operation."correlationId",
          operation."observationJson",
          installation."orgId"
        FROM "CapabilityOperation" AS operation
        JOIN "CapabilityInstallation" AS installation
          ON installation."id" = operation."installationId"
         AND installation."tenantId" = operation."tenantId"
         AND installation."workspaceId" = operation."workspaceId"
        WHERE operation."id" = ${input.operationId}
          AND operation."tenantId" = ${input.tenantId}
          AND operation."workspaceId" = ${input.workspaceId}
          AND operation."status" = ${input.expectedStatus}::"CapabilityObservedState"
          AND operation."configurationRevision" = ${input.configurationRevision}
        FOR UPDATE OF operation
      `);
      const operation = rows[0];
      if (!operation) {
        return false;
      }
      if (
        input.nextStatus === "APPLYING" &&
        operation.observationJson === null
      ) {
        throw new Error("observe-before-apply invariant rejected the transition");
      }

      await tx.$queryRaw(PrismaRuntime.sql`
        SELECT "id"
        FROM "CapabilityInstallation"
        WHERE "id" = ${operation.installationId}
        FOR UPDATE
      `);
      await tx.$queryRaw(PrismaRuntime.sql`
        SELECT "id"
        FROM "CapabilityRuntimeTarget"
        WHERE "id" = ${operation.runtimeTargetId}
          AND "tenantId" = ${input.tenantId}
          AND "workspaceId" = ${input.workspaceId}
        FOR UPDATE
      `);

      const operationUpdate = await tx.capabilityOperation.updateMany({
        where: {
          id: input.operationId,
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          status: input.expectedStatus,
          configurationRevision: input.configurationRevision,
        },
        data: {
          status: input.nextStatus,
          lastError: input.reason,
          ...(input.nextStatus === "ACTIVE" ||
          input.nextStatus === "SUSPENDED" ||
          input.nextStatus === "ROLLED_BACK" ||
          input.nextStatus === "BLOCKED"
            ? { completedAt: now, lockedAt: null, lockExpiresAt: null, lockedBy: null }
            : {}),
        },
      });
      const installationUpdate =
        await tx.capabilityInstallation.updateMany({
          where: {
            id: operation.installationId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            configurationRevision: input.configurationRevision,
            observedState: input.expectedStatus,
          },
          data: { observedState: input.nextStatus, observedAt: now },
        });
      if (operationUpdate.count !== 1 || installationUpdate.count !== 1) {
        throw new Error("Capability state compare-and-set failed");
      }

      await this.appendStateEvidence(tx, {
        tenantId: input.tenantId,
        orgId: operation.orgId,
        workspaceId: input.workspaceId,
        installationId: operation.installationId,
        operationId: operation.id,
        previousStatus: input.expectedStatus,
        nextStatus: input.nextStatus,
        planDigest: operation.planDigest,
        configurationRevision: input.configurationRevision,
        correlationId: operation.correlationId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: "capability.operation.transitioned",
        eventType: "capability.operation_state_changed.v1",
        idempotencyKey: `capability-operation:${operation.id}:state:${input.nextStatus}`,
        occurredAt: now,
        reason: input.reason,
      });
      return true;
    }, TRANSACTION_OPTIONS);
  }

  async reconcileExpiredLeases(input: {
    tenantId: string;
    reconcilerId: string;
    now?: Date;
  }): Promise<number> {
    const now = input.now ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<
        Array<{
          id: string;
          workspaceId: string;
          installationId: string;
          planDigest: string;
          configurationRevision: number;
          correlationId: string;
          orgId: string;
        }>
      >(PrismaRuntime.sql`
        WITH expired AS (
          SELECT operation."id"
          FROM "CapabilityOperation" AS operation
          WHERE operation."tenantId" = ${input.tenantId}
            AND operation."status" = 'APPLYING'::"CapabilityObservedState"
            AND operation."lockExpiresAt" <= ${now}
          ORDER BY operation."lockExpiresAt", operation."id"
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "CapabilityOperation" AS operation
        SET
          "status" = 'BLOCKED'::"CapabilityObservedState",
          "lockedAt" = NULL,
          "lockExpiresAt" = NULL,
          "lockedBy" = NULL,
          "lastError" = 'Lease expired; explicit observation/reconciliation required',
          "completedAt" = ${now},
          "updatedAt" = ${now}
        FROM expired, "CapabilityInstallation" AS installation
        WHERE operation."id" = expired."id"
          AND installation."id" = operation."installationId"
          AND installation."tenantId" = operation."tenantId"
          AND installation."workspaceId" = operation."workspaceId"
        RETURNING
          operation."id",
          operation."workspaceId",
          operation."installationId",
          operation."planDigest",
          operation."configurationRevision",
          operation."correlationId",
          installation."orgId"
      `);

      for (const operation of expired) {
        const installationUpdate =
          await tx.capabilityInstallation.updateMany({
            where: {
              id: operation.installationId,
              tenantId: input.tenantId,
              workspaceId: operation.workspaceId,
              configurationRevision: operation.configurationRevision,
              observedState: "APPLYING",
            },
            data: { observedState: "BLOCKED", observedAt: now },
          });
        if (installationUpdate.count !== 1) {
          throw new Error(
            "Expired lease reconciliation found installation drift",
          );
        }

        await this.appendStateEvidence(tx, {
          tenantId: input.tenantId,
          orgId: operation.orgId,
          workspaceId: operation.workspaceId,
          installationId: operation.installationId,
          operationId: operation.id,
          previousStatus: "APPLYING",
          nextStatus: "BLOCKED",
          planDigest: operation.planDigest,
          configurationRevision: operation.configurationRevision,
          correlationId: operation.correlationId,
          actorType: "SYSTEM",
          actorId: input.reconcilerId,
          action: "capability.operation.lease-expired",
          eventType: "capability.operation_state_changed.v1",
          idempotencyKey: `capability-operation:${operation.id}:lease-expired:${operation.configurationRevision}`,
          occurredAt: now,
          reason: "Lease expired; explicit observation/reconciliation required",
        });
      }
      return expired.length;
    }, TRANSACTION_OPTIONS);
  }

  async recordReceipt(input: {
    operationId: string;
    stepId: string;
    adapterKind: "COMPOSE" | "RAILWAY" | "KUBERNETES";
    status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
    outputJsonRedacted: Prisma.InputJsonValue;
    startedAt: Date;
    completedAt: Date;
  }) {
    if (input.completedAt < input.startedAt) {
      throw new Error("Receipt completion cannot precede its start");
    }
    const receipt = await this.prisma.capabilityExecutionReceipt.upsert({
      where: {
        operationId_stepId: {
          operationId: input.operationId,
          stepId: input.stepId,
        },
      },
      create: input,
      update: {},
    });
    if (
      receipt.adapterKind !== input.adapterKind ||
      receipt.status !== input.status ||
      receipt.startedAt.getTime() !== input.startedAt.getTime() ||
      receipt.completedAt.getTime() !== input.completedAt.getTime() ||
      JSON.stringify(receipt.outputJsonRedacted) !==
        JSON.stringify(input.outputJsonRedacted)
    ) {
      throw new Error(
        "Receipt retry conflicts with the immutable persisted receipt",
      );
    }
    return receipt;
  }

  private async appendStateEvidence(
    tx: CapabilityTransaction,
    input: {
      tenantId: string;
      orgId: string;
      workspaceId: string;
      installationId: string;
      operationId: string;
      previousStatus: CapabilityObservedState;
      nextStatus: CapabilityObservedState;
      planDigest: string;
      configurationRevision: number;
      correlationId: string;
      actorType: "USER" | "AGENT" | "SYSTEM";
      actorId: string;
      action: string;
      eventType: string;
      idempotencyKey: string;
      occurredAt: Date;
      reason?: string;
    },
  ): Promise<void> {
    const evidence = {
      workspaceId: input.workspaceId,
      installationId: input.installationId,
      operationId: input.operationId,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      planDigest: input.planDigest,
      configurationRevision: input.configurationRevision,
      actor: { type: input.actorType, id: input.actorId },
      ...(input.reason ? { reason: input.reason } : {}),
    };

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId:
          input.actorType === "USER" ? input.actorId : undefined,
        entityType: "CapabilityOperation",
        entityId: input.operationId,
        action: input.action,
        beforeJson: asJson({ status: input.previousStatus }),
        afterJson: asJson(evidence),
        occurredAt: input.occurredAt,
      },
    });

    await tx.domainOutboxEvent.create({
      data: {
        eventId: randomUUID(),
        eventType: input.eventType,
        version: 1,
        envelopeVersion: 2,
        tenantId: input.tenantId,
        orgId: input.orgId,
        module: "control-plane",
        entityType: "CapabilityOperation",
        entityId: input.operationId,
        actorType: input.actorType.toLowerCase(),
        actorId: input.actorId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        schemaRef: `semse://schemas/${input.eventType}`,
        payloadJson: asJson(evidence),
        occurredAt: input.occurredAt,
        recordedAt: input.occurredAt,
      },
    });
  }
}
