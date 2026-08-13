import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  OriginatorRepository,
  type OriginatorRewardRow,
  type ProjectOriginatorRow,
} from "./originator.repository.js";

const PLATFORM_FEE_SHARE_RATE = 0.3;

@Injectable()
export class OriginatorService {
  constructor(
    private readonly repository: OriginatorRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async propose(input: {
    tenantId: string;
    orgId: string;
    projectId: string;
    originatorUserId: string;
    actorUserId: string;
    requestId: string;
  }): Promise<ProjectOriginatorRow> {
    const project = await this.prisma.buildOpsProject.findFirst({
      where: { id: input.projectId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException({
        code: "ORIGINATOR_PROJECT_NOT_FOUND",
        message: "Project not found",
      });
    }

    const existing = await this.repository.findByProjectId(input.projectId);
    if (existing) {
      throw new BadRequestException({
        code: "ORIGINATOR_ALREADY_REGISTERED",
        message: "This project already has an originator registered",
      });
    }

    const created = await this.repository.propose(input);

    await this.audit.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "originator.propose",
      entityType: "ProjectOriginator",
      entityId: created.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { projectId: input.projectId, originatorUserId: input.originatorUserId },
    }).catch(() => undefined);

    return created;
  }

  async validateForProject(input: {
    tenantId: string;
    orgId: string;
    projectId: string;
    actorUserId: string;
    decision: "VALIDATED" | "REJECTED";
    requestId: string;
  }): Promise<ProjectOriginatorRow> {
    const projectOriginator = await this.repository.findByProjectId(input.projectId);
    if (!projectOriginator || projectOriginator.tenantId !== input.tenantId) {
      throw new NotFoundException({
        code: "ORIGINATOR_NOT_FOUND",
        message: "Originator registration not found",
      });
    }
    return this.validate({ ...input, projectOriginatorId: projectOriginator.id });
  }

  async validate(input: {
    tenantId: string;
    orgId: string;
    projectOriginatorId: string;
    actorUserId: string;
    decision: "VALIDATED" | "REJECTED";
    requestId: string;
  }): Promise<ProjectOriginatorRow> {
    const projectOriginator = await this.repository.findById(input.projectOriginatorId);
    if (!projectOriginator || projectOriginator.tenantId !== input.tenantId) {
      throw new NotFoundException({
        code: "ORIGINATOR_NOT_FOUND",
        message: "Originator registration not found",
      });
    }

    if (projectOriginator.status !== "PENDING_OWNER_VALIDATION") {
      throw new ConflictException({
        code: "ORIGINATOR_ALREADY_DECIDED",
        message: `Originator registration has already been decided (${projectOriginator.status})`,
      });
    }

    const project = await this.prisma.buildOpsProject.findUnique({
      where: { id: projectOriginator.projectId },
      select: { createdBy: true },
    });
    if (!project || project.createdBy !== input.actorUserId) {
      throw new ForbiddenException({
        code: "ORIGINATOR_VALIDATION_REQUIRES_OWNER",
        message: "Only the project owner can validate its originator",
      });
    }

    const updated = await this.repository.validate({
      projectOriginator,
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      decision: input.decision,
      requestId: input.requestId,
    });

    await this.audit.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "originator.validate",
      entityType: "ProjectOriginator",
      entityId: updated.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { decision: input.decision },
    }).catch(() => undefined);

    return updated;
  }

  // Caller decides the trigger occurred (milestone-funded/project-completed
  // wiring is a separate slice, not built yet); this only guards VALIDATED.
  async createRewardEvent(input: {
    projectOriginatorId: string;
    type: "FIXED_BONUS" | "PLATFORM_FEE_SHARE";
    triggerEvent: string;
    platformFeeCentsSnapshot?: number | null;
  }): Promise<OriginatorRewardRow> {
    const projectOriginator = await this.repository.findById(input.projectOriginatorId);
    if (!projectOriginator) {
      throw new NotFoundException({
        code: "ORIGINATOR_NOT_FOUND",
        message: "Originator registration not found",
      });
    }
    if (projectOriginator.status !== "VALIDATED") {
      throw new ConflictException({
        code: "ORIGINATOR_NOT_VALIDATED",
        message: "Rewards can only be created for a validated originator",
      });
    }

    const stripeAccount = await this.prisma.stripeConnectAccount.findUnique({
      where: { userId: projectOriginator.originatorUserId },
      select: { payoutsEnabled: true },
    });

    const amountCents =
      input.type === "FIXED_BONUS"
        ? FIXED_BONUS_AMOUNT_CENTS
        : Math.max(
            0,
            Math.round((input.platformFeeCentsSnapshot ?? 0) * PLATFORM_FEE_SHARE_RATE),
          );

    return this.repository.createRewardEvent({
      tenantId: projectOriginator.tenantId,
      projectOriginatorId: projectOriginator.id,
      type: input.type,
      triggerEvent: input.triggerEvent,
      amountCents,
      platformFeeCentsSnapshot:
        input.type === "PLATFORM_FEE_SHARE" ? input.platformFeeCentsSnapshot ?? 0 : null,
      payoutsEnabled: stripeAccount?.payoutsEnabled ?? false,
    });
  }

  async unblockPendingRewards(originatorUserId: string): Promise<number> {
    const registrations = await this.prisma.projectOriginator.findMany({
      where: { originatorUserId },
      select: { id: true },
    });
    let unblocked = 0;
    for (const registration of registrations) {
      unblocked += await this.repository.unblockPendingRewards(registration.id);
    }
    return unblocked;
  }

  async listRewards(projectOriginatorId: string): Promise<OriginatorRewardRow[]> {
    return this.repository.findRewardsByProjectOriginatorId(projectOriginatorId);
  }
}

// Piloto confirmado por el owner 2026-08-04 (spec §2): US$25, ajustable con
// datos reales — no hardcodear en más de un lugar si se necesita cambiar.
const FIXED_BONUS_AMOUNT_CENTS = 2500;
