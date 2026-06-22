import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { VisionRepository } from "./vision.repository.js";
import { VisionServiceClient } from "./clients/vision-service.client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  constructor(
    private readonly visionRepository: VisionRepository,
    private readonly visionServiceClient: VisionServiceClient,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
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

  async analyzeBlueprint(imageUrl: string, trade?: string) {
    return this.visionServiceClient.analyzeBlueprint({ imageUrl, trade });
  }

  async correctPerspective(imageUrl: string, returnBase64 = false) {
    return this.visionServiceClient.correctPerspective({ imageUrl, returnBase64 });
  }

  async binarizeDocument(imageUrl: string) {
    return this.visionServiceClient.binarizeDocument({ imageUrl });
  }

  async estimateArea(imageUrl: string, expectedAreaM2?: number) {
    return this.visionServiceClient.estimateArea({ imageUrl, expectedAreaM2 });
  }

  async checkConsistency(imageUrls: string[]) {
    return this.visionServiceClient.checkConsistency({ imageUrls });
  }

  async checkConsistencyByIds(evidenceIds: string[]) {
    if (evidenceIds.length < 2) {
      return { consistencyScore: 1, outlierIndices: [], allSameLocation: true, pairwiseScores: [] };
    }
    const rows = await this.prisma.evidence.findMany({
      where: { id: { in: evidenceIds } },
      select: { id: true, bucketKey: true },
    });
    const imageUrls = rows.map(r =>
      r.bucketKey ? this.storageService.publicUrl(r.bucketKey) : `mock://evidence/${r.id}`
    );
    return this.visionServiceClient.checkConsistency({ imageUrls });
  }

  async buildTimeline(imageUrls: string[], labels?: string[], fps = 2, outputWidth = 640, outputHeight = 480) {
    return this.visionServiceClient.buildTimeline({ imageUrls, labels, fps, outputWidth, outputHeight });
  }

  async checkSafety(imageUrl: string, trade?: string) {
    return this.visionServiceClient.checkSafety({ imageUrl, trade });
  }

  async matchReference(deliveredImageUrl: string, referenceImageUrl: string) {
    return this.visionServiceClient.matchReference({ deliveredImageUrl, referenceImageUrl });
  }

  async detectTrade(imageUrl: string, expectedTrade?: string) {
    return this.visionServiceClient.detectTrade({ imageUrl, expectedTrade });
  }

  async runBatchAnalysis(items: Array<{ evidenceId: string; imageUrl: string; jobId?: string; milestoneId?: string; trade?: string }>, jobId?: string, milestoneId?: string) {
    const batchResult = await this.visionServiceClient.batchAnalyze({
      items: items.map(i => ({ ...i, imageUrl: i.imageUrl })),
      jobId,
      milestoneId,
    });

    // Persist each completed result to DB
    await Promise.allSettled(
      batchResult.results
        .filter(r => r.status === "completed" && r.result)
        .map(r => this.visionRepository.upsertByEvidenceId(r.evidenceId, {
          jobId,
          milestoneId,
          status: "completed",
          qualityScore: r.result!.quality.qualityScore,
          blurScore: r.result!.quality.blurScore,
          brightnessScore: r.result!.quality.brightnessScore,
          contrastScore: r.result!.quality.contrastScore,
          duplicateRisk: r.result!.duplicate?.duplicateRisk,
          requiresHumanReview: r.result!.governance.requiresHumanReview,
          canAutoApprove: r.result!.governance.canAutoApprove,
          recommendedAction: r.result!.governance.recommendedAction,
          riskLevel: r.result!.rawResult?.riskLevel ?? "low",
          riskReasons: r.result!.rawResult?.reasons ?? [],
          rawResult: r.result!.rawResult,
        }))
    );

    return batchResult;
  }

  async runBatchByIds(evidenceIds: string[], jobId?: string, milestoneId?: string) {
    if (evidenceIds.length === 0) {
      return { total: 0, completed: 0, failed: 0, batchDurationMs: 0, results: [] };
    }
    const rows = await this.prisma.evidence.findMany({
      where: { id: { in: evidenceIds } },
      select: { id: true, bucketKey: true, milestoneId: true },
    });
    const items = rows.map(r => ({
      evidenceId: r.id,
      imageUrl: r.bucketKey ? this.storageService.publicUrl(r.bucketKey) : `mock://evidence/${r.id}`,
      milestoneId: r.milestoneId ?? milestoneId,
      jobId,
    }));
    return this.runBatchAnalysis(items, jobId, milestoneId);
  }

  async buildJobTimeline(jobId: string, fps = 2) {
    const project = await this.prisma.project.findUnique({
      where: { jobId },
      select: { id: true },
    });
    if (!project) return { frameCount: 0, durationMs: 0, base64Gif: null, message: "No project found for this job" };

    const evidence = await this.prisma.evidence.findMany({
      where: { projectId: project.id, kind: "PHOTO" },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { id: true, bucketKey: true, createdAt: true },
    });
    if (evidence.length < 2) {
      return { frameCount: evidence.length, durationMs: 0, base64Gif: null, message: "At least 2 photos required for a timeline" };
    }
    const imageUrls = evidence.map(e => e.bucketKey ? this.storageService.publicUrl(e.bucketKey) : `mock://evidence/${e.id}`);
    const labels = evidence.map(e => e.createdAt.toISOString().slice(0, 10));
    return this.visionServiceClient.buildTimeline({ imageUrls, labels, fps, outputWidth: 640, outputHeight: 480 });
  }

  async analyzeByEvidenceId(evidenceId: string) {
    const existing = await this.visionRepository.findByEvidenceId(evidenceId).catch(() => null);
    if (existing?.status === "completed") return existing;

    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, bucketKey: true, milestoneId: true, metadataJson: true },
    });
    if (!evidence) throw new NotFoundException(`Evidence ${evidenceId} not found`);

    const imageUrl = evidence.bucketKey
      ? this.storageService.publicUrl(evidence.bucketKey)
      : `mock://evidence/${evidenceId}`;

    const meta = evidence.metadataJson as Record<string, unknown> | null;
    return this.runAnalysis({
      evidenceId,
      imageUrl,
      jobId: (meta?.jobId as string) ?? undefined,
      milestoneId: evidence.milestoneId ?? undefined,
    });
  }

  async detectMaterial(imageUrl: string, expectedMaterial?: string) {
    return this.visionServiceClient.detectMaterial({ imageUrl, expectedMaterial });
  }
}
