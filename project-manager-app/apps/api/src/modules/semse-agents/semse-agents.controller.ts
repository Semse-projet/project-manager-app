import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { SemseAgentsService, type SemseAgentName, type SemseAgentEvent } from "./semse-agents.service.js";
import { ProToolsAgent, type ProToolsEstimateInput } from "./protools.agent.js";
import { MarketplaceAgent } from "./marketplace.agent.js";
import { BuildOpsAgent } from "./buildops.agent.js";
import { CrowdAgent } from "./crowd.agent.js";
import { EvidenceAgent } from "./evidence.agent.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Controller("v1/agents/semse")
export class SemseAgentsController {
  constructor(
    private readonly bus: SemseAgentsService,
    private readonly marketplaceAgent: MarketplaceAgent,
    private readonly buildopsAgent: BuildOpsAgent,
    private readonly crowdAgent: CrowdAgent,
    private readonly evidenceAgent: EvidenceAgent,
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

  /** Pausar un agente — deja de procesar mensajes del bus hasta que se reanude. */
  @Post(":agent/pause")
  @RequirePermissions("ops:dashboard:write")
  async pauseAgent(@Req() req: { headers?: Record<string, unknown> }, @Param("agent") agent: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const status = this.bus.pause(agent as SemseAgentName);
    if (!status) return ok(rid, { error: `Agente desconocido: ${agent}` });
    return ok(rid, { agent, status });
  }

  /** Reanudar un agente pausado. */
  @Post(":agent/resume")
  @RequirePermissions("ops:dashboard:write")
  async resumeAgent(@Req() req: { headers?: Record<string, unknown> }, @Param("agent") agent: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const status = this.bus.resume(agent as SemseAgentName);
    if (!status) return ok(rid, { error: `Agente desconocido: ${agent}` });
    return ok(rid, { agent, status });
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
      zipCode:     (body.zipCode as string) ?? undefined,
      userId:      ctx.userId,
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
    const _ctx = resolveRequestContext(req);

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

  /** Marketplace Agent — clasificar trabajo y sugerir budget */
  @Post("marketplace/classify")
  @RequirePermissions("projects:read")
  async marketplaceClassify(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const classification = await this.marketplaceAgent.classifyJob(body);
    return ok(rid, { agentName: "marketplace", ...classification });
  }

  /** BuildOps Agent — crear plan de proyecto por trade */
  @Post("buildops/plan")
  @RequirePermissions("projects:read")
  async buildopsPlan(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const trade = String(body.trade ?? "general");
    const hours = parsePositiveInt(body.estimatedHours, 8);
    const plan = this.buildopsAgent.createPlan(trade, hours);
    return ok(rid, { agentName: "buildops", trade, ...plan });
  }

  /** Evidence Agent — generar checklist de evidencia por trade/milestone */
  @Post("evidence/checklist")
  @RequirePermissions("projects:read")
  async evidenceChecklist(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const milestoneTitle = String(body.milestoneTitle ?? "Milestone");
    const trade          = String(body.trade ?? "general");
    const checklist = this.evidenceAgent.generateChecklist(milestoneTitle, trade);
    return ok(rid, { agentName: "evidence", ...checklist });
  }

  /** Crowd Agent — evaluar si se puede liberar el pago */
  @Post("crowd/payment-readiness")
  @RequirePermissions("projects:read")
  async crowdPaymentReadiness(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const decision = this.crowdAgent.evaluatePaymentReadiness({
      evidenceApproved:    Boolean(body.evidenceApproved),
      changeOrdersPending: Math.max(0, parsePositiveInt(body.changeOrdersPending, 0)),
      disputeOpen:         Boolean(body.disputeOpen),
      milestoneStatus:     String(body.milestoneStatus ?? "draft"),
    });
    return ok(rid, { agentName: "crowd", ...decision });
  }

  // ── Human review queue (Jev Decision Layer, Wave: Marketplace) ───────────
  // docs/specs/prometeo/jev-human-review-queue.spec.md

  /** Listar clasificaciones de Marketplace pendientes de revisión humana. */
  @Get("review")
  @RequirePermissions("ops:dashboard:read")
  async listReview(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const items = await this.marketplaceAgent.listPendingReviews({ tenantId: ctx.tenantId });
    return ok(rid, { items });
  }

  /** Aprobar (con override opcional) una clasificación pendiente — reanuda el dispatch. */
  @Post("review/:eventId/approve")
  @RequirePermissions("ops:dashboard:write")
  async approveReview(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("eventId") eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const override = (body.override ?? undefined) as Record<string, unknown> | undefined;
    const result = await this.marketplaceAgent.approveReview({ tenantId: ctx.tenantId, eventId, override });

    if (result.status === "not_found") return ok(rid, { error: "Evento no encontrado", eventId });
    if (result.status === "malformed") return ok(rid, { error: "Evento sin payload de revisión válido", eventId });
    if (result.status === "already_resolved") return ok(rid, { eventId, duplicate: true, outcome: result.outcome });
    if (result.status === "approved") return ok(rid, { eventId, outcome: result.outcome, dispatched: true });
    return ok(rid, { error: "Estado de revisión inesperado", eventId });
  }

  /** Rechazar una clasificación pendiente — el job NO avanza a Protools/BuildOps. */
  @Post("review/:eventId/reject")
  @RequirePermissions("ops:dashboard:write")
  async rejectReview(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("eventId") eventId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : undefined;
    if (!reason) return ok(rid, { error: "reason es requerido" });

    const result = await this.marketplaceAgent.rejectReview({ tenantId: ctx.tenantId, eventId, reason });
    if (result.status === "not_found") return ok(rid, { error: "Evento no encontrado", eventId });
    if (result.status === "already_resolved") return ok(rid, { eventId, duplicate: true, outcome: result.outcome });
    return ok(rid, { eventId, outcome: "rejected" });
  }
}
