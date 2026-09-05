import { BadRequestException, Body, Controller, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { isOriginatorRegistrationEnabled } from "./originator.policy.js";
import { OriginatorService } from "./originator.service.js";

type OriginatorRequest = {
  headers?: Record<string, unknown>;
  authContext?: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
  };
};

function parseProposeBody(body: unknown): { originatorUserId: string } {
  const record = body as Record<string, unknown> | null;
  const originatorUserId = record?.originatorUserId;
  if (typeof originatorUserId !== "string" || originatorUserId.trim().length === 0) {
    throw new BadRequestException({
      code: "ORIGINATOR_INVALID_INPUT",
      message: "originatorUserId is required",
    });
  }
  return { originatorUserId };
}

function parseValidateBody(body: unknown): { decision: "VALIDATED" | "REJECTED" } {
  const record = body as Record<string, unknown> | null;
  const decision = record?.decision;
  if (decision !== "validated" && decision !== "rejected") {
    throw new BadRequestException({
      code: "ORIGINATOR_INVALID_INPUT",
      message: "decision must be 'validated' or 'rejected'",
    });
  }
  return { decision: decision === "validated" ? "VALIDATED" : "REJECTED" };
}

@Controller("v1/projects")
export class OriginatorController {
  constructor(private readonly originator: OriginatorService) {}

  private assertEnabled(tenantId: string): void {
    if (!isOriginatorRegistrationEnabled(tenantId)) {
      throw new NotFoundException({
        code: "ORIGINATOR_REGISTRATION_DISABLED",
        message: "Originator registration is not active for this tenant",
      });
    }
  }

  @Post(":projectId/originator")
  @RequirePermissions("project:originate")
  async propose(
    @Req() req: OriginatorRequest,
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    const context = resolveRequestContext(req);
    this.assertEnabled(context.tenantId);
    const requestId = resolveRequestId(req.headers ?? {});
    const { originatorUserId } = parseProposeBody(body);

    const created = await this.originator.propose({
      tenantId: context.tenantId,
      orgId: context.orgId,
      projectId,
      originatorUserId,
      actorUserId: context.userId,
      requestId,
    });

    return ok(requestId, { status: "pending_owner_validation", projectOriginatorId: created.id });
  }

  @Post(":projectId/originator/validate")
  @RequirePermissions("projects:read")
  async validate(
    @Req() req: OriginatorRequest,
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    const context = resolveRequestContext(req);
    this.assertEnabled(context.tenantId);
    const requestId = resolveRequestId(req.headers ?? {});
    const { decision } = parseValidateBody(body);

    const updated = await this.originator.validateForProject({
      tenantId: context.tenantId,
      orgId: context.orgId,
      projectId,
      actorUserId: context.userId,
      decision,
      requestId,
    });

    return ok(requestId, { status: updated.status.toLowerCase() });
  }
}
