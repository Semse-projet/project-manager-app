import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { computeLaborTime, elapsedMinutes } from "./labor-policy.calc.js";

/**
 * BO-08 — política de horario versionada y correcciones auditadas de horas.
 * Spec: docs/specs/core/labor-policy.spec.md
 *
 * El horario es un dato versionado (OPEN-09), no una regla fija. Una corrección
 * guarda el valor original y exige revisión de otra persona: nunca se edita en
 * silencio. Sin nómina y sin GPS (eso es BO-09).
 */
const MANAGE = "org:labor:manage";

export type LaborActor = { tenantId: string; orgId: string; userId: string; roles: string[] };

export function isLaborPolicyEnabled(): boolean {
  return process.env.SEMSE_LABOR_POLICY_ENABLED === "true";
}

export type PolicyInput = {
  name: string;
  worksiteId?: string;
  weekdays: number[];
  scheduledStartMinute: number;
  scheduledEndMinute: number;
  expectedBreakMinutes?: number;
  overtimeAfterMinutesPerDay?: number;
};

export type CorrectionInput = {
  timeEntryId: string;
  startedAt?: Date;
  endedAt?: Date;
  breakMinutes?: number;
  reason: string;
};

type PolicyRow = {
  id: string;
  orgId: string;
  worksiteId: string | null;
  name: string;
  version: number;
  status: string;
  weekdays: number[];
  scheduledStartMinute: number;
  scheduledEndMinute: number;
  expectedBreakMinutes: number;
  overtimeAfterMinutesPerDay: number | null;
  createdAt: Date;
};

