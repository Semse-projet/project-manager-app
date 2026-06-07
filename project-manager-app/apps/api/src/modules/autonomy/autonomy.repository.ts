import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AutonomyRunView } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type DbAutonomyRun = {
  id: string;
  tenantId: string;
  orgId: string;
  userId: string;
  task: string;
  status: string;
  repoPath: string;
  baseBranch: string;
  branchName: string | null;
  commitSha: string | null;
  generatedFile: string | null;
  prUrl: string | null;
  prState: string | null;
  error: string | null;
  logsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AutonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    task: string;
    repoPath: string;
    baseBranch: string;
  }): Promise<AutonomyRunView> {
    const id = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await this.prisma.$executeRaw`
      INSERT INTO "AutonomousPrRun" (
        id, "tenantId", "orgId", "userId", task, status, "repoPath", "baseBranch", "logsJson", "updatedAt"
      ) VALUES (
        ${id}, ${input.tenantId}, ${input.orgId}, ${input.userId}, ${input.task}, 'RUNNING', ${input.repoPath}, ${input.baseBranch}, ${JSON.stringify([])}::jsonb, NOW()
      )
    `;

    return this.detail({ tenantId: input.tenantId, runId: id });
  }

  async complete(input: {
    id: string;
    branchName?: string | null;
    commitSha?: string | null;
    generatedFile?: string | null;
    prUrl?: string | null;
    prState?: string | null;
    logs: unknown;
  }): Promise<AutonomyRunView> {
    await this.prisma.$executeRaw`
      UPDATE "AutonomousPrRun"
      SET
        status = 'COMPLETED',
        "branchName" = ${input.branchName ?? null},
        "commitSha" = ${input.commitSha ?? null},
        "generatedFile" = ${input.generatedFile ?? null},
        "prUrl" = ${input.prUrl ?? null},
        "prState" = ${input.prState ?? null},
        error = NULL,
        "logsJson" = ${JSON.stringify(input.logs)}::jsonb,
        "updatedAt" = NOW()
      WHERE id = ${input.id}
    `;

    const [row] = await this.query(Prisma.sql`
      SELECT * FROM "AutonomousPrRun" WHERE id = ${input.id} LIMIT 1
    `);
    return this.toView(row);
  }

  async fail(input: {
    id: string;
    error: string;
    logs: unknown;
  }): Promise<AutonomyRunView> {
    await this.prisma.$executeRaw`
      UPDATE "AutonomousPrRun"
      SET
        status = 'FAILED',
        error = ${input.error},
        "logsJson" = ${JSON.stringify(input.logs)}::jsonb,
        "updatedAt" = NOW()
      WHERE id = ${input.id}
    `;
    const [row] = await this.query(Prisma.sql`
      SELECT * FROM "AutonomousPrRun" WHERE id = ${input.id} LIMIT 1
    `);
    return this.toView(row);
  }

  async list(input: { tenantId: string }): Promise<AutonomyRunView[]> {
    const records = await this.query(Prisma.sql`
      SELECT * FROM "AutonomousPrRun"
      WHERE "tenantId" = ${input.tenantId}
      ORDER BY "createdAt" DESC
      LIMIT 50
    `);
    return records.map((record) => this.toView(record));
  }

  async detail(input: { tenantId: string; runId: string }): Promise<AutonomyRunView> {
    const [record] = await this.query(Prisma.sql`
      SELECT * FROM "AutonomousPrRun"
      WHERE "tenantId" = ${input.tenantId}
        AND id = ${input.runId}
      LIMIT 1
    `);

    if (!record) {
      throw new NotFoundException({ message: `Autonomy run ${input.runId} was not found` });
    }

    return this.toView(record);
  }

  private async query(query: Prisma.Sql): Promise<DbAutonomyRun[]> {
    return (await this.prisma.$queryRaw<DbAutonomyRun[]>(query)) as DbAutonomyRun[];
  }

  private toView(record: DbAutonomyRun): AutonomyRunView {
    return {
      id: record.id,
      tenantId: record.tenantId,
      orgId: record.orgId,
      userId: record.userId,
      task: record.task,
      status: record.status as AutonomyRunView["status"],
      repoPath: record.repoPath,
      baseBranch: record.baseBranch,
      branchName: record.branchName,
      commitSha: record.commitSha,
      generatedFile: record.generatedFile,
      generatedContent: null,
      prUrl: record.prUrl,
      prState: record.prState,
      error: record.error,
      currentStage: null,
      targetStage: null,
      nextStage: null,
      completedStageCount: 0,
      logs: Array.isArray(record.logsJson) ? (record.logsJson as AutonomyRunView["logs"]) : [],
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }
}
