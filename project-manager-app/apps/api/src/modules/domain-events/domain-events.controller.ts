import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { semseEventSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { DomainEventsService } from "./domain-events.service.js";

@Controller("v1/domain-events")
export class DomainEventsController {
  constructor(private readonly domainEventsService: DomainEventsService) {}

  @Get("manual-catalog")
  @RequirePermissions("domain-events:emit")
  catalog(@Req() req: { headers?: Record<string, unknown> }) {
    return ok(resolveRequestId(req.headers ?? {}), this.domainEventsService.manualEmitCatalog());
  }

  @Get()
  @RequirePermissions("domain-events:read")
  async list(
    @Req() req: {
      headers?: Record<string, unknown>;
      query?: Record<string, string | string[] | undefined>;
    }
  ) {
    const actor = resolveRequestContext(req);
    const query = req.query ?? {};
    const data = await this.domainEventsService.list({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      type: typeof query.type === "string" ? query.type : undefined,
      correlationId: typeof query.correlationId === "string" ? query.correlationId : undefined,
      limit: typeof query.limit === "string" ? Number(query.limit) : undefined
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":correlationId")
  @RequirePermissions("domain-events:read")
  async trace(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("correlationId") correlationId: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.domainEventsService.trace({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      correlationId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("emit")
  @RequirePermissions("domain-events:emit")
  async emit(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = semseEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.domainEventsService.emit(parsed.data, {
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      requestId,
      roles: actor.roles
    });

    return ok(requestId, data);
  }
}
