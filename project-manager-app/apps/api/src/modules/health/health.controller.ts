import { Controller, Get, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ReadinessService } from "./readiness.service.js";

@Controller("v1")
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get("health")
  @Public()
  health(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), {
      status: "ok",
      service: "semse-api",
      persistence: databaseEnabled() ? "prisma" : "memory",
      build: "2026-05-18a",
      authMode: "jwt-crypto-only",
      timestamp: new Date().toISOString()
    });
  }

  @Get("ready")
  @Public()
  async ready(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const report = await this.readiness.check();
    return reply
      .code(report.status === "ready" ? 200 : 503)
      .send(ok(resolveRequestId(req.headers ?? {}), report));
  }
}
