import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type ActorContext = {
  tenantId: string;
  userId: string;
  orgId: string;
  roles: string[];
};

type CreateChangeOrderInput = {
  buildOpsProjectId?: string;
  jobId?: string;
  milestoneId?: string;
  algorithmRunId?: string;
  title?: string;
  description?: string;
  trigger?: string;
  pricingMode?: string;
  estimatedMin?: number;
  estimatedMax?: number;
  probability?: number;
  evidenceJson?: unknown;
};

type ListChangeOrdersInput = {
  jobId?: string;
  buildOpsProjectId?: string;
  milestoneId?: string;
  status?: string;
  limit?: number;
};

@Injectable()
export class ChangeOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: ActorContext, input: ListChangeOrdersInput) {
    return this.prisma.changeOrderCandidate.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.buildOpsProjectId ? { buildOpsProjectId: input.buildOpsProjectId } : {}),
        ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(input.limit ?? 50, 1), 200),
    });
  }

  async create(actor: ActorContext, input: CreateChangeOrderInput) {
    if (!input.title?.trim()) {
      throw new BadRequestException("Change order title is required");
    }
    if (!input.trigger?.trim()) {
      throw new BadRequestException("Change order trigger is required");
    }
    if (!input.jobId && !input.buildOpsProjectId && !input.milestoneId) {
      throw new BadRequestException("Change order must be linked to a job, BuildOps project, or milestone");
    }

    return this.prisma.changeOrderCandidate.create({
      data: {
        id: `co_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tenantId: actor.tenantId,
        buildOpsProjectId: input.buildOpsProjectId ?? null,
        jobId: input.jobId ?? null,
        milestoneId: input.milestoneId ?? null,
        algorithmRunId: input.algorithmRunId ?? null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        trigger: input.trigger.trim(),
        pricingMode: input.pricingMode?.trim() || "time_and_materials",
        estimatedMin: typeof input.estimatedMin === "number" ? new Prisma.Decimal(input.estimatedMin) : null,
        estimatedMax: typeof input.estimatedMax === "number" ? new Prisma.Decimal(input.estimatedMax) : null,
        probability: typeof input.probability === "number" ? Math.max(0, Math.min(100, Math.round(input.probability))) : null,
        evidenceJson: input.evidenceJson === undefined ? Prisma.JsonNull : input.evidenceJson as Prisma.InputJsonValue,
        status: "predicted",
      },
    });
  }

  async submit(actor: ActorContext, id: string) {
    const candidate = await this.findOwned(actor, id);
    if (!["predicted", "rejected"].includes(candidate.status)) {
      throw new BadRequestException(`Cannot submit change order while status is ${candidate.status}`);
    }
    return this.prisma.changeOrderCandidate.update({
      where: { id },
      data: {
        status: "submitted",
        submittedById: actor.userId,
        submittedAt: new Date(),
      },
    });
  }

  async approve(actor: ActorContext, id: string, clientNote?: string) {
    const candidate = await this.findOwned(actor, id);
    if (candidate.status !== "submitted") {
      throw new BadRequestException("Only submitted change orders can be approved");
    }
    return this.prisma.changeOrderCandidate.update({
      where: { id },
      data: {
        status: "approved",
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        clientNote: clientNote?.trim() || null,
      },
    });
  }

  async reject(actor: ActorContext, id: string, clientNote?: string) {
    const candidate = await this.findOwned(actor, id);
    if (!["submitted", "predicted"].includes(candidate.status)) {
      throw new BadRequestException(`Cannot reject change order while status is ${candidate.status}`);
    }
    if (!clientNote?.trim()) {
      throw new BadRequestException("Rejection note is required");
    }
    return this.prisma.changeOrderCandidate.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        clientNote: clientNote.trim(),
      },
    });
  }

  private async findOwned(actor: ActorContext, id: string) {
    const candidate = await this.prisma.changeOrderCandidate.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!candidate) {
      throw new NotFoundException("Change order not found");
    }
    return candidate;
  }
}
