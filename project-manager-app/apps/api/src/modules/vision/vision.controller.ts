import { Controller, Post, Get, Body, Param, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { VisionService } from "./vision.service.js";
import { AnalyzeEvidenceDto, BlueprintDto, PerspectiveCorrectionDto, BinarizeDto, AreaEstimateDto, ConsistencyCheckDto, ConsistencyByIdsDto, TimelineDto, SafetyCheckDto, ReferenceMatchDto, TradeDetectionDto, BatchAnalyzeDto } from "./dto/index.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";

@Controller("v1/vision")
export class VisionController {
  constructor(private readonly visionService: VisionService) {}

  @Post("analyze")
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
  async analyzeByEvidenceId(
    @Req() req: FastifyRequest,
    @Param("evidenceId") evidenceId: string
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.analyzeByEvidenceId(evidenceId);
    return ok(requestId, result);
  }

  @Post("blueprint")
  async blueprint(
    @Req() req: FastifyRequest,
    @Body() dto: BlueprintDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.analyzeBlueprint(dto.imageUrl, dto.trade);
    return ok(requestId, result);
  }

  @Post("perspective-correct")
  async perspectiveCorrect(
    @Req() req: FastifyRequest,
    @Body() dto: PerspectiveCorrectionDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.correctPerspective(dto.imageUrl, dto.returnBase64);
    return ok(requestId, result);
  }

  @Post("document-binarize")
  async documentBinarize(
    @Req() req: FastifyRequest,
    @Body() dto: BinarizeDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.binarizeDocument(dto.imageUrl);
    return ok(requestId, result);
  }

  @Post("progress-timeline")
  async progressTimeline(
    @Req() req: FastifyRequest,
    @Body() dto: TimelineDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.buildTimeline(dto.imageUrls, dto.labels, dto.fps, dto.outputWidth, dto.outputHeight);
    return ok(requestId, result);
  }

  @Post("safety-check")
  async safetyCheck(
    @Req() req: FastifyRequest,
    @Body() dto: SafetyCheckDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.checkSafety(dto.imageUrl, dto.trade);
    return ok(requestId, result);
  }

  @Post("match-reference")
  async matchReference(
    @Req() req: FastifyRequest,
    @Body() dto: ReferenceMatchDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.matchReference(dto.deliveredImageUrl, dto.referenceImageUrl);
    return ok(requestId, result);
  }

  @Post("detect-trade")
  async detectTrade(
    @Req() req: FastifyRequest,
    @Body() dto: TradeDetectionDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.detectTrade(dto.imageUrl, dto.expectedTrade);
    return ok(requestId, result);
  }

  @Post("estimate-area")
  async estimateArea(
    @Req() req: FastifyRequest,
    @Body() dto: AreaEstimateDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.estimateArea(dto.imageUrl, dto.expectedAreaM2);
    return ok(requestId, result);
  }

  @Post("check-consistency")
  async checkConsistency(
    @Req() req: FastifyRequest,
    @Body() dto: ConsistencyCheckDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.checkConsistency(dto.imageUrls);
    return ok(requestId, result);
  }

  @Post("consistency-by-ids")
  async consistencyByIds(
    @Req() req: FastifyRequest,
    @Body() dto: ConsistencyByIdsDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.checkConsistencyByIds(dto.evidenceIds);
    return ok(requestId, result);
  }

  @Post("batch")
  async batch(
    @Req() req: FastifyRequest,
    @Body() dto: BatchAnalyzeDto
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.visionService.runBatchAnalysis(dto.items, dto.jobId, dto.milestoneId);
    return ok(requestId, result);
  }
}
