import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ratingCreateSchema, ratingIdParamSchema, userIdParamSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { RatingsService } from "./ratings.service.js";
import { ReputationService } from "./reputation.service.js";

@Controller("v1/ratings")
export class RatingsController {
  constructor(
    private readonly ratingsService: RatingsService,
    private readonly reputationService: ReputationService
  ) {}

  @Get()
  @RequirePermissions("ratings:read")
  async list(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.ratingsService.listRatings({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** GET /v1/ratings/users/:userId/reputation — composite decay score */
  @Get("users/:userId/reputation")
  @RequirePermissions("ratings:read")
  async reputation(@Req() req: { headers?: Record<string, unknown> }, @Param("userId") userId: string) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const actor = resolveRequestContext(req);
    const data = await this.reputationService.computeForUser(actor.tenantId, parsedParams.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** GET /v1/ratings/reputation — batch all professionals in tenant */
  @Get("reputation")
  @RequirePermissions("ratings:read")
  async reputationBatch(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.reputationService.computeBatchForTenant(actor.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("users/:userId/summary")
  @RequirePermissions("ratings:read")
  async summary(@Req() req: { headers?: Record<string, unknown> }, @Param("userId") userId: string) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const actor = resolveRequestContext(req);
    const data = await this.ratingsService.summarizeUser({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    }, parsedParams.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":ratingId")
  @RequirePermissions("ratings:read")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("ratingId") ratingId: string) {
    const parsedParams = parseWithSchema(ratingIdParamSchema, { ratingId });
    const actor = resolveRequestContext(req);
    const data = await this.ratingsService.getRating({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    }, parsedParams.ratingId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post()
  @RequirePermissions("ratings:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(ratingCreateSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.ratingsService.createRating({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId: parsed.jobId,
      toUserId: parsed.toUserId,
      score: parsed.score,
      comment: parsed.comment,
      requestId
    });
    return ok(requestId, data);
  }
}
