import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import {
  acceptContributorTermsSchema,
  createKnowledgeAppealSchema,
  createKnowledgeMissionSchema,
  createKnowledgeSubmissionSchema,
  registerKnowledgeAssetSchema,
  resolveKnowledgeAppealSchema,
  reviewKnowledgeSubmissionSchema,
  submitKnowledgeSubmissionSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { Public } from "../../common/public.decorator.js";
import { AuthenticatedAccess, RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ContributorProgramService } from "./contributor-program.service.js";

type Req_ = { headers?: Record<string, unknown>; authContext?: { tenantId: string; orgId: string; userId: string; roles: string[] } };

function parseBody<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error);
  }
  return parsed.data as T;
}

@Controller("v1/contributor-program")
export class ContributorProgramController {
  constructor(private readonly service: ContributorProgramService) {}

  // ── Public ────────────────────────────────────────────────────────────

  @Get("terms/active")
  @Public()
  async activeTerms(@Req() req: Req_) {
    const terms = await this.service.getActiveTerms();
    return ok(resolveRequestId(req.headers ?? {}), {
      id: terms.id,
      version: terms.version,
      effectiveAt: terms.effectiveAt.toISOString(),
      contentEs: terms.contentEs,
      contentEn: terms.contentEn,
      contentHash: terms.contentHash,
      isActive: terms.isActive
    });
  }

  @Get("missions")
  @Public()
  async publicMissions(@Req() req: Req_, @Query("tenantId") tenantId?: string) {
    // Public browsing is intentionally read-only and doesn't require a
    // session; tenantId defaults to the platform's default tenant when
    // omitted, mirroring other public/marketing routes in this app.
    const resolvedTenantId = tenantId ?? process.env.SEMSE_DEFAULT_TENANT_ID ?? "tenant_default";
    const missions = await this.service.listPublishedMissions(resolvedTenantId);
    return ok(resolveRequestId(req.headers ?? {}), missions);
  }

  @Get("missions/:missionId")
  @Public()
  async publicMissionDetail(@Req() req: Req_, @Param("missionId") missionId: string) {
    const mission = await this.service.getMission(missionId);
    return ok(resolveRequestId(req.headers ?? {}), mission);
  }

  // ── Consent ───────────────────────────────────────────────────────────

