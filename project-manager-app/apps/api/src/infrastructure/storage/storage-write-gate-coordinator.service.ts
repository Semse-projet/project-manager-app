import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import path from "node:path";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  assertStorageWriteAdmission,
  assertStorageWritePublication,
  resolveStorageWriteGateTransition,
  StorageWriteGateBlockedError,
  type StorageWriteGateAction,
  type StorageWriteGatePhase,
  type StorageWriteGateSnapshot,
} from "./storage-write-gate-state.js";

export type StorageWriteScope = Readonly<{
  environmentKey: string;
  storageRoot: string;
}>;

export type StorageWriteOperationView = Readonly<{
  id: string;
  operationKey: string;
  writerKind: string;
  status: "ACTIVE" | "COMPLETED" | "ABORTED" | "AMBIGUOUS";
}>;

export type StorageWriteGateView = StorageWriteGateSnapshot & Readonly<{
  id: string;
  environmentKey: string;
  storageRoot: string;
  version: number;
}>;

type GateRow = Readonly<{
  id: string;
  environmentKey: string;
  storageRoot: string;
  phase: StorageWriteGatePhase;
  writerCoverageComplete: boolean;
  version: number;
}>;

type TransitionRequest = Readonly<{
  action: StorageWriteGateAction;
  administratorAuthorized: boolean;
  ticket: string;
  recoveryWindowClosed?: boolean;
  actorId?: string;
  reason?: string;
}>;

type CoverageRequest = Readonly<{
  complete: boolean;
  administratorAuthorized: boolean;
  ticket: string;
  actorId?: string;
  reason?: string;
}>;

function blocked(reason: string): never {
  throw new StorageWriteGateBlockedError(reason);
}

function validAuditToken(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/.test(value);
}

function validWriterKind(value: string): boolean {
  return /^[a-z][a-z0-9._:-]{1,63}$/.test(value);
}

function normalizeScope(scope: StorageWriteScope): StorageWriteScope {
  if (!scope || typeof scope.environmentKey !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(scope.environmentKey)) {
    return blocked("invalid_scope");
  }
  const root = scope.storageRoot;
  if (typeof root !== "string" || !path.posix.isAbsolute(root) ||
      root.includes("\\") || root.includes("\0") ||
      path.posix.normalize(root) !== root ||
      (root !== "/data" && !root.startsWith("/data/"))) {
    return blocked("invalid_scope");
  }
  return { environmentKey: scope.environmentKey, storageRoot: root };
}

