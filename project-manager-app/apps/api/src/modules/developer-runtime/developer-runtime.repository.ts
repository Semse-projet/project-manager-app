import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  DeveloperRuntimeApprovalRecord,
  DeveloperRuntimeArtifact,
  DeveloperRuntimeSessionLog,
  DeveloperRuntimeMission,
  DeveloperRuntimeSession,
  DeveloperRuntimeValidationResult,
} from "@semse/schemas";
import {
  developerRuntimeArtifactSchema,
  developerRuntimeApprovalRecordSchema,
  developerRuntimeSessionLogSchema,
  developerRuntimeMissionSchema,
  developerRuntimeSessionSchema,
  developerRuntimeValidationResultSchema,
} from "@semse/schemas";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { DeveloperRuntimeStorageService } from "./developer-runtime.storage.service.js";

const SESSION_ENTITY_TYPE = "DeveloperRuntimeSession";
const MISSION_ENTITY_TYPE = "DeveloperRuntimeMission";
const LOG_ENTITY_TYPE = "DeveloperRuntimeLog";
const VALIDATION_ENTITY_TYPE = "DeveloperRuntimeValidation";
const ARTIFACT_ENTITY_TYPE = "DeveloperRuntimeArtifact";
const APPROVAL_ENTITY_TYPE = "DeveloperRuntimeApproval";

type Actor = {
  tenantId: string;
  orgId: string;
  userId: string;
};

type AuditSnapshotRow = {
  entityId: string;
  afterJson: unknown;
  occurredAt: Date;
};

function extractSnapshotPayload(
  payload: unknown,
  key: "session" | "mission" | "log" | "validation" | "artifact",
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const snapshot = record[key];
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  return snapshot as Record<string, unknown>;
}

function extractApprovalSnapshot(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const approval = record.approval;
  if (!approval || typeof approval !== "object") {
    return null;
  }

  return approval as Record<string, unknown>;
}