  @Post("consent")
  @AuthenticatedAccess("Any authenticated user may accept the contributor program terms")
  async acceptTerms(@Req() req: Req_, @Body() body: unknown) {
    const input = parseBody(acceptContributorTermsSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const consent = await this.service.acceptTerms(
      { ...actor, requestId },
      { ...input, checkboxes: input.checkboxes }
    );
    return ok(requestId, { id: consent.id, acceptedAt: consent.acceptedAt.toISOString() });
  }

  // ── Mission acceptance (contributors) ───────────────────────────────

  @Post("missions/:missionId/accept")
  @RequirePermissions("contributor-program:participate")
  async acceptMission(@Req() req: Req_, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const acceptance = await this.service.acceptMission({ ...actor, requestId }, missionId);
    return ok(requestId, {
      id: acceptance.id,
      missionId: acceptance.missionId,
      compensationCentsSnapshot: acceptance.compensationCentsSnapshot,
      currencySnapshot: acceptance.currencySnapshot,
      status: acceptance.status
    });
  }

  // ── Submissions (contributors) ──────────────────────────────────────

  @Post("submissions")
  @RequirePermissions("contributor-program:participate")
  async createSubmission(@Req() req: Req_, @Body() body: unknown) {
    const input = parseBody(createKnowledgeSubmissionSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const submission = await this.service.createSubmission({ ...actor, requestId }, input.acceptanceId);
    return ok(requestId, { id: submission.id, status: submission.status });
  }

  @Get("submissions/:submissionId")
  @RequirePermissions("contributor-program:participate")
  async getSubmission(@Req() req: Req_, @Param("submissionId") submissionId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const submission = await this.service.getSubmission({ ...actor, requestId }, submissionId);
    return ok(requestId, submission);
  }

  @Post("submissions/:submissionId/assets")
  @RequirePermissions("contributor-program:participate")
  async registerAsset(@Req() req: Req_, @Param("submissionId") submissionId: string, @Body() body: unknown) {
    const input = parseBody(registerKnowledgeAssetSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const asset = await this.service.registerAsset({ ...actor, requestId }, submissionId, input);
    return ok(requestId, asset);
  }

  @Post("submissions/:submissionId/submit")
  @RequirePermissions("contributor-program:participate")
  async submitSubmission(@Req() req: Req_, @Param("submissionId") submissionId: string, @Body() body: unknown) {
    const input = parseBody(submitKnowledgeSubmissionSchema, body ?? {});
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const submission = await this.service.submitSubmission({ ...actor, requestId }, submissionId, input.notes);
    return ok(requestId, submission);
  }

  @Post("submissions/:submissionId/appeal")
  @RequirePermissions("contributor-program:participate")
  async createAppeal(@Req() req: Req_, @Param("submissionId") submissionId: string, @Body() body: unknown) {
    const input = parseBody(createKnowledgeAppealSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const appeal = await this.service.createAppeal({ ...actor, requestId }, submissionId, input.reason);
    return ok(requestId, { id: appeal.id, status: appeal.status });
  }

  // ── Dashboard (contributors) ────────────────────────────────────────

  @Get("dashboard")
  @RequirePermissions("contributor-program:participate")
  async dashboard(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const view = await this.service.getDashboard({ ...actor, requestId });
    return ok(requestId, view);
  }

  // ── Admin ────────────────────────────────────────────────────────────

  @Post("admin/missions")
  @RequirePermissions("contributor-program:manage")
  async createMission(@Req() req: Req_, @Body() body: unknown) {
    const input = parseBody(createKnowledgeMissionSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const mission = await this.service.createMission({ ...actor, requestId }, input);
    return ok(requestId, mission);
  }

  @Get("admin/missions")
  @RequirePermissions("contributor-program:manage")
  async listMissionsForAdmin(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const missions = await this.service.listMissionsForAdmin({ ...actor, requestId });
    return ok(requestId, missions);
  }

  @Post("admin/missions/:missionId/publish")
  @RequirePermissions("contributor-program:manage")
  async publishMission(@Req() req: Req_, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const mission = await this.service.setMissionStatus({ ...actor, requestId }, missionId, "PUBLISHED");
    return ok(requestId, mission);
  }

  @Post("admin/missions/:missionId/pause")
  @RequirePermissions("contributor-program:manage")
  async pauseMission(@Req() req: Req_, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const mission = await this.service.setMissionStatus({ ...actor, requestId }, missionId, "PAUSED");
    return ok(requestId, mission);
  }

  @Post("admin/missions/:missionId/close")
  @RequirePermissions("contributor-program:manage")
  async closeMission(@Req() req: Req_, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const mission = await this.service.setMissionStatus({ ...actor, requestId }, missionId, "CLOSED");
    return ok(requestId, mission);
  }

  @Get("admin/submissions")
  @RequirePermissions("contributor-program:manage")
  async listSubmissionsForReview(@Req() req: Req_, @Query("status") status?: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const submissions = await this.service.listSubmissionsForReview({ ...actor, requestId }, status);
    return ok(requestId, submissions);
  }

  @Post("admin/submissions/:submissionId/review")
  @RequirePermissions("contributor-program:manage")
  async reviewSubmission(@Req() req: Req_, @Param("submissionId") submissionId: string, @Body() body: unknown) {
    const input = parseBody(reviewKnowledgeSubmissionSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const review = await this.service.reviewSubmission({ ...actor, requestId }, submissionId, input);
    return ok(requestId, { id: review.id, decision: review.decision });
  }

  @Get("admin/appeals")
  @RequirePermissions("contributor-program:manage")
  async listAppealsForAdmin(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const appeals = await this.service.listAppealsForAdmin({ ...actor, requestId });
    return ok(
      requestId,
      appeals.map((appeal) => ({
        id: appeal.id,
        submissionId: appeal.submissionId,
        missionTitle: (appeal as unknown as { submission?: { mission?: { title?: string } } }).submission?.mission
          ?.title,
        reason: appeal.reason,
        status: appeal.status,
        createdAt: appeal.createdAt.toISOString()
      }))
    );
  }

  @Post("admin/appeals/:appealId/resolve")
  @RequirePermissions("contributor-program:manage")
  async resolveAppeal(@Req() req: Req_, @Param("appealId") appealId: string, @Body() body: unknown) {
    const input = parseBody(resolveKnowledgeAppealSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const appeal = await this.service.resolveAppeal({ ...actor, requestId }, appealId, input);
    return ok(requestId, { id: appeal.id, status: appeal.status });
  }

  @Get("admin/rewards")
  @RequirePermissions("contributor-program:manage")
  async listRewardsForAdmin(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const rewards = await this.service.listRewardsForAdmin({ ...actor, requestId });
    return ok(
      requestId,
      rewards.map((reward) => ({
        id: reward.id,
        submissionId: reward.submissionId,
        userId: reward.userId,
        amountCents: reward.amountCents,
        currency: reward.currency,
        status: reward.status,
        missionTitle: (reward as unknown as { submission?: { mission?: { title?: string } } }).submission?.mission
          ?.title,
        createdAt: reward.createdAt.toISOString(),
        paidAt: reward.paidAt?.toISOString() ?? null
      }))
    );
  }

  @Post("admin/rewards/:rewardId/authorize-payout")
  @RequirePermissions("contributor-program:manage")
  async authorizePayout(@Req() req: Req_, @Param("rewardId") rewardId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const reward = await this.service.authorizePayout({ ...actor, requestId }, rewardId);
    return ok(requestId, { id: reward.id, status: reward.status });
  }
}
