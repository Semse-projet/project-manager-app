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
import { WorkItemCoordinatorService, type CreateWorkItemInput } from "./work-item-coordinator.service.js";
import type { DecisionPackage } from "@semse/agents";

@Controller("v1/agents/semse")
export class SemseAgentsController {
  constructor(
    private readonly bus: SemseAgentsService,
    private readonly marketplaceAgent: MarketplaceAgent,
    private readonly buildopsAgent: BuildOpsAgent,
    private readonly crowdAgent: CrowdAgent,
    private readonly evidenceAgent: EvidenceAgent,
    private readonly protools: ProToolsAgent,
    private readonly coordinator: WorkItemCoordinatorService,
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
    const hours = Number(body.estimatedHours ?? 8);
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
      changeOrdersPending: Number(body.changeOrdersPending ?? 0),
      disputeOpen:         Boolean(body.disputeOpen),
      milestoneStatus:     String(body.milestoneStatus ?? "draft"),
    });
    return ok(rid, { agentName: "crowd", ...decision });
  }

  // ── Agent Harness WorkItem Coordinator (F4) ────────────────────────────────

  /** Crear un WorkItem. El riskLevel determina si se requiere DecisionPackage. */
  @Post("work-items")
  @RequirePermissions("ops:dashboard:write")
  async createWorkItem(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const input: CreateWorkItemInput = {
      tenantId:           ctx.tenantId,
      humanOwner:         ctx.userId,
      objective:          String(body.objective ?? ""),
      riskLevel:          (body.riskLevel as "L0" | "L1" | "L2" | "L3" | "L4") ?? "L0",
      suggestedAgents:    Array.isArray(body.suggestedAgents) ? (body.suggestedAgents as string[]) : [],
      allowedTools:       Array.isArray(body.allowedTools) ? (body.allowedTools as string[]) : [],
      forbiddenTools:     Array.isArray(body.forbiddenTools) ? (body.forbiddenTools as string[]) : [],
      acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? (body.acceptanceCriteria as string[]) : [],
      rollbackRequired:   Boolean(body.rollbackRequired ?? false),
      contextRefs:        Array.isArray(body.contextRefs) ? (body.contextRefs as string[]) : [],
      services:           Array.isArray(body.services) ? (body.services as string[]) : [],
    };

    if (!input.objective.trim()) {
      return ok(rid, { error: "objective is required" });
    }

    const record = await this.coordinator.createWorkItem(input);
    return ok(rid, { workItem: record });
  }

  /** Listar WorkItems del tenant */
  @Get("work-items")
  @RequirePermissions("ops:dashboard:read")
  async listWorkItems(@Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const items = await this.coordinator.listWorkItems(ctx.tenantId);
    return ok(rid, { workItems: items });
  }

  /** Obtener un WorkItem por id */
  @Get("work-items/:id")
  @RequirePermissions("ops:dashboard:read")
  async getWorkItem(@Param("id") id: string, @Req() req: { headers?: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const item = await this.coordinator.getWorkItem(id, ctx.tenantId);
    if (!item) return ok(rid, { error: "WorkItem not found", id });
    return ok(rid, { workItem: item });
  }

  /** Emitir un DecisionPackage para resolver un WorkItem L2+ */
  @Post("work-items/:id/resolve")
  @RequirePermissions("ops:dashboard:write")
  async resolveWorkItem(
    @Param("id") id: string,
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req);
    const item = await this.coordinator.getWorkItem(id, ctx.tenantId);
    if (!item) return ok(rid, { error: "WorkItem not found", id });

    const dp = body.decisionPackage as DecisionPackage | undefined;
    if (!dp?.recommendation || !dp?.summary) {
      return ok(rid, { error: "decisionPackage.recommendation and .summary are required" });
    }

    const resolved = await this.coordinator.resolveWorkItem(id, ctx.tenantId, dp, ctx.userId);
    return ok(rid, { workItem: resolved });
  }
}
