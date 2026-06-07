import { Body, Controller, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { AssistantService } from "./assistant.service.js";

function ctx(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

@Controller("v1/assistant")
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post("publish-job")
  @RequirePermissions("jobs:create")
  async publishJob(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    const data = await this.assistantService.handlePublishJob({
      message: String(body.message ?? ""),
      draftId: typeof body.draftId === "string" ? body.draftId : undefined,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      pageRoute: typeof body.pageRoute === "string" ? body.pageRoute : undefined,
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
    });
    return ok(rid, data);
  }

  @Post("confirm-draft")
  @RequirePermissions("jobs:create")
  async confirmDraft(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    const draftId = typeof body.draftId === "string" ? body.draftId : "";
    const data = await this.assistantService.confirmDraft(draftId, c.tenantId, c.userId);
    return ok(rid, data);
  }

  @Post("publish-from-draft")
  @RequirePermissions("jobs:create")
  async publishFromDraft(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    const draftId = typeof body.draftId === "string" ? body.draftId : "";
    const data = await this.assistantService.publishFromDraft(draftId, c.tenantId, c.orgId, c.userId, rid);
    return ok(rid, data);
  }
}
