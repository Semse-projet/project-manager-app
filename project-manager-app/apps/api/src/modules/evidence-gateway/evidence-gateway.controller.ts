import { BadRequestException, Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { EvidenceGatewayService } from "./evidence-gateway.service.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";

function actor(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

function assertSafeRouteId(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return value;
}

@Controller("v1/evidence")
export class EvidenceGatewayController {
  constructor(private readonly service: EvidenceGatewayService) {}

  @Post("upload")
  @RequirePermissions("evidence:write")
  async uploadEvidence(
    @Req() req: FastifyRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const result = await this.service.uploadEvidence({
      projectId: String(body.projectId ?? ""),
      milestoneId: body.milestoneId ? String(body.milestoneId) : undefined,
      uploadedById: ctx.userId,
      kind: String(body.kind ?? "PHOTO") as "PHOTO" | "VIDEO" | "DOCUMENT",
      bucketKey: String(body.bucketKey ?? ""),
      metadataJson: body.metadataJson as Record<string, unknown> | undefined,
    });

    // Trigger async validation (fire-and-forget)
    this.service
      .validateEvidenceAsync(result.evidenceId, String(body.projectId ?? ""))
      .catch((err) => {
        console.error("Async validation failed:", err);
      });

    return ok(rid, result);
  }

  @Get(":projectId/stream")
  async getValidationStream(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Param("projectId") projectId: string,
  ) {
    const safeProjectId = assertSafeRouteId(projectId, "projectId");
    // Set SSE headers
    res.header("Content-Type", "text/event-stream");
    res.header("Cache-Control", "no-cache");
    res.header("Connection", "keep-alive");

    // Send initial connection message
    res.send(
      `data: ${JSON.stringify({
        event: "connected",
        projectId: safeProjectId,
        timestamp: new Date().toISOString(),
      })}\n\n`,
    );

    // Note: In a real implementation, this would subscribe to SSE bus events
    // For now, we'll keep the connection open for manual testing
    // In production, this would listen to this.sseBus.on("evidence")
    // and forward events to the client

    // Keep connection alive for 5 minutes
    const interval = setInterval(() => {
      res.send(
        `data: ${JSON.stringify({
          event: "heartbeat",
          projectId: safeProjectId,
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );
    }, 30000); // Send heartbeat every 30s

    req.raw.on("close", () => {
      clearInterval(interval);
    });
  }

  @Get(":projectId/milestone/:milestoneId/status")
  @RequirePermissions("evidence:read")
  async getMilestoneValidationStatus(
    @Req() req: FastifyRequest,
    @Param("projectId") projectId: string,
    @Param("milestoneId") milestoneId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});

    const status = await this.service.getMilestoneValidationStatus(
      projectId,
      milestoneId,
    );

    return ok(rid, status);
  }

  @Get(":projectId/results/passed")
  @RequirePermissions("evidence:read")
  async getPassedEvidence(
    @Req() req: FastifyRequest,
    @Param("projectId") projectId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});

    const evidence = await this.service.getPassedEvidence(projectId);

    return ok(rid, { count: evidence.length, items: evidence });
  }

  @Get(":projectId/results/failed")
  @RequirePermissions("evidence:read")
  async getFailedEvidence(
    @Req() req: FastifyRequest,
    @Param("projectId") projectId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});

    const evidence = await this.service.getFailedEvidence(projectId);

    return ok(rid, { count: evidence.length, items: evidence });
  }

  @Get(":projectId/results/pending")
  @RequirePermissions("evidence:read")
  async getPendingEvidence(
    @Req() req: FastifyRequest,
    @Param("projectId") projectId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});

    const evidence = await this.service.getPendingEvidence(projectId);

    return ok(rid, { count: evidence.length, items: evidence });
  }
}
