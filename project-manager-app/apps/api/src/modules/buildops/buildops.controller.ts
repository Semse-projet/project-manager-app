import { BadRequestException, Body, Controller, Get, Optional, Param, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import { getAgentProfile } from "../../infrastructure/llm/agent-profiles.js";
import { OperationalRagContextService } from "../prometeo/operational-rag-context.service.js";
import { BuildOpsLegacyPromotionService } from "./buildops-legacy-promotion.service.js";
import type { BuildOpsPlanApprovalSource } from "./buildops-plan-approval.types.js";
import { BuildOpsPlanApprovalService } from "./buildops-plan-approval.service.js";
import { BuildOpsPlanRerunService } from "./buildops-plan-rerun.service.js";
import { BuildOpsService } from "./buildops.service.js";
import { parsePositiveInt } from "../../common/parse-query.js";

function ctx(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

const PROJECT_STATUSES = new Set([
  "draft",
  "estimating",
  "quoted",
  "approved",
  "in_progress",
  "paused",
  "completed",
  "dispute",
  "closed",
]);

const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const TASK_STATUSES = new Set(["todo", "in_progress", "blocked", "done", "canceled"]);
const TASK_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const PLAN_APPROVAL_SOURCES = new Set(["client", "admin_override"]);

@Controller("v1/buildops")
export class BuildOpsController {
  constructor(
    private readonly buildOpsService: BuildOpsService,
    private readonly buildOpsPlanApprovalService: BuildOpsPlanApprovalService,
    private readonly buildOpsLegacyPromotionService: BuildOpsLegacyPromotionService,
    private readonly buildOpsPlanRerunService: BuildOpsPlanRerunService,
    @Optional() private readonly ragCtx?: OperationalRagContextService,
    @Optional() private readonly llm?: LLMOrchestrator,
  ) {}

  @Get("overview")
  @RequirePermissions("projects:read")
  async overview(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const data = await this.buildOpsService.overview(c.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("projects")
  @RequirePermissions("projects:read")
  async listProjects(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const data = await this.buildOpsService.listProjects(c.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("projects/:projectId/health")
  @RequirePermissions("projects:read")
  async getProjectHealth(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const c = ctx(req);
    const data = await this.buildOpsService.getProjectHealth(c.tenantId, projectId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("projects/:projectId/activity")
  @RequirePermissions("projects:read")
  async getProjectActivity(
    @Req() req: FastifyRequest,
    @Param("projectId") projectId: string,
    @Query("limit") limit?: string,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsService.getProjectActivity(
      c.tenantId,
      projectId,
      Math.min(200, Math.max(1, parsePositiveInt(limit, 40))),
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("projects/:projectId")
  @RequirePermissions("projects:read")
  async detail(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const c = ctx(req);
    const data = await this.buildOpsService.getProject(c.tenantId, projectId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("projects")
  @RequirePermissions("projects:create")
  async createProject(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    if (typeof body.title !== "string" || typeof body.trade !== "string" || typeof body.projectType !== "string" || typeof body.clientName !== "string" || typeof body.location !== "string") {
      throw new BadRequestException("Missing required project fields");
    }

    const data = await this.buildOpsService.createProject({
      tenantId: c.tenantId,
      orgId: c.orgId,
      createdBy: c.userId,
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description.trim() : null,
      trade: body.trade.trim(),
      projectType: body.projectType.trim(),
      clientName: body.clientName.trim(),
      professionalName: typeof body.professionalName === "string" ? body.professionalName.trim() : null,
      location: body.location.trim(),
      budgetEstimate: typeof body.budgetEstimate === "number" ? body.budgetEstimate : typeof body.budgetEstimate === "string" ? Number(body.budgetEstimate) : null,
      status: typeof body.status === "string" && PROJECT_STATUSES.has(body.status) ? body.status as any : "draft",
      riskScore: typeof body.riskScore === "number" ? body.riskScore : undefined,
      riskLevel: typeof body.riskLevel === "string" && RISK_LEVELS.has(body.riskLevel) ? body.riskLevel as any : undefined,
      startDate: typeof body.startDate === "string" ? body.startDate : null,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("estimates/from-tool-result")
  @RequirePermissions("projects:create")
  async createFromToolResult(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    if (typeof body.sourceTool !== "string" || typeof body.sourceToolInput !== "object" || body.sourceToolInput === null || typeof body.sourceToolResult !== "object" || body.sourceToolResult === null) {
      throw new BadRequestException("Missing source tool payload");
    }

    const data = await this.buildOpsService.createFromToolResult({
      tenantId: c.tenantId,
      orgId: c.orgId,
      createdBy: c.userId,
      sourceTool: body.sourceTool,
      sourceToolInput: body.sourceToolInput as Record<string, unknown>,
      sourceToolResult: body.sourceToolResult as Record<string, unknown>,
      title: typeof body.title === "string" ? body.title : null,
      description: typeof body.description === "string" ? body.description : null,
      trade: typeof body.trade === "string" ? body.trade : null,
      projectType: typeof body.projectType === "string" ? body.projectType : null,
      clientName: typeof body.clientName === "string" ? body.clientName : null,
      professionalName: typeof body.professionalName === "string" ? body.professionalName : null,
      location: typeof body.location === "string" ? body.location : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("tasks")
  @RequirePermissions("projects:read")
  async listTasks(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const query = req.query as Record<string, unknown> | undefined;
    const projectId = typeof query?.projectId === "string" ? query.projectId : null;
    const status = typeof query?.status === "string" && TASK_STATUSES.has(query.status) ? query.status : null;
    const data = await this.buildOpsService.listTasks(c.tenantId, { projectId, status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("tasks/:taskId")
  @RequirePermissions("projects:read")
  async detailTask(@Req() req: FastifyRequest, @Param("taskId") taskId: string) {
    const c = ctx(req);
    const data = await this.buildOpsService.getTask(c.tenantId, taskId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("milestones")
  @RequirePermissions("projects:read")
  async listMilestones(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const data = await this.buildOpsService.listMilestones(c.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("tasks")
  @RequirePermissions("projects:create")
  async createTask(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    if (typeof body.title !== "string") {
      throw new BadRequestException("Missing task title");
    }

    const data = await this.buildOpsService.createTask({
      tenantId: c.tenantId,
      orgId: c.orgId,
      createdBy: c.userId,
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description.trim() : null,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      status: typeof body.status === "string" && TASK_STATUSES.has(body.status) ? body.status as any : undefined,
      priority: typeof body.priority === "string" && TASK_PRIORITIES.has(body.priority) ? body.priority as any : undefined,
      assigneeName: typeof body.assigneeName === "string" ? body.assigneeName.trim() : null,
      assigneeUserId: typeof body.assigneeUserId === "string" ? body.assigneeUserId.trim() : null,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
      sourceTool: typeof body.sourceTool === "string" ? body.sourceTool.trim() : null,
      evidenceRequired: body.evidenceRequired && typeof body.evidenceRequired === "object" ? body.evidenceRequired as Record<string, unknown> : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/recover-stale-promotions")
  @RequirePermissions("ops:dashboard:write")
  async recoverStalePromotions(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    const olderThanMinutes = typeof body.olderThanMinutes === "number" ? body.olderThanMinutes : undefined;
    const data = await this.buildOpsService.recoverStalePromotions({
      tenantId: c.tenantId,
      olderThanMinutes,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/approve")
  @RequirePermissions("projects:status:update")
  async approvePlan(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    if (typeof body.source !== "string" || !PLAN_APPROVAL_SOURCES.has(body.source)) {
      throw new BadRequestException("Invalid approval source");
    }
    const source = body.source as BuildOpsPlanApprovalSource;

    const data = await this.buildOpsPlanApprovalService.approveClientPlan({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      source,
      reason: typeof body.reason === "string" ? body.reason : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/request-changes")
  @RequirePermissions("projects:status:update")
  async requestPlanChanges(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsPlanApprovalService.requestChanges({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      comment: typeof body.comment === "string" ? body.comment : "",
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/reject")
  @RequirePermissions("projects:status:update")
  async rejectPlan(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsPlanApprovalService.rejectClientPlan({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      comment: typeof body.comment === "string" ? body.comment : "",
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/unapprove")
  @RequirePermissions("projects:status:update")
  async unapprovePlan(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsPlanApprovalService.unapproveClientPlan({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      reason: typeof body.reason === "string" ? body.reason : "",
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/promote-legacy")
  @RequirePermissions("projects:status:update")
  async promoteLegacy(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsLegacyPromotionService.promoteApprovedPlanToLegacy({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** Prometeo RAG — operational context query (Fase 3) */
  @Post("projects/:projectId/rag-query")
  @RequirePermissions("projects:read")
  async operationalRagQuery(
    @Req() req: FastifyRequest,
    @Param("projectId") projectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    const rid = resolveRequestId(req.headers ?? {});
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const locale   = body.locale === "en" ? "en" as const : "es" as const;

    if (!question) return ok(rid, { answer: "La pregunta no puede estar vacía.", citations: [], confidence: 0, insufficientContext: true });

    // Build operational context
    const opCtx = this.ragCtx ? await this.ragCtx.build({
      projectId,
      tenantId:                c.tenantId,
      milestoneId:             typeof body.milestoneId === "string" ? body.milestoneId : undefined,
      evidenceItemId:          typeof body.evidenceItemId === "string" ? body.evidenceItemId : undefined,
      changeOrderId:           typeof body.changeOrderId === "string" ? body.changeOrderId : undefined,
      includeAuditTrail:       body.includeAuditTrail !== false,
      includeOperationalSignals: body.includeOperationalSignals !== false,
    }) : null;

    const contextBlock = opCtx && this.ragCtx ? this.ragCtx.buildContextBlock(opCtx, locale) : "";
    const citations    = opCtx && this.ragCtx ? this.ragCtx.buildCitations(opCtx) : [];
    const missingSources = opCtx?.missingSources ?? [];

    // Insufficient context guard
    if (!opCtx || (!opCtx.paymentGovernance && !opCtx.milestone && !opCtx.evidenceItems.length && !opCtx.changeOrders.length)) {
      return ok(rid, {
        answer: locale === "es"
          ? "No hay suficiente contexto operacional para responder. Verifica que el proyecto tenga milestones, evidencia o governance cargados."
          : "Not enough operational context. Verify the project has milestones, evidence, or governance data.",
        citations: [], confidence: 0, insufficientContext: true,
        missingSources: ["milestone", "payment_governance", "evidence"],
        provider: "rules", model: null, fallbackUsed: false, privacyMode: "privacyCritical",
      });
    }

    // LLM call (privacyCritical → Ollama local)
    const systemPrompt = locale === "es"
      ? "Eres Prometeo, el motor de explicación operacional de SEMSE OS. Responde SOLO usando las fuentes del contexto. No inventes contratos, evidencia ni historial. Si falta contexto, marca insufficientContext=true. No liberes pagos automáticamente. Cita fuentes."
      : "You are Prometeo, SEMSE OS operational explanation engine. Answer using ONLY the provided context. Do not invent data. Mark insufficientContext=true if missing info. Do not release payments automatically. Cite sources.";

    const prompt = [
      contextBlock,
      `---`,
      locale === "es" ? `Pregunta: ${question}` : `Question: ${question}`,
      ``,
      locale === "es"
        ? `Responde en JSON: {"answer":"...","nextBestAction":"...","confidence":0.0-1.0,"insufficientContext":false,"missingSources":[]}`
        : `Answer in JSON: {"answer":"...","nextBestAction":"...","confidence":0.0-1.0,"insufficientContext":false,"missingSources":[]}`,
    ].join("\n");

    let answer = "", confidence = 0.5, nextBestAction: string | undefined;
    let insufficientContext = false;
    let provider = "rules"; let model: string | undefined; let fallbackUsed = false;

    if (this.llm) {
      try {
        const res = await this.llm.chat({
          systemPrompt, history: [], userMessage: prompt,
          context: { ...getAgentProfile("evidence-analyzer"), agentName: "prometeo-operational", source: "prometeo-rag-phase3" },
        });
        provider = res.provider; model = res.model; fallbackUsed = res.metadata.fallbackUsed;
        const match = res.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const p = JSON.parse(match[0]) as Record<string, unknown>;
            answer = typeof p.answer === "string" ? p.answer : res.text;
            confidence = typeof p.confidence === "number" ? p.confidence : 0.5;
            nextBestAction = typeof p.nextBestAction === "string" ? p.nextBestAction : undefined;
            insufficientContext = Boolean(p.insufficientContext);
          } catch { answer = res.text; }
        } else { answer = res.text; }
      } catch {
        // Fallback: use governance data directly
        const gov = opCtx.paymentGovernance;
        answer = gov
          ? (locale === "es"
              ? `El proyecto está en estado ${gov.releaseStatus ?? "?"}. canRelease=${gov.canRelease}. ${Array.isArray(gov.blockers) && gov.blockers.length > 0 ? `Bloqueadores: ${(gov.blockers as string[]).join("; ")}. ` : ""}${gov.nextBestAction ? `Siguiente acción: ${gov.nextBestAction}.` : ""}`
              : `Project status: ${gov.releaseStatus}. canRelease=${gov.canRelease}. ${gov.nextBestAction ?? ""}`)
          : (locale === "es" ? "No se pudo procesar la consulta con el LLM local. Revise Ollama." : "Could not process with local LLM. Check Ollama.");
        nextBestAction = gov?.nextBestAction as string | undefined;
        provider = "rules"; fallbackUsed = true;
      }
    } else {
      // No LLM — deterministic template
      const gov = opCtx.paymentGovernance;
      answer = gov
        ? `${locale === "es" ? "Estado de pago" : "Payment status"}: ${gov.releaseStatus}. canRelease=${gov.canRelease}. ${gov.nextBestAction ?? ""}`
        : (locale === "es" ? "Sin datos de gobernanza disponibles." : "No governance data available.");
      nextBestAction = gov?.nextBestAction as string | undefined;
    }

    return ok(rid, {
      answer, citations, confidence, nextBestAction,
      insufficientContext, missingSources,
      provider, model, fallbackUsed,
      privacyMode: "privacyCritical",
      contextSourcesUsed: Object.keys(opCtx).filter((k) => {
        const v = opCtx[k as keyof typeof opCtx];
        return v !== null && (!Array.isArray(v) || (v as unknown[]).length > 0);
      }),
    });
  }

  @Post("plans/:buildOpsProjectId/rerun-bridge")
  @RequirePermissions("projects:status:update")
  async rerunBridge(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsPlanRerunService.rerunBridge({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
