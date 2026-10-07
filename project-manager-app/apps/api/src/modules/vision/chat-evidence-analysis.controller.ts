import { BadRequestException, Body, Controller, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ChatEvidenceAnalysisService } from "./chat-evidence-analysis.service.js";

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * `POST /v1/prometeo/chat-evidence/analyze/:evidenceId` (spec `prometeo.chat-evidence`, §3.5). Lo invoca el botón
 * «Analizar con visión» del chat; el actor sale SOLO del contexto autenticado.
 */
@Controller("v1/prometeo/chat-evidence")
export class ChatEvidenceAnalysisController {
  constructor(private readonly analysis: ChatEvidenceAnalysisService) {}

  @Post("analyze/:evidenceId")
  @RequirePermissions("vision:run")
  async analyze(
    @Req() req: FastifyRequest,
    @Param("evidenceId") evidenceId: string,
    @Body() body?: { chatRequestId?: unknown },
  ) {
    if (!SAFE_ID.test(evidenceId)) throw new BadRequestException("Invalid evidence id");
    const actor = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
    const requestId = resolveRequestId(req.headers ?? {});
    const chatRequestId = typeof body?.chatRequestId === "string" && SAFE_ID.test(body.chatRequestId) ? body.chatRequestId : undefined;
    const result = await this.analysis.analyze({ actor, evidenceId, requestId, chatRequestId });
    return ok(requestId, result);
  }
}
