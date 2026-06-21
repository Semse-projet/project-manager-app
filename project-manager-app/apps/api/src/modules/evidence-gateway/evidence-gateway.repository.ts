import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export interface EvidenceValidationInput {
  projectId: string;
  milestoneId?: string;
  uploadedById: string;
  kind: string;
  bucketKey: string;
  metadataJson?: Record<string, unknown>;
}

export interface EvidenceValidationResult {
  evidenceId: string;
  projectId: string;
  milestoneId?: string;
  validationStatus: "passed" | "failed" | "pending" | "manual_review";
  aiQualityScore: number;
  validatedAt: Date;
  feedback?: string;
}

@Injectable()
export class EvidenceGatewayRepository {
  private readonly logger = new Logger(EvidenceGatewayRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createEvidence(input: EvidenceValidationInput) {
    return this.prisma.evidence.create({
      data: {
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        uploadedById: input.uploadedById,
        kind: input.kind as any,
        bucketKey: input.bucketKey,
        metadataJson: input.metadataJson as any,
        validationStatus: "pending",
        capturedAt: new Date(),
      },
    });
  }

  async updateEvidenceValidation(
    evidenceId: string,
    result: Partial<EvidenceValidationResult>,
  ) {
    return this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        validationStatus: result.validationStatus,
        aiQualityScore: result.aiQualityScore,
      },
    });
  }

  async getEvidence(evidenceId: string) {
    return this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        project: { select: { id: true, tenantId: true } },
        milestone: { select: { id: true, checklistSchema: true } },
      },
    });
  }

  async getMilestoneEvidenceValidationStatus(
    projectId: string,
    milestoneId: string,
  ) {
    const evidence = await this.prisma.evidence.findMany({
      where: { projectId, milestoneId },
      select: {
        id: true,
        kind: true,
        validationStatus: true,
        aiQualityScore: true,
      },
    });

    const total = evidence.length;
    const passed = evidence.filter((e) => e.validationStatus === "passed").length;
    const failed = evidence.filter((e) => e.validationStatus === "failed").length;
    const pending = evidence.filter((e) => e.validationStatus === "pending").length;
    const avgScore = evidence.length > 0
      ? evidence.reduce((sum, e) => sum + (Number(e.aiQualityScore) || 0), 0) /
        evidence.length
      : 0;

    return {
      total,
      passed,
      failed,
      pending,
      avgScore: parseFloat(avgScore.toFixed(3)),
      isComplete: failed === 0 && pending === 0,
      isReady: passed >= Math.ceil(total * 0.8) && failed === 0,
    };
  }

  async getProjectEvidenceByStatus(projectId: string, status: string) {
    return this.prisma.evidence.findMany({
      where: { projectId, validationStatus: status },
      select: {
        id: true,
        kind: true,
        bucketKey: true,
        validationStatus: true,
        aiQualityScore: true,
        milestoneId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async logValidationEvent(
    projectId: string,
    evidenceId: string,
    event: string,
    data: Record<string, unknown>,
  ) {
    try {
      this.logger.log(
        `[EvidenceValidation] ${event}: evidence=${evidenceId}, project=${projectId}`,
        { ...data },
      );
    } catch (error) {
      this.logger.error(
        `Failed to log validation event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createValidationBatch(
    projectId: string,
    evidenceIds: string[],
  ) {
    return {
      batchId: `batch_${Date.now()}`,
      projectId,
      evidenceIds,
      createdAt: new Date(),
      status: "processing",
    };
  }

  async getValidationBatchStatus(batchId: string) {
    // In a real implementation, this would query a BatchValidation table
    // For now, return a synthetic response
    return {
      batchId,
      status: "completed",
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
    };
  }
}
