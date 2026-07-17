import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { DigitalTwinService } from "./digital-twin.service.js";
import { RiskScoringService } from "./risk-scoring.service.js";
import { ProfessionalCredentialService } from "./professional-credential.service.js";
import { PmoService } from "./pmo.service.js";
import { BudgetIntelligenceService } from "./budget-intelligence.service.js";
import { PublicInsightsService } from "./public-insights.service.js";
import { publicDisplayName } from "./public-sanitizer.js";
import { MatchingService } from "../matching/matching.service.js";

function actor(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

@Controller("v1/intelligence")
export class IntelligenceController {
  constructor(
    private readonly twin: DigitalTwinService,
    private readonly risk: RiskScoringService,
    private readonly credential: ProfessionalCredentialService,
    private readonly pmo: PmoService,
    private readonly budget: BudgetIntelligenceService,
    private readonly publicInsights: PublicInsightsService,
    private readonly matching: MatchingService,
  ) {}

  // ── Digital Twin ──────────────────────────────────────────────────────────────

  @Post("projects/:projectId/archive")
  @RequirePermissions("projects:read")
  async archiveProject(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.twin.buildArchive({ tenantId: ctx.tenantId, projectId, archivedBy: ctx.userId }));
  }

  @Get("projects/:projectId/archive")
  @RequirePermissions("projects:read")
  async getArchive(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.twin.getArchive(projectId, ctx.tenantId));
  }

  @Get("archives")
  @RequirePermissions("projects:read")
  async listArchives(@Req() req: FastifyRequest, @Query("limit") limit?: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.twin.listArchives(ctx.tenantId, Math.max(1, parseNonNegativeInt(limit, 20))));
  }

  // ── Risk Scoring ──────────────────────────────────────────────────────────────

  @Get("projects/:projectId/risk")
  @RequirePermissions("projects:read")
  async projectRisk(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.risk.calculateProjectRisk(ctx.tenantId, projectId));
  }

  @Get("risk/high")
  @RequirePermissions("ops:dashboard:read")
  async highRiskProjects(@Req() req: FastifyRequest, @Query("minScore") minScore?: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.risk.listHighRiskProjects(ctx.tenantId, parseNonNegativeInt(minScore, 50)));
  }

  // ── Professional Credential ───────────────────────────────────────────────────

  @Post("credentials/build")
  @RequirePermissions("users:read")
  async buildCredential(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const userId = (body.userId as string | undefined) ?? ctx.userId;
    return ok(rid, await this.credential.buildCredential(ctx.tenantId, userId));
  }

  @Get("credentials/me")
  @RequirePermissions("users:read")
  async myCredential(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.credential.getCredentialByUserId(ctx.userId, ctx.tenantId));
  }

  @Get("credentials/top")
  @RequirePermissions("users:read")
  async topProfessionals(@Req() req: FastifyRequest, @Query("limit") limit?: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.credential.listTopProfessionals(ctx.tenantId, Math.max(1, parseNonNegativeInt(limit, 20))));
  }

  @Get("credentials/user/:userId")
  @RequirePermissions("users:read")
  async credentialByUser(@Req() req: FastifyRequest, @Param("userId") userId: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.credential.getCredentialByUserId(userId, ctx.tenantId));
  }

  // Public — no auth needed (for sharing the credential externally)
  @Get("credentials/public/:slug")
  @Public()
  async credentialBySlug(@Req() req: FastifyRequest, @Param("slug") slug: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const record = await this.credential.getCredentialBySlug(slug);
    // Credenciales previas al fix P0 pueden tener el email como displayName.
    return ok(
      rid,
      record ? { ...record, displayName: publicDisplayName(record.displayName, "Profesional verificado") } : record,
    );
  }

  @Get("public/overview")
  @Public()
  async publicOverview(
    @Req() req: FastifyRequest,
    @Headers("x-tenant-id") tenantIdHeader?: string,
    @Query("limit") limit?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    return ok(rid, await this.publicInsights.getLandingOverview(tenantId, limit ? parseInt(limit, 10) : 3));
  }

  // Público — vacantes abiertas para onboarding de workers (/worker/apply)
  @Get("public/openings")
  @Public()
  async publicOpenings(
    @Req() req: FastifyRequest,
    @Headers("x-tenant-id") tenantIdHeader?: string,
    @Query("limit") limit?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    return ok(rid, await this.publicInsights.getPublicOpenings(tenantId, limit ? parseInt(limit, 10) : 12));
  }

  @Get("public/openings/:jobId")
  @Public()
  async publicOpening(
    @Req() req: FastifyRequest,
    @Param("jobId") jobId: string,
    @Headers("x-tenant-id") tenantIdHeader?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    const opening = await this.publicInsights.getPublicOpening(tenantId, jobId);
    if (!opening) {
      throw new NotFoundException("Opening not found or no longer open");
    }
    return ok(rid, opening);
  }

  // ── PMO Dashboard ─────────────────────────────────────────────────────────────

  @Get("pmo/dashboard")
  @RequirePermissions("ops:dashboard:read")
  async pmoDashboard(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.pmo.getDashboard(ctx.tenantId));
  }

  @Get("pmo/alerts")
  @RequirePermissions("ops:dashboard:read")
  async pmoAlerts(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const dashboard = await this.pmo.getDashboard(ctx.tenantId);
    return ok(rid, dashboard.topAlerts);
  }

  // ── Budget Intelligence ───────────────────────────────────────────────────────

  @Post("budget/suggest")
  @RequirePermissions("jobs:create")
  async suggestBudget(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.budget.suggestBudget({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title: String(body.title ?? ""),
      scope: String(body.scope ?? ""),
      category: body.category as string | undefined,
      location: body.location as string | undefined,
    }));
  }

  @Post("public/budget/suggest")
  @Public()
  async publicBudgetSuggestion(
    @Req() req: FastifyRequest,
    @Headers("x-tenant-id") tenantIdHeader: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    return ok(rid, await this.budget.suggestBudget({
      tenantId,
      userId: "public_landing",
      title: String(body.title ?? ""),
      scope: String(body.scope ?? ""),
      category: body.category as string | undefined,
      location: body.location as string | undefined,
    }));
  }

  @Post("public/professionals/preview")
  @Public()
  async publicProfessionalPreview(
    @Req() req: FastifyRequest,
    @Headers("x-tenant-id") tenantIdHeader: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    const title = String(body.title ?? "").trim();
    const scope = String(body.scope ?? "").trim();

    if (!title || scope.length < 20) {
      throw new BadRequestException("title and scope are required");
    }

    const category = [body.category, body.subcategory]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim();
    const rawLimit = Number(body.limit ?? 3);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(6, rawLimit)) : 3;

    return ok(rid, await this.matching.previewBrief(tenantId, {
      title,
      scope,
      category: category || undefined,
      limit,
      minScore: 0,
    }));
  }
}
