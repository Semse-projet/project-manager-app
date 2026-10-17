import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { isProductionStorage } from "./production-storage-guard.js";
import { StorageWriteGateCoordinator } from "./storage-write-gate-coordinator.js";
import { resolveStorageWriteGateScope } from "./storage-write-gate-scope.js";
import {
  StorageWriteGateBlockedError,
  type StorageWriteGateAction,
  type StorageWriteGatePhase,
} from "./storage-write-gate-state.js";
import { StorageWriteGateTransitionService } from "./storage-write-gate-transition.service.js";

type ControlMetadata = Readonly<{
  actorUserId: string;
  ticket: string;
  reason: string;
  idempotencyKey: string;
}>;

type AuditReplayRow = {
  action: string;
  phaseAfter: StorageWriteGatePhase;
  epochAfter: bigint;
  requestDigest: string | null;
  detailDigest: string | null;
  targetOperationId: string | null;
};

type ControlTx = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateMetadata(meta: ControlMetadata): void {
  if (!meta.actorUserId?.trim()) {
    throw new StorageWriteGateBlockedError("administrator_required");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/.test(meta.ticket)) {
    throw new StorageWriteGateBlockedError("invalid_audit_ticket");
  }
  if (meta.reason.trim().length < 3 || meta.reason.trim().length > 1000) {
    throw new StorageWriteGateBlockedError("invalid_reason");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(meta.idempotencyKey)) {
    throw new StorageWriteGateBlockedError("invalid_idempotency_key");
  }
}

function validateDigest(value: string, reason: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new StorageWriteGateBlockedError(reason);
  }
}

