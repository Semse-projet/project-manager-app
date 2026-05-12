import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { PrometeoService } from "./prometeo.service.js";

@Controller("v1/prometeo")
export class PrometeoController {

  constructor(private readonly svc: PrometeoService) {}

  // ── RAG Documents ───────────────────────────────────────────────────────────

  @Post("ingest")
  @RequirePermissions("agents:run:create")
  async ingest(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const b = body as Record<string, unknown>;
    const doc = await this.svc.ingestText({
      tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId,
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      title: typeof b.title === "string" ? b.title : "Documento sin título",
      text: typeof b.text === "string" ? b.text : "",
      sourceType: typeof b.sourceType === "string" ? b.sourceType : "text",
      sourceRef: typeof b.sourceRef === "string" ? b.sourceRef : undefined,
      metadataJson: typeof b.metadataJson === "object" && b.metadataJson !== null ? b.metadataJson as Record<string, unknown> : undefined,
    });
    return ok(rid, doc);
  }

  @Get("documents")
  @RequirePermissions("agents:run:create")
  async listDocuments(@Req() req: { headers?: Record<string, unknown> }, @Query("projectId") projectId?: string) {
    const actor = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const docs = await this.svc.listDocuments(actor.tenantId, projectId);
    return ok(rid, docs);
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
