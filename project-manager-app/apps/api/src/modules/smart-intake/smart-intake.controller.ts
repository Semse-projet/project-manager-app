import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess, RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { SatellitesService } from "../satellites/satellites.service.js";
import { SmartIntakeService } from "./smart-intake.service.js";
import { getAccuracyDetail } from "./smart-intake.logic.js";

const analyzeSchema = z.object({
  intakeId: z.string().min(1).optional(),
  rawDescription: z.string().min(10),
  title: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  modality: z.enum(["on_site", "remote", "hybrid"]).optional(),
  city: z.string().optional(),
  urgency: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedValues: z.array(z.string()).default([]),
  customText: z.string().optional(),
  isNotSure: z.boolean().default(false),
});

const imageSchema = z.object({
  imageType: z.enum(["before", "damage", "reference", "material", "other"]),
  images: z.array(z.object({
    key: z.string().min(1),
    url: z.string().min(1),
    thumbnailUrl: z.string().optional(),
    originalName: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().nonnegative(),
  })).min(1),
});

const claimSchema = z.object({
  sessionToken: z.string().min(1),
});

const publishSchema = z.object({
  confirmEstimate: z.boolean().default(false),
  escrowEnabled: z.boolean().optional(),
  marketplaceEnabled: z.boolean().optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  subcategoryId: z.string().min(1).optional(),
  locationType: z.enum(["on_site", "remote", "hybrid"]).optional(),
  city: z.string().min(1).optional(),
  urgency: z.enum(["low", "medium", "high", "urgent"]).optional(),
  deadline: z.string().min(1).optional(),
  budgetType: z.enum(["fixed", "range", "hourly"]).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  preferredProfessional: z.object({
    userId: z.string().min(1),
    displayName: z.string().min(1),
    publicSlug: z.string().min(1).optional(),
  }).optional(),
});

function requireSessionToken(headers: Record<string, unknown>, body?: { sessionToken?: string }): string {
  const headerToken = typeof headers["x-session-token"] === "string" ? headers["x-session-token"].trim() : "";
  const bodyToken = body?.sessionToken?.trim() ?? "";
  const token = headerToken || bodyToken;
  if (!token) {
    throw new BadRequestException("Missing intake session token");
  }
  return token;
}

@Controller("v1/intake")
export class SmartIntakeController {
  constructor(
    private readonly smartIntakeService: SmartIntakeService,
    private readonly satellitesService: SatellitesService
  ) {}