@Injectable()
export class StorageWriteGateControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordinator: StorageWriteGateCoordinator,
    private readonly transitions: StorageWriteGateTransitionService,
  ) {}

  private assertStagingControlPlane(): void {
    if (
      process.env.SEMSE_STORAGE_WRITE_GATE_MODE !== "staging" ||
      isProductionStorage(process.env)
    ) {
      throw new ServiceUnavailableException(
        "Storage write gate control plane is available only in approved non-production staging",
      );
    }
  }

  private get scope(): string {
    return resolveStorageWriteGateScope();
  }

  private scopeDigest(): string {
    return createHash("sha256").update(this.scope).digest("hex");
  }

  private async replay(
    tx: ControlTx,
    input: {
      action: string;
      idempotencyKey: string;
      requestDigest: string;
    },
  ): Promise<AuditReplayRow | null> {
    const rows = await tx.$queryRaw<AuditReplayRow[]>`
      SELECT "action", "phaseAfter", "epochAfter", "requestDigest",
             "detailDigest", "targetOperationId"
      FROM "StorageWriteGateAudit"
      WHERE "scope" = ${this.scope}
        AND "idempotencyKey" = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const row = rows[0]!;
    if (row.action !== input.action || row.requestDigest !== input.requestDigest) {
      throw new StorageWriteGateBlockedError("idempotency_conflict");
    }
    return row;
  }

  async status(): Promise<{
    provisioned: boolean;
    scopeDigest: string;
    phase?: StorageWriteGatePhase;
    epoch?: string;
    activeOperations?: Array<{
      id: string;
      epoch: string;
      kind: string;
      writerInstanceId: string;
      admittedAt: string;
    }>;
    coverageDigestPresent?: boolean;
    recoveryWindowDigestPresent?: boolean;
  }> {
    this.assertStagingControlPlane();
    const rows = await this.prisma.$queryRaw<Array<{
      phase: StorageWriteGatePhase;
      epoch: bigint;
      coverageDigest: string | null;
      recoveryWindowDigest: string | null;
    }>>`
      SELECT "phase", "epoch", "coverageDigest", "recoveryWindowDigest"
      FROM "StorageWriteGate"
      WHERE "scope" = ${this.scope}
    `;
    if (rows.length === 0) {
      return {provisioned: false, scopeDigest: this.scopeDigest()};
    }
    const operations = await this.prisma.$queryRaw<Array<{
      id: string;
      epoch: bigint;
      kind: string;
      writerInstanceId: string;
      admittedAt: Date;
    }>>`
      SELECT "id", "epoch", "kind", "writerInstanceId", "admittedAt"
      FROM "StorageWriteOperation"
      WHERE "scope" = ${this.scope} AND "state" = 'ACTIVE'
      ORDER BY "admittedAt" ASC
    `;
    const gate = rows[0]!;
    return {
      provisioned: true,
      scopeDigest: this.scopeDigest(),
      phase: gate.phase,
      epoch: gate.epoch.toString(),
      activeOperations: operations.map((operation) => ({
        id: operation.id,
        epoch: operation.epoch.toString(),
        kind: operation.kind,
        writerInstanceId: operation.writerInstanceId,
        admittedAt: operation.admittedAt.toISOString(),
      })),
      coverageDigestPresent: gate.coverageDigest !== null,
      recoveryWindowDigestPresent: gate.recoveryWindowDigest !== null,
    };
  }

  async provision(meta: ControlMetadata): Promise<{
    created: boolean;
    phase: StorageWriteGatePhase;
    epoch: string;
  }> {
    this.assertStagingControlPlane();
    validateMetadata(meta);
    const requestDigest = digestJson({
      action: "PROVISION",
      actorUserId: meta.actorUserId,
      ticket: meta.ticket,
      reason: meta.reason,
    });

    return this.prisma.$transaction(async (tx) => {
      // ON CONFLICT waits for a concurrent provision of the same scope. The
      // row lock below then serializes replay/idempotency with every control
      // mutation using this gate.
      const inserted = await tx.$executeRaw`
        INSERT INTO "StorageWriteGate"
          ("scope", "phase", "epoch", "coverageDigest", "recoveryWindowDigest",
           "operatorTicket", "updatedAt")
        VALUES (
          ${this.scope}, 'OPEN', 1, NULL, NULL, ${meta.ticket}, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("scope") DO NOTHING
      `;
      const rows = await tx.$queryRaw<Array<{
        phase: StorageWriteGatePhase;
        epoch: bigint;
      }>>`
        SELECT "phase", "epoch"
        FROM "StorageWriteGate"
        WHERE "scope" = ${this.scope}
        FOR UPDATE
      `;
      if (rows.length !== 1) {
        throw new StorageWriteGateBlockedError("gate_not_provisioned");
      }
      const gate = rows[0]!;

      const prior = await this.replay(tx, {
        action: "PROVISION",
        idempotencyKey: meta.idempotencyKey,
        requestDigest,
      });
      if (prior) {
        return {
          created: true,
          phase: prior.phaseAfter,
          epoch: prior.epochAfter.toString(),
        };
      }
      if (inserted === 0) {
        return {created: false, phase: gate.phase, epoch: gate.epoch.toString()};
      }

      await tx.$executeRaw`
        INSERT INTO "StorageWriteGateAudit"
          ("id", "scope", "epochBefore", "epochAfter", "phaseBefore", "phaseAfter",
           "action", "actorUserId", "ticket", "reason", "idempotencyKey",
           "requestDigest", "occurredAt")
        VALUES (
          gen_random_uuid(), ${this.scope}, 1, 1, 'OPEN', 'OPEN',
          'PROVISION', ${meta.actorUserId}, ${meta.ticket}, ${meta.reason},
          ${meta.idempotencyKey}, ${requestDigest}, CURRENT_TIMESTAMP
        )
      `;
      return {created: true, phase: "OPEN", epoch: "1"};
    }, {maxWait: 3000, timeout: 8000});
  }

  async transition(input: ControlMetadata & {
    expectedEpoch: bigint;
    action: StorageWriteGateAction;
  }): Promise<{phase: StorageWriteGatePhase; epoch: string}> {
    this.assertStagingControlPlane();
    validateMetadata(input);
    const requestDigest = digestJson({
      action: input.action,
      expectedEpoch: input.expectedEpoch.toString(),
      actorUserId: input.actorUserId,
      ticket: input.ticket,
      reason: input.reason,
    });
    const result = await this.transitions.transition({
      scope: this.scope,
      expectedEpoch: input.expectedEpoch,
      action: input.action,
      authority: {
        actorUserId: input.actorUserId,
        actorAuthorized: true,
        auditTicket: input.ticket,
      },
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      requestDigest,
    });
    return {phase: result.phase, epoch: result.epoch.toString()};
  }

  async attestCoverage(input: ControlMetadata & {
    expectedEpoch: bigint;
    coverageDigest: string;
  }): Promise<{phase: StorageWriteGatePhase; epoch: string}> {
    this.assertStagingControlPlane();
    validateMetadata(input);
    validateDigest(input.coverageDigest, "invalid_coverage_digest");
    const requestDigest = digestJson({
      action: "ATTEST_COVERAGE",
      expectedEpoch: input.expectedEpoch.toString(),
      coverageDigest: input.coverageDigest,
      actorUserId: input.actorUserId,
      ticket: input.ticket,
      reason: input.reason,
    });

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        phase: StorageWriteGatePhase;
        epoch: bigint;
      }>>`
        SELECT "phase", "epoch"
        FROM "StorageWriteGate"
        WHERE "scope" = ${this.scope}
        FOR UPDATE
      `;
      if (rows.length !== 1) throw new StorageWriteGateBlockedError("gate_not_provisioned");
      const gate = rows[0]!;

      const prior = await this.replay(tx, {
        action: "ATTEST_COVERAGE",
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      });
      if (prior) {
        return {phase: prior.phaseAfter, epoch: prior.epochAfter.toString()};
      }
      if (gate.epoch !== input.expectedEpoch) throw new StorageWriteGateBlockedError("stale_epoch");
      if (gate.phase !== "DRAINING") throw new StorageWriteGateBlockedError("coverage_requires_draining");

      await tx.$executeRaw`
        UPDATE "StorageWriteGate"
        SET "coverageDigest" = ${input.coverageDigest},
            "operatorTicket" = ${input.ticket},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "scope" = ${this.scope} AND "epoch" = ${gate.epoch}
      `;
      await tx.$executeRaw`
        INSERT INTO "StorageWriteGateAudit"
          ("id", "scope", "epochBefore", "epochAfter", "phaseBefore", "phaseAfter",
           "action", "actorUserId", "ticket", "reason", "idempotencyKey",
           "requestDigest", "detailDigest", "occurredAt")
        VALUES (
          gen_random_uuid(), ${this.scope}, ${gate.epoch}, ${gate.epoch},
          ${gate.phase}, ${gate.phase}, 'ATTEST_COVERAGE',
          ${input.actorUserId}, ${input.ticket}, ${input.reason},
          ${input.idempotencyKey}, ${requestDigest}, ${input.coverageDigest},
          CURRENT_TIMESTAMP
        )
      `;
      return {phase: gate.phase, epoch: gate.epoch.toString()};
    }, {maxWait: 3000, timeout: 8000});
  }

  async attestWindowClosed(input: ControlMetadata & {
    expectedEpoch: bigint;
    windowEvidenceDigest: string;
  }): Promise<{phase: StorageWriteGatePhase; epoch: string}> {
    this.assertStagingControlPlane();
    validateMetadata(input);
    validateDigest(input.windowEvidenceDigest, "invalid_window_evidence_digest");
    const requestDigest = digestJson({
      action: "ATTEST_WINDOW_CLOSED",
      expectedEpoch: input.expectedEpoch.toString(),
      windowEvidenceDigest: input.windowEvidenceDigest,
      actorUserId: input.actorUserId,
      ticket: input.ticket,
      reason: input.reason,
    });

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        phase: StorageWriteGatePhase;
        epoch: bigint;
      }>>`
        SELECT "phase", "epoch"
        FROM "StorageWriteGate"
        WHERE "scope" = ${this.scope}
        FOR UPDATE
      `;
      if (rows.length !== 1) throw new StorageWriteGateBlockedError("gate_not_provisioned");
      const gate = rows[0]!;

      const prior = await this.replay(tx, {
        action: "ATTEST_WINDOW_CLOSED",
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      });
      if (prior) {
        return {phase: prior.phaseAfter, epoch: prior.epochAfter.toString()};
      }
      if (gate.epoch !== input.expectedEpoch) throw new StorageWriteGateBlockedError("stale_epoch");
      if (gate.phase !== "DRAINING" && gate.phase !== "FROZEN") {
        throw new StorageWriteGateBlockedError("window_attestation_invalid_phase");
      }

      await tx.$executeRaw`
        UPDATE "StorageWriteGate"
        SET "recoveryWindowDigest" = ${input.windowEvidenceDigest},
            "operatorTicket" = ${input.ticket},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "scope" = ${this.scope} AND "epoch" = ${gate.epoch}
      `;
      await tx.$executeRaw`
        INSERT INTO "StorageWriteGateAudit"
          ("id", "scope", "epochBefore", "epochAfter", "phaseBefore", "phaseAfter",
           "action", "actorUserId", "ticket", "reason", "idempotencyKey",
           "requestDigest", "detailDigest", "occurredAt")
        VALUES (
          gen_random_uuid(), ${this.scope}, ${gate.epoch}, ${gate.epoch},
          ${gate.phase}, ${gate.phase}, 'ATTEST_WINDOW_CLOSED',
          ${input.actorUserId}, ${input.ticket}, ${input.reason},
          ${input.idempotencyKey}, ${requestDigest}, ${input.windowEvidenceDigest},
          CURRENT_TIMESTAMP
        )
      `;
      return {phase: gate.phase, epoch: gate.epoch.toString()};
    }, {maxWait: 3000, timeout: 8000});
  }

  async recoverOperation(input: ControlMetadata & {
    expectedEpoch: bigint;
    operationId: string;
    writerInstanceId: string;
    terminationEvidenceDigest: string;
  }): Promise<{phase: StorageWriteGatePhase; epoch: string; state: "RECOVERED_FENCED"}> {
    this.assertStagingControlPlane();
    validateMetadata(input);
    validateDigest(input.terminationEvidenceDigest, "invalid_termination_evidence_digest");
    if (!/^[0-9a-f-]{36}$/.test(input.operationId)) {
      throw new StorageWriteGateBlockedError("invalid_operation_id");
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{5,190}$/.test(input.writerInstanceId)) {
      throw new StorageWriteGateBlockedError("invalid_writer_instance");
    }
    const requestDigest = digestJson({
      action: "RECOVER_OPERATION",
      expectedEpoch: input.expectedEpoch.toString(),
      operationId: input.operationId,
      writerInstanceId: input.writerInstanceId,
      terminationEvidenceDigest: input.terminationEvidenceDigest,
      actorUserId: input.actorUserId,
      ticket: input.ticket,
      reason: input.reason,
    });

    return this.prisma.$transaction(async (tx) => {
      const gates = await tx.$queryRaw<Array<{
        phase: StorageWriteGatePhase;
        epoch: bigint;
      }>>`
        SELECT "phase", "epoch"
        FROM "StorageWriteGate"
        WHERE "scope" = ${this.scope}
        FOR UPDATE
      `;
      if (gates.length !== 1) throw new StorageWriteGateBlockedError("gate_not_provisioned");
      const gate = gates[0]!;

      const prior = await this.replay(tx, {
        action: "RECOVER_OPERATION",
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      });
      if (prior) {
        return {
          phase: prior.phaseAfter,
          epoch: prior.epochAfter.toString(),
          state: "RECOVERED_FENCED",
        };
      }
      if (gate.epoch !== input.expectedEpoch) throw new StorageWriteGateBlockedError("stale_epoch");
      if (gate.phase !== "DRAINING") throw new StorageWriteGateBlockedError("recovery_requires_draining");

      const operations = await tx.$queryRaw<Array<{
        id: string;
        epoch: bigint;
        writerInstanceId: string;
        state: string;
      }>>`
        SELECT "id", "epoch", "writerInstanceId", "state"
        FROM "StorageWriteOperation"
        WHERE "id" = ${input.operationId}::uuid
          AND "scope" = ${this.scope}
        FOR UPDATE
      `;
      if (operations.length !== 1) throw new StorageWriteGateBlockedError("operation_not_found");
      const operation = operations[0]!;
      if (
        operation.state !== "ACTIVE" ||
        operation.epoch !== gate.epoch ||
        operation.writerInstanceId !== input.writerInstanceId
      ) {
        throw new StorageWriteGateBlockedError("operation_recovery_conflict");
      }

      const updated = await tx.$executeRaw`
        UPDATE "StorageWriteOperation"
        SET "state" = 'RECOVERED_FENCED', "finishedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.operationId}::uuid
          AND "scope" = ${this.scope}
          AND "state" = 'ACTIVE'
          AND "epoch" = ${gate.epoch}
          AND "writerInstanceId" = ${input.writerInstanceId}
      `;
      if (updated !== 1) throw new StorageWriteGateBlockedError("operation_recovery_conflict");

      await tx.$executeRaw`
        INSERT INTO "StorageWriteGateAudit"
          ("id", "scope", "epochBefore", "epochAfter", "phaseBefore", "phaseAfter",
           "action", "actorUserId", "ticket", "reason", "idempotencyKey",
           "requestDigest", "targetOperationId", "detailDigest", "occurredAt")
        VALUES (
          gen_random_uuid(), ${this.scope}, ${gate.epoch}, ${gate.epoch},
          ${gate.phase}, ${gate.phase}, 'RECOVER_OPERATION',
          ${input.actorUserId}, ${input.ticket}, ${input.reason},
          ${input.idempotencyKey}, ${requestDigest},
          ${input.operationId}::uuid, ${input.terminationEvidenceDigest},
          CURRENT_TIMESTAMP
        )
      `;
      return {
        phase: gate.phase,
        epoch: gate.epoch.toString(),
        state: "RECOVERED_FENCED" as const,
      };
    }, {maxWait: 3000, timeout: 8000});
  }

  async activeOperationCount(): Promise<number> {
    this.assertStagingControlPlane();
    return (await this.coordinator.inspect(this.scope)).activeOperations;
  }
}
