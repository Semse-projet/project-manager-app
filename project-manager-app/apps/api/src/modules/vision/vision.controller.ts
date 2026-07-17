import { Controller, Post, Get, Body, Param, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { VisionService } from "./vision.service.js";
import { AnalyzeEvidenceDto, BlueprintDto, PerspectiveCorrectionDto, BinarizeDto, AreaEstimateDto, ConsistencyCheckDto, ConsistencyByIdsDto, TimelineDto, SafetyCheckDto, ReferenceMatchDto, TradeDetectionDto, BatchAnalyzeDto, BatchByIdsDto, DetectMaterialDto, ClassifySpaceDto, AnalyzePortfolioDto } from "./dto/index.js";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";

@Controller("v1/vision")
@RequirePermissions("vision:read")
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  @Post("analyze")
  @RequirePermissions("vision:run")
  async analyze(
    @Req() req: FastifyRequest,
    @Body() dto: AnalyzeEvidenceDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.runAnalysis(dto);
    return ok(requestId, result);
  }

  @Get("evidence/:evidenceId")
  async getAnalysis(
    @Req() req: FastifyRequest,
    @Param("evidenceId") evidenceId: string
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.getAnalysis(evidenceId);
    return ok(requestId, result);
  }

  @Get("job/:jobId")
  async getByJob(
    @Req() req: FastifyRequest,
    @Param("jobId") jobId: string
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.getByJob(jobId);
    return ok(requestId, result);
  }

  @Get("milestone/:milestoneId")
  async getByMilestone(
    @Req() req: FastifyRequest,
    @Param("milestoneId") milestoneId: string
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.getByMilestone(milestoneId);
    return ok(requestId, result);
  }

  @Post("analyze-by-evidence/:evidenceId")
  @RequirePermissions("vision:run")
  async analyzeByEvidenceId(
    @Req() req: FastifyRequest,
    @Param("evidenceId") evidenceId: string
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.analyzeByEvidenceId(evidenceId);
    return ok(requestId, result);
  }

  @Post("blueprint")
  @RequirePermissions("vision:run")
  async blueprint(
    @Req() req: FastifyRequest,
    @Body() dto: BlueprintDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.analyzeBlueprint(dto.imageUrl, dto.trade);
    return ok(requestId, result);
  }

  @Post("perspective-correct")
  @RequirePermissions("vision:run")
  async perspectiveCorrect(
    @Req() req: FastifyRequest,
    @Body() dto: PerspectiveCorrectionDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.correctPerspective(dto.imageUrl, dto.returnBase64);
    return ok(requestId, result);
  }

  @Post("document-binarize")
  @RequirePermissions("vision:run")
  async documentBinarize(
    @Req() req: FastifyRequest,
    @Body() dto: BinarizeDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.binarizeDocument(dto.imageUrl);
    return ok(requestId, result);
  }

  @Post("progress-timeline")
  @RequirePermissions("vision:run")
  async progressTimeline(
    @Req() req: FastifyRequest,
    @Body() dto: TimelineDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.buildTimeline(dto.imageUrls, dto.labels, dto.fps, dto.outputWidth, dto.outputHeight);
    return ok(requestId, result);
  }

  @Post("safety-check")
  @RequirePermissions("vision:run")
  async safetyCheck(
    @Req() req: FastifyRequest,
    @Body() dto: SafetyCheckDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.checkSafety(dto.imageUrl, dto.trade);
    return ok(requestId, result);
  }

  @Post("match-reference")
  @RequirePermissions("vision:run")
  async matchReference(
    @Req() req: FastifyRequest,
    @Body() dto: ReferenceMatchDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.matchReference(dto.deliveredImageUrl, dto.referenceImageUrl);
    return ok(requestId, result);
  }

  @Post("detect-trade")
  @RequirePermissions("vision:run")
  async detectTrade(
    @Req() req: FastifyRequest,
    @Body() dto: TradeDetectionDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.detectTrade(dto.imageUrl, dto.expectedTrade);
    return ok(requestId, result);
  }

  @Post("estimate-area")
  @RequirePermissions("vision:run")
  async estimateArea(
    @Req() req: FastifyRequest,
    @Body() dto: AreaEstimateDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.estimateArea(dto.imageUrl, dto.expectedAreaM2);
    return ok(requestId, result);
  }

  @Post("check-consistency")
  @RequirePermissions("vision:run")
  async checkConsistency(
    @Req() req: FastifyRequest,
    @Body() dto: ConsistencyCheckDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.checkConsistency(dto.imageUrls);
    return ok(requestId, result);
  }

  @Post("consistency-by-ids")
  @RequirePermissions("vision:run")
  async consistencyByIds(
    @Req() req: FastifyRequest,
    @Body() dto: ConsistencyByIdsDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.checkConsistencyByIds(dto.evidenceIds);
    return ok(requestId, result);
  }

  @Post("batch")
  @RequirePermissions("vision:run")
  async batch(
    @Req() req: FastifyRequest,
    @Body() dto: BatchAnalyzeDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.runBatchAnalysis(dto.items, dto.jobId, dto.milestoneId);
    return ok(requestId, result);
  }

  @Post("batch-by-ids")
  @RequirePermissions("vision:run")
  async batchByIds(
    @Req() req: FastifyRequest,
    @Body() dto: BatchByIdsDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.runBatchByIds(dto.evidenceIds, dto.jobId, dto.milestoneId);
    return ok(requestId, result);
  }

  @Post("detect-material")
  @RequirePermissions("vision:run")
  async detectMaterial(
    @Req() req: FastifyRequest,
    @Body() dto: DetectMaterialDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.detectMaterial(dto.imageUrl, dto.expectedMaterial, dto.enrich ?? true);
    return ok(requestId, result);
  }

  @Post("classify-space")
  @RequirePermissions("vision:run")
  async classifySpace(
    @Req() req: FastifyRequest,
    @Body() dto: ClassifySpaceDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.classifySpace(dto.imageUrl, dto.enrich ?? true);
    return ok(requestId, result);
  }

  @Post("analyze-portfolio")
  @RequirePermissions("vision:run")
  async analyzePortfolio(
    @Req() req: FastifyRequest,
    @Body() dto: AnalyzePortfolioDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.analyzePortfolio(dto.imageUrl, dto.imageHash, dto.enrich ?? true);
    return ok(requestId, result);
  }

  @Post("safety-check-enriched")
  @RequirePermissions("vision:run")
  async safetyCheckEnriched(
    @Req() req: FastifyRequest,
    @Body() dto: { imageUrl: string; trade?: string }
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.checkSafetyEnriched(dto.imageUrl, dto.trade);
    return ok(requestId, result);
  }

  @Get("job/:jobId/timeline")
  async jobTimeline(
    @Req() req: FastifyRequest,
    @Param("jobId") jobId: string,
    @Query("fps") fps?: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const parsedFps = fps ? parseInt(fps, 10) : 2;
    const fpsValue = Number.isFinite(parsedFps) && parsedFps > 0 ? parsedFps : 2;
    const result = await this.visionService.buildJobTimeline(jobId, fpsValue);
    return ok(requestId, result);
  }
}
