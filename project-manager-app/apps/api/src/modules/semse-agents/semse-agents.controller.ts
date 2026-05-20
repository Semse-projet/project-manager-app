import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { SemseAgentsService, type SemseAgentName, type SemseAgentEvent } from "./semse-agents.service.js";
import { ProToolsAgent, type ProToolsEstimateInput } from "./protools.agent.js";

@Controller("v1/agents/semse")
export class SemseAgentsController {
  constructor(
    private readonly bus: SemseAgentsService,
    private readonly protools: ProToolsAgent,
  ) {}

  /** Estado del message bus — qué agentes están activos y cuántos mensajes han procesado. */
  @Get("status")
  @RequirePermissions("ops:dashboard:read")
  async getBusStatus(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, {
      agents: this.bus.getStatus(),
      policy: "Cada agente tiene dominio claro. Ninguno viola la frontera del otro.",
    });
  }

  /** ProTools Agent — estimado técnico por trade */
  @Post("protools/estimate")
  @RequirePermissions("projects:read")
  async protoolsEstimate(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: ProToolsEstimateInput,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);

    if (!body.trade || !body.description) {
      return ok(rid, { error: "trade y description son requeridos" });
    }

    const estimate = await this.protools.estimate({
      trade:       body.trade,
      description: body.description,
      area:        body.area,
      rooms:       body.rooms,
      projectId:   (body.projectId as string) ?? undefined,
    });

    return ok(rid, {
      ...estimate,
      requestedBy: ctx.userId,
      agentName:   "protools",
      agentVersion: "1.0",
    });
  }

  /** Dispatch un evento entre agentes — para testing y debugging */
  @Post("dispatch")
  @RequirePermissions("ops:dashboard:write")
  async dispatchEvent(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);

    const from = body.from as SemseAgentName;
    const to   = body.to   as SemseAgentName | "broadcast";
    const event = body.event as SemseAgentEvent;

    if (!from || !to || !event) {
      return ok(rid, { error: "from, to y event son requeridos" });
    }

    const msg = this.bus.makeMessage({
      from,
      to,
      event,
      payload:   (body.payload as Record<string, unknown>) ?? {},
      projectId: (body.projectId as string) ?? "test",
    });

    this.bus.dispatch(msg);
    return ok(rid, { dispatched: true, correlationId: msg.correlationId, from, to, event });
  }
}
