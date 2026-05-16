import { Controller, Get, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";

@Controller("v1/health")
export class HealthController {
  @Get()
  @Public()
  health(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), {
      status: "ok",
      service: "semse-api",
      persistence: databaseEnabled() ? "prisma" : "memory",
      build: "2026-05-16a",
      authMode: "jwt-crypto-only",
      timestamp: new Date().toISOString()
    });
  }
}