  @Post("cleanup-expired")
  @RequirePermissions("ops:dashboard:write")
  async cleanupExpired(@Req() req: FastifyRequest) {
    const actor = resolveRequestContext(req);
    const result = await this.smartIntakeService.cleanupExpired({ tenantId: actor.tenantId });
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Post("analyze")
  @Public()
  async analyze(
    @Req() req: FastifyRequest,
    @Headers("x-tenant-id") tenantIdHeader: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const sessionToken = requireSessionToken(req.headers ?? {}, {
      sessionToken: typeof body.sessionToken === "string" ? body.sessionToken : undefined,
    });
    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    const channel = await this.satellitesService.resolveChannel(req.headers ?? {});
    const result = await this.smartIntakeService.analyze({
      tenantId,
      sessionToken,
      channel,
      intakeId: parsed.data.intakeId,
      rawDescription: parsed.data.rawDescription,
      title: parsed.data.title,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory,
      modality: parsed.data.modality,
      city: parsed.data.city,
      urgency: parsed.data.urgency,
    });

    const detail = getAccuracyDetail(result.intake);
    return ok(resolveRequestId(req.headers ?? {}), {
      intakeId: result.intake.id,
      detectedCategory: result.intake.detectedCategory,
      categoryConfidence: result.intake.categoryConfidence,
      accuracyScore: result.intake.accuracyScore,
      accuracyLevel: result.intake.accuracyLevel,
      missingFields: result.intake.missingFields,
      missingCriticalFields: detail.missingCriticalFields,
      missingRecommendedFields: detail.missingRecommendedFields,
      riskFlags: detail.riskFlags,
      tips: result.tips,
      nextQuestion: result.nextQuestion,
      estimateUnlocked: result.estimateUnlocked,
      voicePrompt: result.voicePrompt,
      status: result.intake.status,
    });
  }

  @Patch(":id/answer")
  @Public()
  async answer(
    @Req() req: FastifyRequest,
    @Param("id") intakeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const sessionToken = requireSessionToken(req.headers ?? {}, {
      sessionToken: typeof body.sessionToken === "string" ? body.sessionToken : undefined,
    });
    const result = await this.smartIntakeService.answer({
      intakeId,
      sessionToken,
      questionId: parsed.data.questionId,
      selectedValues: parsed.data.selectedValues,
      customText: parsed.data.customText,
      isNotSure: parsed.data.isNotSure,
    });

    return ok(resolveRequestId(req.headers ?? {}), {
      accuracyScore: result.intake.accuracyScore,
      accuracyLevel: result.intake.accuracyLevel,
      missingFields: result.intake.missingFields,
      activeWarnings: result.intake.activeWarnings,
      tips: result.tips,
      nextQuestion: result.nextQuestion,
      estimateUnlocked: result.estimateUnlocked,
      liveSummary: result.liveSummary,
      voicePrompt: result.voicePrompt,
      status: result.intake.status,
    });
  }

  @Post(":id/images")
  @Public()
  async addImages(
    @Req() req: FastifyRequest,
    @Param("id") intakeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = imageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const sessionToken = requireSessionToken(req.headers ?? {}, {
      sessionToken: typeof body.sessionToken === "string" ? body.sessionToken : undefined,
    });
    const result = await this.smartIntakeService.addImages({
      intakeId,
      sessionToken,
      imageType: parsed.data.imageType,
      images: parsed.data.images,
    });

    return ok(resolveRequestId(req.headers ?? {}), {
      uploadedImages: result.intake.uploadedImages,
      accuracyScoreDelta: result.accuracyScoreDelta,
      newAccuracyScore: result.newAccuracyScore,
      estimateUnlocked: result.estimateUnlocked,
    });
  }

  @Post(":id/estimate")
  @Public()
  async estimate(
    @Req() req: FastifyRequest,
    @Param("id") intakeId: string,
    @Query("force") forceRaw?: string,
  ) {
    const sessionToken = requireSessionToken(req.headers ?? {});
    const force = forceRaw === "true";
    const result = await this.smartIntakeService.estimate({
      intakeId,
      sessionToken,
      force,
    });

    return ok(resolveRequestId(req.headers ?? {}), {
      estimate: result.estimate,
      milestones: result.milestones,
      status: result.intake.status,
    });
  }

  @Get(":id")
  @Public()
  async get(@Req() req: FastifyRequest, @Param("id") intakeId: string) {
    const sessionToken = requireSessionToken(req.headers ?? {});
    const intake = await this.smartIntakeService.get({ intakeId, sessionToken });
    return ok(resolveRequestId(req.headers ?? {}), intake);
  }

  @Post(":id/claim")
  @AuthenticatedAccess("Authenticated users may claim an intake when they also prove the intake session token.")
  async claim(
    @Req() req: FastifyRequest,
    @Param("id") intakeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const result = await this.smartIntakeService.claim({
      intakeId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      sessionToken: parsed.data.sessionToken,
    });
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Post(":id/publish")
  @RequirePermissions("jobs:create")
  async publish(
    @Req() req: FastifyRequest,
    @Param("id") intakeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.smartIntakeService.publish({
      intakeId,
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      requestId,
      confirmEstimate: parsed.data.confirmEstimate,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      categoryId: parsed.data.categoryId,
      subcategoryId: parsed.data.subcategoryId,
      locationType: parsed.data.locationType,
      city: parsed.data.city,
      urgency: parsed.data.urgency,
      deadline: parsed.data.deadline,
      budgetType: parsed.data.budgetType,
      budgetMin: parsed.data.budgetMin,
      budgetMax: parsed.data.budgetMax,
      preferredProfessional: parsed.data.preferredProfessional,
    });

    return ok(requestId, result);
  }
}
