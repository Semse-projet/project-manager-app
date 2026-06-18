import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { bidSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { BidsService } from "./bids.service.js";

const createBidSchema = bidSchema.omit({ jobId: true });

@Controller("v1/bids")
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Get("mine")
  @RequirePermissions("bids:read")
  async mine(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.bidsService.listMine({
      tenantId: actor.tenantId,
      userId: actor.userId,
      orgId: actor.orgId,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":bidId/accept")
  @RequirePermissions("bids:accept")
  async accept(@Req() req: { headers?: Record<string, unknown> }, @Param("bidId") bidId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const bid = await this.bidsService.accept({
      tenantId: actor.tenantId,
      bidId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });

    return ok(requestId, bid);
  }
}

@Controller("v1/jobs")
export class JobBidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Get(":jobId/bids")
  @RequirePermissions("bids:read")
  async list(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.bidsService.list({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      jobId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":jobId/bids")
  @RequirePermissions("bids:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = createBidSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const bid = await this.bidsService.create({
      tenantId: actor.tenantId,
      jobId,
      proOrgId: parsed.data.proOrgId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      amount: parsed.data.amount,
      etaDays: parsed.data.etaDays,
      requestId
    });

    return ok(requestId, bid);
  }
}