@Injectable()
export class StorageWriteGateCoordinator {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private async serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async lockGate(
    tx: Prisma.TransactionClient,
    scopeInput: StorageWriteScope,
  ): Promise<GateRow> {
    const scope = normalizeScope(scopeInput);
    const found = await tx.storageWriteGate.findUnique({
      where: {
        environmentKey_storageRoot: {
          environmentKey: scope.environmentKey,
          storageRoot: scope.storageRoot,
        },
      },
      select: { id: true },
    });
    if (!found) return blocked("gate_uninitialized");

    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "StorageWriteGate"
      WHERE "id" = ${found.id}
      FOR UPDATE
    `);
    if (locked.length !== 1) return blocked("gate_uninitialized");

    const gate = await tx.storageWriteGate.findUnique({
      where: { id: found.id },
      select: {
        id: true,
        environmentKey: true,
        storageRoot: true,
        phase: true,
        writerCoverageComplete: true,
        version: true,
      },
    });
    if (!gate) return blocked("gate_uninitialized");
    return gate as GateRow;
  }

  private async snapshotUnderLock(
    tx: Prisma.TransactionClient,
    gate: GateRow,
  ): Promise<StorageWriteGateView> {
    const [activeOperations, ambiguousOperations] = await Promise.all([
      tx.storageWriteOperation.count({ where: { gateId: gate.id, status: "ACTIVE" } }),
      tx.storageWriteOperation.count({ where: { gateId: gate.id, status: "AMBIGUOUS" } }),
    ]);
    return {
      id: gate.id,
      environmentKey: gate.environmentKey,
      storageRoot: gate.storageRoot,
      phase: gate.phase,
      activeOperations,
      ambiguousOperations,
      writerCoverageComplete: gate.writerCoverageComplete,
      version: gate.version,
    };
  }

  async getSnapshot(scope: StorageWriteScope): Promise<StorageWriteGateView> {
    return this.serializable(async tx => {
      const gate = await this.lockGate(tx, scope);
      return this.snapshotUnderLock(tx, gate);
    });
  }

  /**
   * Admit one logical writer operation. The row lock serializes this admission
   * with BEGIN_DRAIN, so a new ACTIVE operation cannot cross into DRAINING.
   * Repeating the same operationKey is idempotent and never re-opens a write.
   */
  async admitOperation(input: {
    scope: StorageWriteScope;
    operationKey: string;
    writerKind: string;
  }): Promise<StorageWriteOperationView> {
    if (!validAuditToken(input.operationKey)) return blocked("invalid_operation_key");
    if (!validWriterKind(input.writerKind)) return blocked("invalid_writer_kind");

    return this.serializable(async tx => {
      const gate = await this.lockGate(tx, input.scope);
      const existing = await tx.storageWriteOperation.findUnique({
        where: {
          gateId_operationKey: {
            gateId: gate.id,
            operationKey: input.operationKey,
          },
        },
      });
      if (existing) {
        if (existing.writerKind !== input.writerKind) return blocked("operation_key_conflict");
        if (existing.status === "AMBIGUOUS") return blocked("operation_ambiguous");
        if (existing.status === "ABORTED") return blocked("operation_aborted");
        return {
          id: existing.id,
          operationKey: existing.operationKey,
          writerKind: existing.writerKind,
          status: existing.status,
        } as StorageWriteOperationView;
      }

      const snapshot = await this.snapshotUnderLock(tx, gate);
      assertStorageWriteAdmission(snapshot, true);
      const created = await tx.storageWriteOperation.create({
        data: {
          gateId: gate.id,
          operationKey: input.operationKey,
          writerKind: input.writerKind,
          status: "ACTIVE",
        },
      });
      return {
        id: created.id,
        operationKey: created.operationKey,
        writerKind: created.writerKind,
        status: created.status,
      } as StorageWriteOperationView;
    });
  }

  /**
   * Fence publication immediately before link()/rename()/reference commit.
   * An ACTIVE ticket is required and publication is impossible after FROZEN.
   */
  async assertPublication(operationId: string): Promise<void> {
    if (!validAuditToken(operationId)) return blocked("invalid_operation_id");
    await this.serializable(async tx => {
      const first = await tx.storageWriteOperation.findUnique({ where: { id: operationId } });
      if (!first) return blocked("operation_not_found");
      const gate = await this.lockGateById(tx, first.gateId);
      const operation = await tx.storageWriteOperation.findUnique({ where: { id: operationId } });
      if (!operation) return blocked("operation_not_found");
      const snapshot = await this.snapshotUnderLock(tx, gate);
      assertStorageWritePublication(snapshot, true, operation.status === "ACTIVE");
    });
  }

  async completeOperation(operationId: string): Promise<StorageWriteOperationView> {
    return this.finishOperation(operationId, "COMPLETED");
  }

  async abortOperation(operationId: string): Promise<StorageWriteOperationView> {
    return this.finishOperation(operationId, "ABORTED");
  }

  async markOperationAmbiguous(operationId: string, reason: string): Promise<StorageWriteOperationView> {
    if (typeof reason !== "string" || reason.trim().length < 3 || reason.length > 512) {
      return blocked("invalid_ambiguity_reason");
    }
    return this.finishOperation(operationId, "AMBIGUOUS", reason.trim());
  }

  private async finishOperation(
    operationId: string,
    target: "COMPLETED" | "ABORTED" | "AMBIGUOUS",
    ambiguityReason?: string,
  ): Promise<StorageWriteOperationView> {
    if (!validAuditToken(operationId)) return blocked("invalid_operation_id");
    return this.serializable(async tx => {
      const first = await tx.storageWriteOperation.findUnique({ where: { id: operationId } });
      if (!first) return blocked("operation_not_found");
      await this.lockGateById(tx, first.gateId);
      const current = await tx.storageWriteOperation.findUnique({ where: { id: operationId } });
      if (!current) return blocked("operation_not_found");

      if (current.status === target) {
        return {
          id: current.id,
          operationKey: current.operationKey,
          writerKind: current.writerKind,
          status: current.status,
        } as StorageWriteOperationView;
      }
      if (current.status !== "ACTIVE") return blocked("operation_terminal");

      const updated = await tx.storageWriteOperation.update({
        where: { id: current.id },
        data: {
          status: target,
          completedAt: new Date(),
          ambiguityReason: target === "AMBIGUOUS" ? ambiguityReason : null,
        },
      });
      return {
        id: updated.id,
        operationKey: updated.operationKey,
        writerKind: updated.writerKind,
        status: updated.status,
      } as StorageWriteOperationView;
    });
  }

  async setWriterCoverage(scope: StorageWriteScope, request: CoverageRequest): Promise<StorageWriteGateView> {
    if (!request.administratorAuthorized) return blocked("administrator_required");
    if (!validAuditToken(request.ticket)) return blocked("invalid_audit_ticket");

    return this.serializable(async tx => {
      const gate = await this.lockGate(tx, scope);
      if (gate.phase === "FROZEN" && request.complete !== true) {
        return blocked("inconsistent_frozen_snapshot");
      }
      const updated = await tx.storageWriteGate.update({
        where: { id: gate.id },
        data: {
          writerCoverageComplete: request.complete,
          version: { increment: 1 },
          lastTransitionTicket: request.ticket,
        },
        select: {
          id: true,
          environmentKey: true,
          storageRoot: true,
          phase: true,
          writerCoverageComplete: true,
          version: true,
        },
      });
      await tx.storageWriteGateTransitionLog.create({
        data: {
          gateId: gate.id,
          ticket: request.ticket,
          action: "SET_WRITER_COVERAGE",
          fromPhase: gate.phase,
          toPhase: gate.phase,
          actorId: request.actorId,
          reason: request.reason,
        },
      });
      return this.snapshotUnderLock(tx, updated as GateRow);
    });
  }

  async transition(scope: StorageWriteScope, request: TransitionRequest): Promise<StorageWriteGateView> {
    if (!validAuditToken(request.ticket)) return blocked("invalid_audit_ticket");

    return this.serializable(async tx => {
      const gate = await this.lockGate(tx, scope);
      const snapshot = await this.snapshotUnderLock(tx, gate);
      const toPhase = resolveStorageWriteGateTransition(snapshot, {
        action: request.action,
        administratorAuthorized: request.administratorAuthorized,
        ticket: request.ticket,
        authorityAvailable: true,
        recoveryWindowClosed: request.recoveryWindowClosed,
      });

      const updated = await tx.storageWriteGate.update({
        where: { id: gate.id },
        data: {
          phase: toPhase,
          version: { increment: 1 },
          lastTransitionTicket: request.ticket,
          frozenAt: toPhase === "FROZEN" ? new Date() :
            request.action === "THAW" || request.action === "ABORT_DRAIN" ? null : undefined,
        },
        select: {
          id: true,
          environmentKey: true,
          storageRoot: true,
          phase: true,
          writerCoverageComplete: true,
          version: true,
        },
      });

      await tx.storageWriteGateTransitionLog.create({
        data: {
          gateId: gate.id,
          ticket: request.ticket,
          action: request.action,
          fromPhase: gate.phase,
          toPhase,
          actorId: request.actorId,
          reason: request.reason,
        },
      });
      return this.snapshotUnderLock(tx, updated as GateRow);
    });
  }

  private async lockGateById(
    tx: Prisma.TransactionClient,
    gateId: string,
  ): Promise<GateRow> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "StorageWriteGate"
      WHERE "id" = ${gateId}
      FOR UPDATE
    `);
    if (locked.length !== 1) return blocked("gate_uninitialized");

    const gate = await tx.storageWriteGate.findUnique({
      where: { id: gateId },
      select: {
        id: true,
        environmentKey: true,
        storageRoot: true,
        phase: true,
        writerCoverageComplete: true,
        version: true,
      },
    });
    if (!gate) return blocked("gate_uninitialized");
    return gate as GateRow;
  }
}
