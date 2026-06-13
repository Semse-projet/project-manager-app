import { Injectable, Logger } from "@nestjs/common";
import { VisionRepository } from "./vision.repository.js";
import { VisionServiceClient } from "./clients/vision-service.client.js";

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  constructor(
    private readonly visionRepository: VisionRepository,
    private readonly visionServiceClient: VisionServiceClient
  ) {}

  async runAnalysis(input: {
    evidenceId: string;
    imageUrl: string;
    jobId?: string;
    milestoneId?: string;
    trade?: string;
    expectedWork?: string;
    metadata?: Record<string, any>;
  }) {
    // 1. Create a pending record in the DB
    const record = await this.visionRepository.create({
      evidenceId: input.evidenceId,
      jobId: input.jobId,
      milestoneId: input.milestoneId,
      trade: input.trade,
      status: "pending",
    });

    try {
      // 2. Call the microservice via our client
      const result = await this.visionServiceClient.analyzeEvidence({
        evidenceId: input.evidenceId,
        jobId: input.jobId,
        milestoneId: input.milestoneId,
        trade: input.trade,
        imageUrl: input.imageUrl,
        expectedWork: input.expectedWork,
        metadata: input.metadata,
      });

      // 3. Update the record with completed statistics
      return await this.visionRepository.update(record.id, {
        status: "completed",
        qualityScore: result.quality.qualityScore,
        blurScore: result.quality.blurScore,
        brightnessScore: result.quality.brightnessScore,
        contrastScore: result.quality.contrastScore,
        duplicateRisk: result.duplicate?.duplicateRisk,
        changeScore: result.progress?.changeScore,
        visualProgressDetected: result.progress?.visualProgressDetected ?? false,
        requiresHumanReview: result.governance.requiresHumanReview,
        canAutoApprove: result.governance.canAutoApprove,
        recommendedAction: result.governance.recommendedAction,
        riskLevel: result.rawResult?.riskLevel ?? "low",
        riskReasons: result.rawResult?.reasons ?? [],
        rawResult: result.rawResult,
      });
    } catch (error: any) {
      this.logger.error(`Error processing vision analysis for evidence ${input.evidenceId}: ${error.message}`);
      
      // 4. Update the record status to failed
      return await this.visionRepository.update(record.id, {
        status: "failed",
        rawResult: {
          errorMessage: error.message,
        },
      });
    }
  }

  async getAnalysis(evidenceId: string) {
    return this.visionRepository.findByEvidenceId(evidenceId);
  }

  async getByJob(jobId: string) {
    return this.visionRepository.listByJob(jobId);
  }

  async getByMilestone(milestoneId: string) {
    return this.visionRepository.listByMilestone(milestoneId);
  }
}
