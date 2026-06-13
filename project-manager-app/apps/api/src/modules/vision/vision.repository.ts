import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type CreateVisionAnalysisInput = {
  evidenceId: string;
  jobId?: string;
  milestoneId?: string;
  trade?: string;
  status?: string;
  qualityScore?: number;
  blurScore?: number;
  brightnessScore?: number;
  contrastScore?: number;
  duplicateRisk?: number;
  changeScore?: number;
  visualProgressDetected?: boolean;
  requiresHumanReview?: boolean;
  canAutoApprove?: boolean;
  recommendedAction?: string;
  riskLevel?: string;
  riskReasons?: any;
  rawResult?: any;
};

@Injectable()
export class VisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateVisionAnalysisInput) {
    return this.prisma.visionAnalysis.create({
      data: {
        evidenceId: input.evidenceId,
        jobId: input.jobId,
        milestoneId: input.milestoneId,
        trade: input.trade,
        status: input.status ?? "pending",
        qualityScore: input.qualityScore,
        blurScore: input.blurScore,
        brightnessScore: input.brightnessScore,
        contrastScore: input.contrastScore,
        duplicateRisk: input.duplicateRisk,
        changeScore: input.changeScore,
        visualProgressDetected: input.visualProgressDetected ?? false,
        requiresHumanReview: input.requiresHumanReview ?? true,
        canAutoApprove: input.canAutoApprove ?? false,
        recommendedAction: input.recommendedAction,
        riskLevel: input.riskLevel,
        riskReasons: input.riskReasons ?? [],
        rawResult: input.rawResult ?? {},
      },
    });
  }

  async update(id: string, input: Partial<CreateVisionAnalysisInput>) {
    return this.prisma.visionAnalysis.update({
      where: { id },
      data: input,
    });
  }

  async findByEvidenceId(evidenceId: string) {
    const analysis = await this.prisma.visionAnalysis.findUnique({
      where: { evidenceId },
    });
    if (!analysis) {
      throw new NotFoundException(`Vision analysis not found for evidence ${evidenceId}`);
    }
    return analysis;
  }

  async findById(id: string) {
    const analysis = await this.prisma.visionAnalysis.findUnique({
      where: { id },
    });
    if (!analysis) {
      throw new NotFoundException(`Vision analysis not found with id ${id}`);
    }
    return analysis;
  }

  async listByJob(jobId: string) {
    return this.prisma.visionAnalysis.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listByMilestone(milestoneId: string) {
    return this.prisma.visionAnalysis.findMany({
      where: { milestoneId },
      orderBy: { createdAt: "desc" },
    });
  }
}
