import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req } from "@nestjs/common";
import { semseEventSchema } from "@semse/schemas";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { normalizeRoles } from "../../common/rbac.js";
import { DomainEventConsumerService } from "./domain-event-consumer.service.js";
import { DomainEventsService } from "./domain-events.service.js";

const processDomainEventBodySchema = z.object({
  workerId: z.string().trim().min(1).max(255),
}).strict();

@Controller("v1/domain-events")
export class DomainEventsController {
  constructor(
    private readonly domainEventsService: DomainEventsService,
    private readonly domainEventConsumerService: DomainEventConsumerService,
  ) {}

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

  @Post(":eventId/process")
  @RequirePermissions("domain-events:consume")
  async process(
    @Req() req: {
      headers?: Record<string, unknown>;
      authContext?: {
        userId: string;
        tenantId: string;
        orgId: string;
        roles: string[];
      };
    },
    @Param("eventId") eventId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    if (!normalizeRoles(actor.roles).includes("EVENT_CONSUMER")) {
      throw new ForbiddenException({
        message: "Domain event processing requires service identity",
        requiredRole: "EVENT_CONSUMER",
      });
    }
    if (!z.string().uuid().safeParse(eventId).success) {
      throw new BadRequestException({ message: "eventId must be a UUID" });
    }
    const parsedBody = processDomainEventBodySchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.domainEventConsumerService.process(eventId, {
      workerId: parsedBody.data.workerId,
      serviceActorId: actor.userId,
    });
    return ok(requestId, data);
  }
}
