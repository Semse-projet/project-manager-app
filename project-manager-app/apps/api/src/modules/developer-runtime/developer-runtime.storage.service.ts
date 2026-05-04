import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type {
  DeveloperRuntimeApprovalRecord,
  DeveloperRuntimeArtifact,
  DeveloperRuntimeMission,
  DeveloperRuntimeSession,
  DeveloperRuntimeSessionLog,
  DeveloperRuntimeValidationResult,
} from "@semse/schemas";
import {
  developerRuntimeApprovalRecordSchema,
  developerRuntimeArtifactSchema,
  developerRuntimeMissionSchema,
  developerRuntimeSessionLogSchema,
  developerRuntimeSessionSchema,
  developerRuntimeValidationResultSchema,
} from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type SessionRow = {
  id: string;
  tenantId: string;
  orgId: string;
  userId: string;
  repoId: string;
  branch: string | null;
  startedAt: Date;
  endedAt: Date | null;
  goal: string;
  state: string;
  selectedAgentsJson: unknown;
  missionId: string;
  summary: string | null;
};

type MissionRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  intentJson: unknown;
  planJson: unknown;
  riskLevel: string;
  status: string;
};

type PayloadRow = {
  payloadJson: unknown;
};

const SESSION_TABLE = `"DeveloperRuntimeSessionStore"`;
const MISSION_TABLE = `"DeveloperRuntimeMissionStore"`;
const LOG_TABLE = `"DeveloperRuntimeLogStore"`;
const VALIDATION_TABLE = `"DeveloperRuntimeValidationStore"`;
const ARTIFACT_TABLE = `"DeveloperRuntimeArtifactStore"`;
const APPROVAL_TABLE = `"DeveloperRuntimeApprovalStore"`;

function toJson(value: unknown) {
  return JSON.stringify(value);
}

