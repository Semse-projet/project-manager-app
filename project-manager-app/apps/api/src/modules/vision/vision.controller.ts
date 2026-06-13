import { Controller, Post, Get, Body, Param, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { VisionService } from "./vision.service.js";
import { AnalyzeEvidenceDto, BlueprintDto, PerspectiveCorrectionDto, BinarizeDto } from "./dto/index.js";
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
}