type CorrectionRow = {
  id: string;
  orgId: string;
  timeEntryId: string;
  requestedByUserId: string;
  originalStartedAt: Date;
  originalEndedAt: Date | null;
  originalBreakMinutes: number;
  proposedStartedAt: Date;
  proposedEndedAt: Date | null;
  proposedBreakMinutes: number;
  reason: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class LaborPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isLaborPolicyEnabled()) {
      throw new NotFoundException();
    }
  }

  private async requireManage(actor: LaborActor, orgId: string): Promise<void> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (memberships.length === 0) {
      throw new NotFoundException();
    }
    if (!hasPermission(memberships.map((m) => m.role.key), MANAGE)) {
      throw new ForbiddenException();
    }
  }

  private async record(
    tenantId: string,
    orgId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    requestId: string,
    afterJson: Record<string, unknown>
  ): Promise<void> {
    await this.audit.append({
      tenantId,
      orgId,
      actorUserId,
      action,
      entityType,
      entityId,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson
    });
  }

  async createPolicy(actor: LaborActor, orgId: string, requestId: string, input: PolicyInput) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
    if (weekdays.length === 0 || weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new UnprocessableEntityException("Días de la semana no válidos");
    }
    const { scheduledStartMinute: start, scheduledEndMinute: end } = input;
    if ([start, end].some((m) => !Number.isInteger(m) || m < 0 || m > 1439) || start === end) {
      throw new UnprocessableEntityException("Horario no válido");
    }
    const scopeKey = input.worksiteId ?? "ORG";
    if (input.worksiteId) {
      const worksite = await this.prisma.worksite.findFirst({
        where: { id: input.worksiteId, orgId, tenantId: actor.tenantId }
      });
      if (!worksite) {
        throw new UnprocessableEntityException("Obra no encontrada en esta organización");
      }
    }
    let created: PolicyRow;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const current = await tx.laborSchedulePolicy.findFirst({
          where: { tenantId: actor.tenantId, orgId, scopeKey, status: "ACTIVE" },
          orderBy: { version: "desc" }
        });
        if (current) {
          await tx.laborSchedulePolicy.updateMany({
            where: { id: current.id, status: "ACTIVE" },
            data: { status: "SUPERSEDED", supersededAt: new Date() }
          });
        }
        return tx.laborSchedulePolicy.create({
          data: {
            tenantId: actor.tenantId,
            orgId,
            scopeKey,
            worksiteId: input.worksiteId ?? null,
            name: input.name,
            version: (current?.version ?? 0) + 1,
            weekdays,
            scheduledStartMinute: start,
            scheduledEndMinute: end,
            expectedBreakMinutes: input.expectedBreakMinutes ?? 0,
            overtimeAfterMinutesPerDay: input.overtimeAfterMinutesPerDay ?? null,
            createdByUserId: actor.userId
          }
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("Otra política se publicó al mismo tiempo; vuelve a intentar");
      }
      throw error;
    }
    await this.record(actor.tenantId, orgId, actor.userId, "labor_policy.created", "LaborSchedulePolicy", created.id, requestId, {
      scopeKey,
      version: created.version
    });
    return this.policyView(created);
  }

  async listPolicies(actor: LaborActor, orgId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const rows = await this.prisma.laborSchedulePolicy.findMany({
      where: { tenantId: actor.tenantId, orgId },
      orderBy: [{ scopeKey: "asc" }, { version: "desc" }],
      take: 200
    });
    return rows.map((row) => this.policyView(row));
  }

  async requestCorrection(
    user: { tenantId: string; userId: string },
    requestId: string,
    input: CorrectionInput
  ) {
    this.assertEnabled();
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: input.timeEntryId, tenantId: user.tenantId, createdBy: user.userId }
    });
    if (!entry) {
      throw new NotFoundException();
    }
    if (!entry.endedAt || entry.status === "running" || entry.status === "paused" || entry.status === "deleted") {
      throw new UnprocessableEntityException("Solo se corrigen registros terminados");
    }
    const proposedStartedAt = input.startedAt ?? entry.startedAt;
    const proposedEndedAt = input.endedAt ?? entry.endedAt;
    const proposedBreakMinutes = input.breakMinutes ?? entry.breakMinutes;
    const unchanged =
      proposedStartedAt.getTime() === entry.startedAt.getTime() &&
      proposedEndedAt.getTime() === entry.endedAt.getTime() &&
      proposedBreakMinutes === entry.breakMinutes;
    if (unchanged) {
      throw new UnprocessableEntityException("La corrección no cambia nada");
    }
    const elapsed = elapsedMinutes(proposedStartedAt, proposedEndedAt);
    if (elapsed <= 0 || proposedBreakMinutes < 0 || proposedBreakMinutes > elapsed) {
      throw new UnprocessableEntityException("Horas no válidas");
    }
    const pending = await this.prisma.laborTimeCorrection.findFirst({
      where: { timeEntryId: entry.id, status: "PENDING" }
    });
    if (pending) {
      throw new ConflictException("Ya hay una corrección pendiente para este registro");
    }
    const created = await this.prisma.laborTimeCorrection.create({
      data: {
        tenantId: user.tenantId,
        orgId: entry.orgId,
        timeEntryId: entry.id,
        requestedByUserId: user.userId,
        originalStartedAt: entry.startedAt,
        originalEndedAt: entry.endedAt,
        originalBreakMinutes: entry.breakMinutes,
        proposedStartedAt,
        proposedEndedAt,
        proposedBreakMinutes,
        reason: input.reason
      }
    });
    await this.record(user.tenantId, entry.orgId, user.userId, "labor_correction.requested", "LaborTimeCorrection", created.id, requestId, {
      timeEntryId: entry.id
    });
    return this.correctionView(created);
  }

  async listMine(user: { tenantId: string; userId: string }) {
    this.assertEnabled();
    const rows = await this.prisma.laborTimeCorrection.findMany({
      where: { tenantId: user.tenantId, requestedByUserId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return rows.map((row) => this.correctionView(row));
  }

  async listForOrg(actor: LaborActor, orgId: string, status?: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const rows = await this.prisma.laborTimeCorrection.findMany({
      where: { tenantId: actor.tenantId, orgId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return rows.map((row) => this.correctionView(row));
  }

  async review(
    actor: LaborActor,
    orgId: string,
    correctionId: string,
    decision: "APPROVE" | "REJECT",
    note: string | undefined,
    requestId: string
  ) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const correction = await this.prisma.laborTimeCorrection.findFirst({
      where: { id: correctionId, tenantId: actor.tenantId, orgId }
    });
    if (!correction) {
      throw new NotFoundException();
    }
    if (correction.requestedByUserId === actor.userId) {
      throw new ForbiddenException("No se puede revisar la propia corrección");
    }
    const target = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.laborTimeCorrection.updateMany({
        where: { id: correction.id, status: "PENDING" },
        data: { status: target, reviewedByUserId: actor.userId, reviewNote: note ?? null, reviewedAt: new Date() }
      });
      if (claimed.count !== 1) {
        throw new ConflictException("La corrección ya fue revisada");
      }
      if (decision === "APPROVE") {
        const times = computeLaborTime(
          {
            startedAt: correction.proposedStartedAt,
            endedAt: correction.proposedEndedAt,
            breakMinutes: correction.proposedBreakMinutes
          },
          null
        );
        const applied = await tx.timeEntry.updateMany({
          where: { id: correction.timeEntryId, tenantId: actor.tenantId, orgId },
          data: {
            startedAt: correction.proposedStartedAt,
            endedAt: correction.proposedEndedAt,
            breakMinutes: correction.proposedBreakMinutes,
            durationMinutes: times.open ? null : times.workedMinutes,
            editedBy: actor.userId,
            editReason: `labor_correction:${correction.id}`
          }
        });
        if (applied.count !== 1) {
          throw new ConflictException("El registro de tiempo ya no está disponible");
        }
      }
    });
    await this.record(
      actor.tenantId,
      orgId,
      actor.userId,
      decision === "APPROVE" ? "labor_correction.approved" : "labor_correction.rejected",
      "LaborTimeCorrection",
      correction.id,
      requestId,
      { timeEntryId: correction.timeEntryId }
    );
    return { status: target };
  }

  private policyView(row: PolicyRow) {
    return {
      policyId: row.id,
      orgId: row.orgId,
      worksiteId: row.worksiteId,
      name: row.name,
      version: row.version,
      status: row.status,
      weekdays: row.weekdays,
      scheduledStartMinute: row.scheduledStartMinute,
      scheduledEndMinute: row.scheduledEndMinute,
      expectedBreakMinutes: row.expectedBreakMinutes,
      overtimeAfterMinutesPerDay: row.overtimeAfterMinutesPerDay,
      createdAt: row.createdAt
    };
  }

  private correctionView(row: CorrectionRow) {
    return {
      correctionId: row.id,
      orgId: row.orgId,
      timeEntryId: row.timeEntryId,
      original: { startedAt: row.originalStartedAt, endedAt: row.originalEndedAt, breakMinutes: row.originalBreakMinutes },
      proposed: { startedAt: row.proposedStartedAt, endedAt: row.proposedEndedAt, breakMinutes: row.proposedBreakMinutes },
      reason: row.reason,
      status: row.status,
      reviewNote: row.reviewNote,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt
    };
  }
}
