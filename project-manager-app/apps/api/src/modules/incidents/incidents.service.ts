import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";
import { findProjectLinkByJobIdOrThrow } from "../projects/project-link.repository.js";

async function assertJobAccess(
  prisma: PrismaService,
  input: { tenantId: string; jobId: string; orgId: string; roles: string[] },
): Promise<void> {
  if (input.roles.includes("OPS_ADMIN")) return;
  const project = await findProjectLinkByJobIdOrThrow(prisma, { tenantId: input.tenantId, jobId: input.jobId });
  if (input.orgId !== project.job.clientOrgId && input.orgId !== project.assignedProOrgId) {
    throw new ForbiddenException("actor is not assigned to this job");
  }
}

export interface IncidentRecord {
  id: string;
  tenantId: string;
  jobId: string;
  reportedBy: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toIncidentRecord(row: {
  id: string; tenantId: string; jobId: string; reportedBy: string;
  type: string; severity: string; status: string; title: string;
  description: string | null; resolvedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): IncidentRecord {
  return {
    ...row,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const MOCK_INCIDENTS: IncidentRecord[] = [];

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByWorker(input: { tenantId: string; userId: string; status?: string }): Promise<IncidentRecord[]> {
    if (!databaseEnabled()) return MOCK_INCIDENTS;
    const rows = await this.prisma.jobIncident.findMany({
      where: { tenantId: input.tenantId, reportedBy: input.userId, ...(input.status ? { status: input.status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toIncidentRecord);
  }

  async listByJob(input: { tenantId: string; jobId: string; orgId: string; roles: string[] }): Promise<IncidentRecord[]> {
    if (!databaseEnabled()) return MOCK_INCIDENTS;
    await assertJobAccess(this.prisma, input);
    const rows = await this.prisma.jobIncident.findMany({
      where: { tenantId: input.tenantId, jobId: input.jobId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toIncidentRecord);
  }

  async listAll(input: { tenantId: string; status?: string; severity?: string }): Promise<IncidentRecord[]> {
    if (!databaseEnabled()) return MOCK_INCIDENTS;
    const rows = await this.prisma.jobIncident.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toIncidentRecord);
  }

  async create(input: {
    tenantId: string; jobId: string; reportedBy: string;
    type: string; severity: string; title: string; description?: string;
    orgId: string; roles: string[];
  }): Promise<IncidentRecord> {
    if (!input.title.trim()) throw new BadRequestException("title required");

    if (!databaseEnabled()) {
      const mock: IncidentRecord = {
        id: `inc_${Date.now()}`,
        tenantId: input.tenantId,
        jobId: input.jobId,
        reportedBy: input.reportedBy,
        type: input.type,
        severity: input.severity,
        title: input.title,
        status: "open",
        resolvedAt: null,
        description: input.description ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      MOCK_INCIDENTS.push(mock);
      return mock;
    }

    await assertJobAccess(this.prisma, input);

    const row = await this.prisma.jobIncident.create({
      data: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        reportedBy: input.reportedBy,
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description,
      },
    });
    return toIncidentRecord(row);
  }

  async resolve(input: { tenantId: string; incidentId: string }): Promise<IncidentRecord> {
    if (!databaseEnabled()) {
      const inc = MOCK_INCIDENTS.find(i => i.id === input.incidentId);
      if (inc) { inc.status = "resolved"; inc.resolvedAt = new Date().toISOString(); }
      return inc ?? ({} as IncidentRecord);
    }
    const row = await this.prisma.jobIncident.update({
      where: { id: input.incidentId, tenantId: input.tenantId },
      data: { status: "resolved", resolvedAt: new Date() },
    });
    return toIncidentRecord(row);
  }
}
