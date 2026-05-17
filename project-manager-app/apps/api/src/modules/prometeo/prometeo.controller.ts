import { Body, Controller, Delete, Get, Optional, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import { getAgentProfile } from "../../infrastructure/llm/agent-profiles.js";
import { PrometeoService } from "./prometeo.service.js";
import { TradeGuideService } from "./trade-guide.service.js";

@Controller("v1/prometeo")
export class PrometeoController {

  constructor(
    private readonly svc: PrometeoService,
    @Optional() private readonly llm?: LLMOrchestrator,
    @Optional() private readonly tradeGuide?: TradeGuideService,
  ) {}

  // ── RAG Documents ───────────────────────────────────────────────────────────

  @Post("ingest")
  @RequirePermissions("agents:run:create")
  async ingest(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const trade      = typeof b.trade === "string" ? b.trade : "general";
    const visibility = typeof b.visibility === "string" ? b.visibility : "public_training";
    const doc = await this.svc.ingestText({
      tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      title: typeof b.title === "string" ? b.title : "Documento sin título",
      text: typeof b.text === "string" ? b.text : "",
      sourceType: typeof b.sourceType === "string" ? b.sourceType : "text",
      sourceRef: typeof b.sourceRef === "string" ? b.sourceRef : undefined,
      metadataJson: { trade, visibility, ...(typeof b.metadataJson === "object" && b.metadataJson !== null ? b.metadataJson as Record<string, unknown> : {}) },
    });
    return ok(rid, doc);
  }

  /** Ingest a file (PDF/DOCX/TXT/Markdown) as base64 payload */
  @Post("ingest-file")
  @RequirePermissions("agents:run:create")
  async ingestFile(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;

    const base64   = typeof b.fileBase64 === "string" ? b.fileBase64 : "";
    const mimeType = typeof b.mimeType === "string" ? b.mimeType : "text/plain";
    const fileName = typeof b.fileName === "string" ? b.fileName : "document";
    const title    = typeof b.title === "string" ? b.title.trim() : fileName;

    if (!base64) {
      const { BadRequestException } = await import("@nestjs/common");
      throw new BadRequestException("fileBase64 is required");
    }

    const buffer = Buffer.from(base64, "base64");
    const doc = await this.svc.ingestFile({
      tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId,
      title: title || fileName,
      fileBuffer: buffer,
      mimeType,
      fileName,
      trade:      typeof b.trade === "string" ? b.trade : "general",
      visibility: typeof b.visibility === "string" ? b.visibility : "public_training",
      projectId:  typeof b.projectId === "string" ? b.projectId : undefined,
    });
    return ok(rid, doc);
  }

  @Get("trade-library")
  @RequirePermissions("agents:run:create")
  async getTradeLibrary(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const library = await this.svc.getTradeLibrary(actor.tenantId);
    return ok(rid, library);
  }

  @Get("documents")
  @RequirePermissions("agents:run:create")
  async listDocuments(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("projectId") projectId?: string,
    @Query("trade") _trade?: string,
    @Query("status") _status?: string,
  ) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const docs = await this.svc.listDocuments(actor.tenantId, projectId);
    // Client-side filter on metadataJson trade/status
    const filtered = docs.filter((d) => {
      const meta = (d.metadataJson ?? {}) as Record<string, unknown>;
      if (_trade && meta.trade !== _trade) return false;
      if (_status && d.status !== _status) return false;
      return true;
    });
    return ok(rid, filtered);
  }

  @Delete("documents/:id")
  @RequirePermissions("agents:run:create")
  async deleteDocument(@Req() req: { headers?: Record<string, unknown> }, @Param("id") id: string) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    await this.svc.deleteDocument({ tenantId: actor.tenantId, id });
    return ok(rid, { deleted: true });
  }

  @Post("search")
  @RequirePermissions("agents:run:create")
  async search(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const results = await this.svc.search({
      tenantId: actor.tenantId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      query: typeof b.query === "string" ? b.query : "",
      topK: typeof b.topK === "number" ? b.topK : 5,
    });
    return ok(rid, results);
  }

  @Post("rag-context")
  @RequirePermissions("agents:run:create")
  async ragContext(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const ctx = await this.svc.buildRagContext({
      tenantId: actor.tenantId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      query: typeof b.query === "string" ? b.query : "",
      topK: typeof b.topK === "number" ? b.topK : 5,
    });
    return ok(rid, ctx);
  }

  /** RAG query with LLM answer + citations — uses Ollama local-first (privacyCritical). */
  @Post("rag-query")
  @RequirePermissions("agents:run:create")
  async ragQuery(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const question = typeof b.question === "string" ? b.question.trim() : "";
    const locale    = typeof b.locale === "string" && b.locale === "en" ? "en" : "es";
    const tradeFilter = typeof b.trade === "string" ? b.trade : undefined;

    if (!question) return ok(rid, { answer: "La pregunta no puede estar vacía.", citations: [], confidence: 0, insufficientContext: true });

    // 1. Build RAG context (with optional trade filter applied post-retrieval)
    const ctx = await this.svc.buildRagContext({
      tenantId: actor.tenantId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      query: question,
      topK: tradeFilter ? 10 : 6, // fetch more if filtering by trade
    });

    // Apply trade filter if specified
    if (tradeFilter) {
      ctx.chunks = ctx.chunks.filter((c) => {
        const meta = (c as Record<string, unknown> & { metadataJson?: unknown }).metadataJson as Record<string, unknown> | undefined;
        return !meta?.trade || meta.trade === tradeFilter || meta.trade === "general";
      });
    }

    const INSUFFICIENT = ctx.chunks.length === 0;

    if (INSUFFICIENT) {
      return ok(rid, {
        answer: locale === "es"
          ? "No hay suficiente información en la base documental de Prometeo para responder. Ingesta documentos relevantes primero."
          : "Not enough information in Prometeo's document base to answer. Ingest relevant documents first.",
        citations: [],
        confidence: 0,
        insufficientContext: true,
        missingSources: ["documents"],
        provider: "rules",
        model: null,
        fallbackUsed: false,
        privacyMode: "privacyCritical",
      });
    }

    // 2. Build prompt
    const systemPrompt = locale === "es"
      ? "Eres Prometeo, el asistente documental de SEMSE OS. Responde usando SOLO el contexto proporcionado. Si no puedes responder con el contexto, di que no hay suficiente información. Siempre cita la fuente con [Fuente: DocumentTitle]."
      : "You are Prometeo, SEMSE OS document assistant. Answer using ONLY the provided context. If you cannot answer, say there is insufficient information. Always cite with [Source: DocumentTitle].";

    const userMessage = [
      ctx.contextBlock,
      `---`,
      locale === "es" ? `Pregunta: ${question}` : `Question: ${question}`,
      ``,
      locale === "es"
        ? `Responde en JSON: {"answer":"...","confidence":0.0-1.0,"nextBestAction":"...","insufficientContext":false}`
        : `Answer in JSON: {"answer":"...","confidence":0.0-1.0,"nextBestAction":"...","insufficientContext":false}`,
    ].join("\n");

    // 3. Call LLM (privacyCritical → Ollama local, never cloud)
    let answer = "";
    let confidence = 0.5;
    let nextBestAction: string | undefined;
    let provider = "rules";
    let model: string | undefined;
    let fallbackUsed = false;
    let structuredOk = false;

    if (this.llm) {
      try {
        const res = await this.llm.chat({
          systemPrompt,
          history: [],
          userMessage,
          context: {
            ...getAgentProfile("evidence-analyzer"), // privacyCritical
            agentName: "prometeo-rag",
            source: "prometeo",
          },
        });
        provider = res.provider;
        model = res.model;
        fallbackUsed = res.metadata.fallbackUsed;

        const match = res.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]) as Record<string, unknown>;
            answer = typeof parsed.answer === "string" ? parsed.answer : res.text;
            confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
            nextBestAction = typeof parsed.nextBestAction === "string" ? parsed.nextBestAction : undefined;
            structuredOk = true;
          } catch { answer = res.text; }
        } else {
          answer = res.text;
        }
      } catch {
        answer = locale === "es"
          ? `Basado en la documentación disponible: ${ctx.chunks[0]?.text.slice(0, 300) ?? ""}`
          : `Based on available documentation: ${ctx.chunks[0]?.text.slice(0, 300) ?? ""}`;
        provider = "rules";
      }
    } else {
      // Fallback: summarize top chunk
      answer = locale === "es"
        ? `De la base documental: "${ctx.chunks[0]?.text.slice(0, 400) ?? "Sin resultados"}" — [${ctx.chunks[0]?.documentTitle ?? ""}]`
        : `From document base: "${ctx.chunks[0]?.text.slice(0, 400) ?? "No results"}" — [${ctx.chunks[0]?.documentTitle ?? ""}]`;
    }

    // 4. Build citations
    const citations = ctx.chunks.slice(0, 5).map((c) => ({
      type:      "document",
      id:        c.documentId,
      label:     c.documentTitle,
      excerpt:   c.text.slice(0, 150),
      chunkIndex: c.chunkIndex,
      score:     c.score,
    }));

    return ok(rid, {
      answer,
      citations,
      confidence,
      nextBestAction,
      insufficientContext: false,
      structuredOutputValid: structuredOk,
      provider,
      model,
      fallbackUsed,
      privacyMode: "privacyCritical",
      documentsSearched: ctx.chunks.length,
    });
  }

  /** Training Agent — trade-specific guidance using indexed manuals/books. */
  @Post("trade-guide")
  @RequirePermissions("agents:run:create")
  async tradeGuide(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const question = typeof b.question === "string" ? b.question.trim() : "";
    const trade    = typeof b.trade === "string" ? b.trade : "general";
    const locale   = b.locale === "en" ? "en" as const : "es" as const;

    if (!question) return ok(rid, { answer: "La pregunta no puede estar vacía.", confidence: 0, insufficientContext: true });

    if (!this.tradeGuide) {
      return ok(rid, { answer: "Training Agent no está disponible.", confidence: 0, insufficientContext: true });
    }

    const result = await this.tradeGuide.guide({
      question, trade, locale,
      tenantId:  actor.tenantId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
    });

    return ok(rid, result);
  }

  // ── Assets ──────────────────────────────────────────────────────────────────

  @Post("assets")
  @RequirePermissions("agents:run:create")
  async createAsset(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const asset = await this.svc.createAsset({
      tenantId: actor.tenantId, orgId: actor.orgId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      name: typeof b.name === "string" ? b.name : "Activo",
      category: typeof b.category === "string" ? b.category : undefined,
      serialNumber: typeof b.serialNumber === "string" ? b.serialNumber : undefined,
      location: typeof b.location === "string" ? b.location : undefined,
    });
    return ok(rid, asset);
  }

  @Get("assets")
  @RequirePermissions("agents:run:create")
  async listAssets(@Req() req: { headers?: Record<string, unknown> }, @Query("projectId") projectId?: string, @Query("category") category?: string) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.svc.listAssets({ tenantId: actor.tenantId, projectId, category }));
  }

  @Patch("assets/:id/status")
  @RequirePermissions("agents:run:create")
  async updateAssetStatus(@Req() req: { headers?: Record<string, unknown> }, @Param("id") id: string, @Body() body: { status: string }) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.svc.updateAssetStatus({ tenantId: actor.tenantId, id, status: body.status }));
  }

  // ── Work Orders ─────────────────────────────────────────────────────────────

  @Post("work-orders")
  @RequirePermissions("agents:run:create")
  async createWorkOrder(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const wo = await this.svc.createWorkOrder({
      tenantId: actor.tenantId, orgId: actor.orgId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      jobId: typeof b.jobId === "string" ? b.jobId : undefined,
      title: typeof b.title === "string" ? b.title : "OT sin título",
      description: typeof b.description === "string" ? b.description : undefined,
      priority: typeof b.priority === "string" ? b.priority : undefined,
      assignedToId: typeof b.assignedToId === "string" ? b.assignedToId : undefined,
      scheduledAt: typeof b.scheduledAt === "string" ? new Date(b.scheduledAt) : undefined,
      dueAt: typeof b.dueAt === "string" ? new Date(b.dueAt) : undefined,
    });
    return ok(rid, wo);
  }

  @Get("work-orders")
  @RequirePermissions("agents:run:create")
  async listWorkOrders(@Req() req: { headers?: Record<string, unknown> }, @Query("projectId") projectId?: string, @Query("status") status?: string) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.svc.listWorkOrders({ tenantId: actor.tenantId, projectId, status }));
  }

  @Patch("work-orders/:id/status")
  @RequirePermissions("agents:run:create")
  async updateWorkOrderStatus(@Req() req: { headers?: Record<string, unknown> }, @Param("id") id: string, @Body() body: { status: string }) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.svc.updateWorkOrderStatus({ tenantId: actor.tenantId, id, status: body.status }));
  }
}