@Injectable()
export class DeveloperRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
    private readonly auditService: AuditService,
    private readonly storage: DeveloperRuntimeStorageService,
  ) {}

  async listSessions(input: {
    actor: Actor;
    filters?: { repoId?: string; state?: DeveloperRuntimeSession["state"] };
  }): Promise<DeveloperRuntimeSession[]> {
    await this.actorContextService.ensureActorContext(input.actor);

    const stored = await this.storage.listSessions({
      tenantId: input.actor.tenantId,
      repoId: input.filters?.repoId,
      state: input.filters?.state,
    });
    if (stored.length > 0) {
      return stored;
    }

    const rows = (await this.prisma.auditLog.findMany({
      where: {
        tenantId: input.actor.tenantId,
        entityType: SESSION_ENTITY_TYPE,
      },
      orderBy: { occurredAt: "desc" },
      take: 500,
      select: {
        entityId: true,
        afterJson: true,
        occurredAt: true,
      },
    })) as AuditSnapshotRow[];

    const latestById = new Map<string, DeveloperRuntimeSession>();

    for (const row of rows) {
      if (latestById.has(row.entityId)) {
        continue;
      }

      const snapshot = extractSnapshotPayload(row.afterJson, "session");
      if (!snapshot) {
        continue;
      }

      const parsed = developerRuntimeSessionSchema.safeParse(snapshot);
      if (!parsed.success) {
        continue;
      }

      if (input.filters?.repoId && parsed.data.repoId !== input.filters.repoId) {
        continue;
      }
      if (input.filters?.state && parsed.data.state !== input.filters.state) {
        continue;
      }

      latestById.set(row.entityId, parsed.data);
    }

    return Array.from(latestById.values()).sort((a, b) => (
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    ));
  }

  async getSession(input: {
    actor: Actor;
    sessionId: string;
  }): Promise<{
    session: DeveloperRuntimeSession;
    mission: DeveloperRuntimeMission | null;
    logs: DeveloperRuntimeSessionLog[];
    validations: DeveloperRuntimeValidationResult[];
    artifacts: DeveloperRuntimeArtifact[];
    approvals: DeveloperRuntimeApprovalRecord[];
  }> {
    await this.actorContextService.ensureActorContext(input.actor);

    const stored = await this.storage.getSession({
      tenantId: input.actor.tenantId,
      sessionId: input.sessionId,
    });
    if (stored.session) {
      return {
        session: stored.session,
        mission: stored.mission,
        logs: stored.logs,
        validations: stored.validations,
        artifacts: stored.artifacts,
        approvals: stored.approvals,
      };
    }

    const sessionRow = (await this.prisma.auditLog.findFirst({
      where: {
        tenantId: input.actor.tenantId,
        entityType: SESSION_ENTITY_TYPE,
        entityId: input.sessionId,
      },
      orderBy: { occurredAt: "desc" },
      select: {
        entityId: true,
        afterJson: true,
        occurredAt: true,
      },
    })) as AuditSnapshotRow | null;

    if (!sessionRow) {
      throw new NotFoundException(`Developer runtime session ${input.sessionId} not found`);
    }

    const sessionSnapshot = extractSnapshotPayload(sessionRow.afterJson, "session");
    const sessionParsed = developerRuntimeSessionSchema.safeParse(sessionSnapshot);
    if (!sessionParsed.success) {
      throw new NotFoundException(`Developer runtime session ${input.sessionId} not found`);
    }

    const missionRow = (await this.prisma.auditLog.findFirst({
      where: {
        tenantId: input.actor.tenantId,
        entityType: MISSION_ENTITY_TYPE,
        entityId: sessionParsed.data.missionId,
      },
      orderBy: { occurredAt: "desc" },
      select: {
        entityId: true,
        afterJson: true,
        occurredAt: true,
      },
    })) as AuditSnapshotRow | null;

    if (!missionRow) {
      return {
        session: sessionParsed.data,
        mission: null,
        logs: [],
        validations: [],
        artifacts: [],
        approvals: [],
      };
    }

    const missionSnapshot = extractSnapshotPayload(missionRow.afterJson, "mission");
    const missionParsed = developerRuntimeMissionSchema.safeParse(missionSnapshot);
    const [logRows, validationRows, artifactRows, approvalRows] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          tenantId: input.actor.tenantId,
          entityType: LOG_ENTITY_TYPE,
          entityId: input.sessionId,
        },
        orderBy: { occurredAt: "asc" },
        select: {
          entityId: true,
          afterJson: true,
          occurredAt: true,
        },
      }) as Promise<AuditSnapshotRow[]>,
      this.prisma.auditLog.findMany({
        where: {
          tenantId: input.actor.tenantId,
          entityType: VALIDATION_ENTITY_TYPE,
          entityId: input.sessionId,
        },
        orderBy: { occurredAt: "asc" },
        select: {
          entityId: true,
          afterJson: true,
          occurredAt: true,
        },
      }) as Promise<AuditSnapshotRow[]>,
      this.prisma.auditLog.findMany({
        where: {
          tenantId: input.actor.tenantId,
          entityType: ARTIFACT_ENTITY_TYPE,
          entityId: input.sessionId,
        },
        orderBy: { occurredAt: "asc" },
        select: {
          entityId: true,
          afterJson: true,
          occurredAt: true,
        },
      }) as Promise<AuditSnapshotRow[]>,
      this.prisma.auditLog.findMany({
        where: {
          tenantId: input.actor.tenantId,
          entityType: APPROVAL_ENTITY_TYPE,
          entityId: input.sessionId,
        },
        orderBy: { occurredAt: "asc" },
        select: {
          entityId: true,
          afterJson: true,
          occurredAt: true,
        },
      }) as Promise<AuditSnapshotRow[]>,
    ]);

    const logs = logRows.flatMap((row) => {
      const snapshot = extractSnapshotPayload(row.afterJson, "log");
      const parsed = developerRuntimeSessionLogSchema.safeParse(snapshot);
      return parsed.success ? [parsed.data] : [];
    });

    const validations = validationRows.flatMap((row) => {
      const snapshot = extractSnapshotPayload(row.afterJson, "validation");
      const parsed = developerRuntimeValidationResultSchema.safeParse(snapshot);
      return parsed.success ? [parsed.data] : [];
    });

    const artifacts = artifactRows.flatMap((row) => {
      const snapshot = extractSnapshotPayload(row.afterJson, "artifact");
      const parsed = developerRuntimeArtifactSchema.safeParse(snapshot);
      return parsed.success ? [parsed.data] : [];
    });

    const approvalsByRequestId = new Map<string, DeveloperRuntimeApprovalRecord>();
    for (const row of approvalRows) {
      const snapshot = extractApprovalSnapshot(row.afterJson);
      const parsed = developerRuntimeApprovalRecordSchema.safeParse(snapshot);
      if (!parsed.success) {
        continue;
      }
      approvalsByRequestId.set(parsed.data.request.id, parsed.data);
    }

    return {
      session: sessionParsed.data,
      mission: missionParsed.success ? missionParsed.data : null,
      logs,
      validations,
      artifacts,
      approvals: Array.from(approvalsByRequestId.values()).sort((a, b) => (
        new Date(a.request.createdAt).getTime() - new Date(b.request.createdAt).getTime()
      )),
    };
  }

  async createSession(input: {
    actor: Actor;
    requestId: string;
    session: DeveloperRuntimeSession;
  }): Promise<DeveloperRuntimeSession> {
    await this.actorContextService.ensureActorContext(input.actor);

    await this.storage.upsertSession({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      session: input.session,
    });

    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      requestId: input.requestId,
      timestamp: input.session.startedAt,
      action: "developer_runtime.session.created",
      entityType: SESSION_ENTITY_TYPE,
      entityId: input.session.id,
      afterJson: {
        session: input.session,
      },
    });

    return input.session;
  }

  async saveMission(input: {
    actor: Actor;
    requestId: string;
    session: DeveloperRuntimeSession;
    mission: DeveloperRuntimeMission;
    logs: DeveloperRuntimeSessionLog[];
    validations: DeveloperRuntimeValidationResult[];
    artifacts: DeveloperRuntimeArtifact[];
    approvals?: DeveloperRuntimeApprovalRecord[];
  }): Promise<DeveloperRuntimeMission> {
    await this.actorContextService.ensureActorContext(input.actor);

    await this.storage.upsertSession({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      session: input.session,
    });
    await this.storage.upsertMission({
      tenantId: input.actor.tenantId,
      mission: input.mission,
    });
    await this.storage.appendLogs({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      logs: input.logs,
    });
    await this.storage.appendValidations({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      validations: input.validations,
    });
    await this.storage.appendArtifacts({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      artifacts: input.artifacts,
    });
    await this.storage.upsertApprovals({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      approvals: input.approvals ?? [],
    });

    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      action: "developer_runtime.session.updated",
      entityType: SESSION_ENTITY_TYPE,
      entityId: input.session.id,
      afterJson: {
        session: input.session,
      },
    });

    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      action: "developer_runtime.mission.planned",
      entityType: MISSION_ENTITY_TYPE,
      entityId: input.mission.id,
      afterJson: {
        mission: input.mission,
      },
    });

    for (const log of input.logs) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: log.timestamp,
        action: "developer_runtime.log.recorded",
        entityType: LOG_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          log,
        },
      });
    }

    for (const validation of input.validations) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        action: "developer_runtime.validation.previewed",
        entityType: VALIDATION_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          validation,
        },
      });
    }

    for (const artifact of input.artifacts) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        action: "developer_runtime.artifact.recorded",
        entityType: ARTIFACT_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          artifact,
        },
      });
    }

    for (const approval of input.approvals ?? []) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: approval.decision?.decidedAt ?? approval.request.createdAt,
        action: approval.decision
          ? "developer_runtime.approval.resolved"
          : "developer_runtime.approval.requested",
        entityType: APPROVAL_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          approval,
        },
      });
    }

    return input.mission;
  }

  async saveExecutionUpdate(input: {
    actor: Actor;
    requestId: string;
    session: DeveloperRuntimeSession;
    mission: DeveloperRuntimeMission;
    logs?: DeveloperRuntimeSessionLog[];
    validations?: DeveloperRuntimeValidationResult[];
    artifacts?: DeveloperRuntimeArtifact[];
    approvals?: DeveloperRuntimeApprovalRecord[];
    sessionAction: string;
    missionAction: string;
  }): Promise<{ session: DeveloperRuntimeSession; mission: DeveloperRuntimeMission }> {
    await this.actorContextService.ensureActorContext(input.actor);

    await this.storage.upsertSession({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      session: input.session,
    });
    await this.storage.upsertMission({
      tenantId: input.actor.tenantId,
      mission: input.mission,
    });
    await this.storage.appendLogs({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      logs: input.logs ?? [],
    });
    await this.storage.appendValidations({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      validations: input.validations ?? [],
    });
    await this.storage.appendArtifacts({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      artifacts: input.artifacts ?? [],
    });
    await this.storage.upsertApprovals({
      tenantId: input.actor.tenantId,
      sessionId: input.session.id,
      approvals: input.approvals ?? [],
    });

    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      action: input.sessionAction,
      entityType: SESSION_ENTITY_TYPE,
      entityId: input.session.id,
      afterJson: {
        session: input.session,
      },
    });

    await this.auditService.append({
      tenantId: input.actor.tenantId,
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      action: input.missionAction,
      entityType: MISSION_ENTITY_TYPE,
      entityId: input.mission.id,
      afterJson: {
        mission: input.mission,
      },
    });

    for (const log of input.logs ?? []) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: log.timestamp,
        action: "developer_runtime.log.recorded",
        entityType: LOG_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          log,
        },
      });
    }

    for (const validation of input.validations ?? []) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        action: "developer_runtime.validation.recorded",
        entityType: VALIDATION_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          validation,
        },
      });
    }

    for (const artifact of input.artifacts ?? []) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        action: "developer_runtime.artifact.recorded",
        entityType: ARTIFACT_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          artifact,
        },
      });
    }

    for (const approval of input.approvals ?? []) {
      await this.auditService.append({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        actorUserId: input.actor.userId,
        requestId: input.requestId,
        timestamp: approval.decision?.decidedAt ?? approval.request.createdAt,
        action: approval.decision
          ? "developer_runtime.approval.resolved"
          : "developer_runtime.approval.requested",
        entityType: APPROVAL_ENTITY_TYPE,
        entityId: input.session.id,
        afterJson: {
          approval,
        },
      });
    }

    return {
      session: input.session,
      mission: input.mission,
    };
  }

  async appendProgressLog(input: {
    actor: { tenantId: string; orgId: string; userId: string };
    sessionId: string;
    log: DeveloperRuntimeSessionLog;
  }): Promise<void> {
    await this.actorContextService.ensureActorContext(input.actor);
    await this.storage.appendLogs({
      tenantId: input.actor.tenantId,
      sessionId: input.sessionId,
      logs: [input.log],
    });
  }
}