@Injectable()
export class DeveloperRuntimeStorageService implements OnModuleInit {
  private readonly logger = new Logger(DeveloperRuntimeStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  async ensureTables(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${SESSION_TABLE} (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "orgId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "repoId" TEXT NOT NULL,
        branch TEXT,
        "startedAt" TIMESTAMP(3) NOT NULL,
        "endedAt" TIMESTAMP(3),
        goal TEXT NOT NULL,
        state TEXT NOT NULL,
        "selectedAgentsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "missionId" TEXT NOT NULL,
        summary TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeveloperRuntimeSessionStore_tenant_state_idx"
        ON ${SESSION_TABLE} ("tenantId", state, "startedAt" DESC)
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeveloperRuntimeSessionStore_tenant_repo_idx"
        ON ${SESSION_TABLE} ("tenantId", "repoId", "startedAt" DESC)
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${MISSION_TABLE} (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "intentJson" JSONB NOT NULL,
        "planJson" JSONB NOT NULL,
        "riskLevel" TEXT NOT NULL,
        status TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeveloperRuntimeMissionStore_tenant_session_idx"
        ON ${MISSION_TABLE} ("tenantId", "sessionId")
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${LOG_TABLE} (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "occurredAt" TIMESTAMP(3) NOT NULL,
        "payloadJson" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeveloperRuntimeLogStore_tenant_session_idx"
        ON ${LOG_TABLE} ("tenantId", "sessionId", "occurredAt" ASC)
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${VALIDATION_TABLE} (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "payloadJson" JSONB NOT NULL
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeveloperRuntimeValidationStore_tenant_session_idx"
        ON ${VALIDATION_TABLE} ("tenantId", "sessionId", "createdAt" ASC)
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${ARTIFACT_TABLE} (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "payloadJson" JSONB NOT NULL
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeveloperRuntimeArtifactStore_tenant_session_idx"
        ON ${ARTIFACT_TABLE} ("tenantId", "sessionId", "createdAt" ASC)
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${APPROVAL_TABLE} (
        id TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "requestId" TEXT NOT NULL UNIQUE,
        "requestJson" JSONB NOT NULL,
        "decisionJson" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeveloperRuntimeApprovalStore_tenant_session_idx"
        ON ${APPROVAL_TABLE} ("tenantId", "sessionId", "createdAt" ASC)
    `);

    this.logger.log("Developer runtime storage tables ensured");
  }

  async listSessions(input: {
    tenantId: string;
    repoId?: string;
    state?: DeveloperRuntimeSession["state"];
  }): Promise<DeveloperRuntimeSession[]> {
    const filters: string[] = [`"tenantId" = $1`];
    const values: unknown[] = [input.tenantId];

    if (input.repoId) {
      values.push(input.repoId);
      filters.push(`"repoId" = $${values.length}`);
    }
    if (input.state) {
      values.push(input.state);
      filters.push(`state = $${values.length}`);
    }

    const rows = await this.prisma.$queryRawUnsafe<SessionRow[]>(
      `SELECT * FROM ${SESSION_TABLE} WHERE ${filters.join(" AND ")} ORDER BY "startedAt" DESC LIMIT 500`,
      ...values,
    );

    return rows.flatMap((row: SessionRow) => {
      const parsed = developerRuntimeSessionSchema.safeParse({
        id: row.id,
        userId: row.userId,
        repoId: row.repoId,
        branch: row.branch ?? undefined,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt?.toISOString(),
        goal: row.goal,
        state: row.state,
        selectedAgents: Array.isArray(row.selectedAgentsJson) ? row.selectedAgentsJson : [],
        missionId: row.missionId,
        summary: row.summary ?? undefined,
      });
      return parsed.success ? [parsed.data] : [];
    });
  }

  async getSession(input: {
    tenantId: string;
    sessionId: string;
  }): Promise<{
    session: DeveloperRuntimeSession | null;
    mission: DeveloperRuntimeMission | null;
    logs: DeveloperRuntimeSessionLog[];
    validations: DeveloperRuntimeValidationResult[];
    artifacts: DeveloperRuntimeArtifact[];
    approvals: DeveloperRuntimeApprovalRecord[];
  }> {
    const sessionRows = await this.prisma.$queryRawUnsafe<SessionRow[]>(
      `SELECT * FROM ${SESSION_TABLE} WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      input.sessionId,
      input.tenantId,
    );
    const sessionRow = sessionRows[0];
    if (!sessionRow) {
      return {
        session: null,
        mission: null,
        logs: [],
        validations: [],
        artifacts: [],
        approvals: [],
      };
    }

    const sessionParsed = developerRuntimeSessionSchema.safeParse({
      id: sessionRow.id,
      userId: sessionRow.userId,
      repoId: sessionRow.repoId,
      branch: sessionRow.branch ?? undefined,
      startedAt: sessionRow.startedAt.toISOString(),
      endedAt: sessionRow.endedAt?.toISOString(),
      goal: sessionRow.goal,
      state: sessionRow.state,
      selectedAgents: Array.isArray(sessionRow.selectedAgentsJson) ? sessionRow.selectedAgentsJson : [],
      missionId: sessionRow.missionId,
      summary: sessionRow.summary ?? undefined,
    });
    const session = sessionParsed.success ? sessionParsed.data : null;
    if (!session) {
      return {
        session: null,
        mission: null,
        logs: [],
        validations: [],
        artifacts: [],
        approvals: [],
      };
    }

    const [missionRows, logRows, validationRows, artifactRows, approvalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<MissionRow[]>(
        `SELECT * FROM ${MISSION_TABLE} WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
        session.missionId,
        input.tenantId,
      ),
      this.prisma.$queryRawUnsafe<PayloadRow[]>(
        `SELECT "payloadJson" FROM ${LOG_TABLE} WHERE "sessionId" = $1 AND "tenantId" = $2 ORDER BY "occurredAt" ASC`,
        input.sessionId,
        input.tenantId,
      ),
      this.prisma.$queryRawUnsafe<PayloadRow[]>(
        `SELECT "payloadJson" FROM ${VALIDATION_TABLE} WHERE "sessionId" = $1 AND "tenantId" = $2 ORDER BY "createdAt" ASC`,
        input.sessionId,
        input.tenantId,
      ),
      this.prisma.$queryRawUnsafe<PayloadRow[]>(
        `SELECT "payloadJson" FROM ${ARTIFACT_TABLE} WHERE "sessionId" = $1 AND "tenantId" = $2 ORDER BY "createdAt" ASC`,
        input.sessionId,
        input.tenantId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ requestJson: unknown; decisionJson: unknown | null }>>(
        `SELECT "requestJson", "decisionJson" FROM ${APPROVAL_TABLE} WHERE "sessionId" = $1 AND "tenantId" = $2 ORDER BY "createdAt" ASC`,
        input.sessionId,
        input.tenantId,
      ),
    ]);

    const mission = missionRows.flatMap((row: MissionRow) => {
      const parsed = developerRuntimeMissionSchema.safeParse({
        id: row.id,
        sessionId: row.sessionId,
        intent: row.intentJson,
        plan: row.planJson,
        riskLevel: row.riskLevel,
        status: row.status,
      });
      return parsed.success ? [parsed.data] : [];
    })[0] ?? null;

    const logs = logRows.flatMap((row: PayloadRow) => {
      const parsed = developerRuntimeSessionLogSchema.safeParse(row.payloadJson);
      return parsed.success ? [parsed.data] : [];
    });
    const validations = validationRows.flatMap((row: PayloadRow) => {
      const parsed = developerRuntimeValidationResultSchema.safeParse(row.payloadJson);
      return parsed.success ? [parsed.data] : [];
    });
    const artifacts = artifactRows.flatMap((row: PayloadRow) => {
      const parsed = developerRuntimeArtifactSchema.safeParse(row.payloadJson);
      return parsed.success ? [parsed.data] : [];
    });
    const approvals = approvalRows.flatMap((row: { requestJson: unknown; decisionJson: unknown | null }) => {
      const parsed = developerRuntimeApprovalRecordSchema.safeParse({
        request: row.requestJson,
        decision: row.decisionJson ?? undefined,
      });
      return parsed.success ? [parsed.data] : [];
    });

    return { session, mission, logs, validations, artifacts, approvals };
  }

  async upsertSession(input: {
    tenantId: string;
    orgId: string;
    session: DeveloperRuntimeSession;
  }): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO ${SESSION_TABLE}
      (id, "tenantId", "orgId", "userId", "repoId", branch, "startedAt", "endedAt", goal, state, "selectedAgentsJson", "missionId", summary, "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,NOW())
      ON CONFLICT (id) DO UPDATE SET
        "orgId" = EXCLUDED."orgId",
        "userId" = EXCLUDED."userId",
        "repoId" = EXCLUDED."repoId",
        branch = EXCLUDED.branch,
        "startedAt" = EXCLUDED."startedAt",
        "endedAt" = EXCLUDED."endedAt",
        goal = EXCLUDED.goal,
        state = EXCLUDED.state,
        "selectedAgentsJson" = EXCLUDED."selectedAgentsJson",
        "missionId" = EXCLUDED."missionId",
        summary = EXCLUDED.summary,
        "updatedAt" = NOW()
      `,
      input.session.id,
      input.tenantId,
      input.orgId,
      input.session.userId,
      input.session.repoId,
      input.session.branch ?? null,
      new Date(input.session.startedAt),
      input.session.endedAt ? new Date(input.session.endedAt) : null,
      input.session.goal,
      input.session.state,
      toJson(input.session.selectedAgents),
      input.session.missionId,
      input.session.summary ?? null,
    );
  }

  async upsertMission(input: {
    tenantId: string;
    mission: DeveloperRuntimeMission;
  }): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO ${MISSION_TABLE}
      (id, "tenantId", "sessionId", "intentJson", "planJson", "riskLevel", status, "updatedAt")
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,NOW())
      ON CONFLICT (id) DO UPDATE SET
        "sessionId" = EXCLUDED."sessionId",
        "intentJson" = EXCLUDED."intentJson",
        "planJson" = EXCLUDED."planJson",
        "riskLevel" = EXCLUDED."riskLevel",
        status = EXCLUDED.status,
        "updatedAt" = NOW()
      `,
      input.mission.id,
      input.tenantId,
      input.mission.sessionId,
      toJson(input.mission.intent),
      toJson(input.mission.plan),
      input.mission.riskLevel,
      input.mission.status,
    );
  }

  async appendLogs(input: { tenantId: string; sessionId: string; logs: DeveloperRuntimeSessionLog[] }): Promise<void> {
    for (const log of input.logs) {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO ${LOG_TABLE} (id, "tenantId", "sessionId", "occurredAt", "payloadJson")
        VALUES ($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT (id) DO NOTHING
        `,
        log.id,
        input.tenantId,
        input.sessionId,
        new Date(log.timestamp),
        toJson(log),
      );
    }
  }

  async appendValidations(input: { tenantId: string; sessionId: string; validations: DeveloperRuntimeValidationResult[] }): Promise<void> {
    for (const validation of input.validations) {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO ${VALIDATION_TABLE} (id, "tenantId", "sessionId", "payloadJson")
        VALUES ($1,$2,$3,$4::jsonb)
        ON CONFLICT (id) DO NOTHING
        `,
        validation.id,
        input.tenantId,
        input.sessionId,
        toJson(validation),
      );
    }
  }

  async appendArtifacts(input: { tenantId: string; sessionId: string; artifacts: DeveloperRuntimeArtifact[] }): Promise<void> {
    for (const artifact of input.artifacts) {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO ${ARTIFACT_TABLE} (id, "tenantId", "sessionId", "createdAt", "payloadJson")
        VALUES ($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT (id) DO NOTHING
        `,
        artifact.id,
        input.tenantId,
        input.sessionId,
        new Date(artifact.createdAt),
        toJson(artifact),
      );
    }
  }

  async upsertApprovals(input: { tenantId: string; sessionId: string; approvals: DeveloperRuntimeApprovalRecord[] }): Promise<void> {
    for (const approval of input.approvals) {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO ${APPROVAL_TABLE} (id, "tenantId", "sessionId", "requestId", "requestJson", "decisionJson", "updatedAt")
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,NOW())
        ON CONFLICT ("requestId") DO UPDATE SET
          "decisionJson" = EXCLUDED."decisionJson",
          "updatedAt" = NOW()
        `,
        approval.request.id,
        input.tenantId,
        input.sessionId,
        approval.request.id,
        toJson(approval.request),
        approval.decision ? toJson(approval.decision) : null,
      );
    }
  }
}
