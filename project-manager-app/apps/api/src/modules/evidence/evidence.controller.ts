import { BadRequestException, Body, Controller, Get, Param, Post, Put, Req } from "@nestjs/common";
import {
  multipartUploadSessionCompleteSchema,
  multipartUploadSessionCreateSchema,
  presignEvidenceSchema,
  registerEvidenceSchema,
  uploadPlanSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleEvidence } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { buildTenantStorageKey } from "../../infrastructure/storage/storage-key.js";
import { EvidenceService } from "./evidence.service.js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type MultipartSessionManifest = {
  sessionId: string;
  provider: string;
  createdAt: string;
  expiresAt: string;
  key: string;
  domain: "evidence" | "contract" | "dispute" | "travel";
  contentType: string;
  fileSizeBytes: number;
  source: string;
  maxSingleUploadBytes: number;
  recommendedStrategy: string;
  uploadGuidance: string;
  multipart: {
    recommendedChunkSizeBytes?: number;
    recommendedPartCount?: number;
    requiresOutOfBandTransfer?: boolean;
  } | null;
  parts: Array<{
    partNumber: number;
    startByte: number;
    endByte: number;
    uploadUrl: string;
    status: "pending" | "uploaded";
    uploadedAt: string | null;
    bytesReceived: number;
    etag: string | null;
  }>;
};

@Controller()
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  private readonly multipartRoot = process.env.SEMSE_MULTIPART_STORAGE_ROOT?.trim().length
    ? path.resolve(process.env.SEMSE_MULTIPART_STORAGE_ROOT)
    : path.join("/tmp", "semse-multipart-sessions");

  private buildUploadPlan(input: {
    tenantId: string;
    domain: "evidence" | "contract" | "dispute" | "travel";
    filename: string;
    contentType: string;
    fileSizeBytes?: number;
    source?: "local_device" | "camera_capture" | "field_ops" | "project_copilot" | "external_transfer";
  }) {
    const maxSingleUploadBytes = 25 * 1024 * 1024;
    const fileSizeBytes = input.fileSizeBytes;
    const recommendedStrategy =
      fileSizeBytes && fileSizeBytes > maxSingleUploadBytes
        ? "external_transfer"
        : "single_put";
    const recommendedChunkSizeBytes =
      fileSizeBytes && fileSizeBytes > maxSingleUploadBytes ? 10 * 1024 * 1024 : undefined;
    const recommendedPartCount =
      fileSizeBytes && recommendedChunkSizeBytes
        ? Math.ceil(fileSizeBytes / recommendedChunkSizeBytes)
        : undefined;

    const domainGuidance: Record<"evidence" | "contract" | "dispute" | "travel", string> = {
      evidence:
        recommendedStrategy === "external_transfer"
          ? "Use transferencia externa o carga por partes para video largo, ZIP pesado, CAD o lotes de evidencia."
          : "Carga directa recomendada para evidencia individual liviana o media.",
      contract:
        recommendedStrategy === "external_transfer"
          ? "Para contratos pesados usa transferencia externa y conserva hash + PDF final antes de firma."
          : "Carga directa recomendada para PDF contractual, anexo o documento de firma liviano.",
      dispute:
        recommendedStrategy === "external_transfer"
          ? "Para disputas con evidencia abundante usa transferencia externa y consolida el paquete por lotes."
          : "Carga directa recomendada para anexos puntuales de una disputa.",
      travel:
        recommendedStrategy === "external_transfer"
          ? "Para comprobantes de viaje pesados usa transferencia externa o multipart y conserva el soporte final por gasto."
          : "Carga directa recomendada para tickets, facturas y recibos de viaje."
    };

    const key = buildTenantStorageKey({
      tenantId: input.tenantId,
      domain: input.domain ?? "evidence",
      filename: input.filename,
      nonce: `${Date.now()}-${randomUUID()}`,
    });
    const apiBase = (process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

    return {
      uploadUrl: `${apiBase}/v1/uploads/files/${encodeURIComponent(key)}`,
      key,
      contentType: input.contentType,
      fileSizeBytes,
      domain: input.domain,
      source: input.source ?? "local_device",
      maxSingleUploadBytes,
      recommendedStrategy,
      acceptedChannels: [
        "local_device",
        "camera_capture",
        "field_ops",
        "project_copilot",
        "external_transfer"
      ],
      uploadGuidance: domainGuidance[input.domain],
      multipart:
        recommendedStrategy === "external_transfer"
          ? {
              recommendedChunkSizeBytes,
              recommendedPartCount,
              requiresOutOfBandTransfer: true
            }
          : null
    };
  }

  private getBaseUrl(headers: Record<string, unknown>) {
    const host = typeof headers.host === "string" && headers.host.length > 0
      ? headers.host
      : "127.0.0.1:4000";
    const proto = typeof headers["x-forwarded-proto"] === "string" && headers["x-forwarded-proto"].length > 0
      ? headers["x-forwarded-proto"]
      : "http";
    return `${proto}://${host}`;
  }

  private getMultipartSessionPath(sessionId: string) {
    if (!/^mus_[0-9a-f-]{36}$/.test(sessionId)) {
      throw new BadRequestException("Invalid multipart session id");
    }

    const root = path.resolve(this.multipartRoot);
    const resolved = path.resolve(root, `${sessionId}.json`);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new BadRequestException("Invalid multipart session path");
    }
    return resolved;
  }

  private async saveMultipartManifest(manifest: MultipartSessionManifest) {
    await mkdir(this.multipartRoot, { recursive: true });
    await writeFile(this.getMultipartSessionPath(manifest.sessionId), JSON.stringify(manifest, null, 2), "utf8");
  }

  private async readMultipartManifest(sessionId: string): Promise<MultipartSessionManifest> {
    const content = await readFile(this.getMultipartSessionPath(sessionId), "utf8");
    return JSON.parse(content) as MultipartSessionManifest;
  }

  private createMultipartSession(input: {
    tenantId: string;
    domain: "evidence" | "contract" | "dispute" | "travel";
    filename: string;
    contentType: string;
    fileSizeBytes: number;
    source?: "local_device" | "camera_capture" | "field_ops" | "project_copilot" | "external_transfer";
  }, headers: Record<string, unknown>) {
    const plan = this.buildUploadPlan(input);
    const chunkSize = plan.multipart?.recommendedChunkSizeBytes ?? 10 * 1024 * 1024;
    const partCount = Math.max(1, Math.ceil(input.fileSizeBytes / chunkSize));
    const sessionId = `mus_${randomUUID()}`;
    const baseUrl = this.getBaseUrl(headers);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

    const manifest: MultipartSessionManifest = {
      ...plan,
      sessionId,
      provider: this.multipartRoot.startsWith("/tmp") ? "filesystem_multipart" : "filesystem_external",
      createdAt: new Date().toISOString(),
      expiresAt,
      fileSizeBytes: input.fileSizeBytes,
      parts: Array.from({ length: partCount }, (_, index) => {
        const partNumber = index + 1;
        return {
          partNumber,
          startByte: index * chunkSize,
          endByte: Math.min(input.fileSizeBytes, (index + 1) * chunkSize) - 1,
          uploadUrl: `${baseUrl}/v1/uploads/multipart-session/${sessionId}/parts/${partNumber}`,
          status: "pending",
          uploadedAt: null,
          bytesReceived: 0,
          etag: null
        };
      })
    };

    return manifest;
  }

  private toMultipartResponse(manifest: MultipartSessionManifest) {
    return {
      ...manifest,
      parts: manifest.parts.map((part) => ({
        partNumber: part.partNumber,
        startByte: part.startByte,
        endByte: part.endByte,
        uploadUrl: part.uploadUrl,
        status: part.status,
        uploadedAt: part.uploadedAt,
        bytesReceived: part.bytesReceived,
        etag: part.etag
      }))
    };
  }

  @Post("v1/evidence/presign")
  @RequirePermissions("evidence:write")
  presign(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = presignEvidenceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    return ok(
      requestId,
      this.buildUploadPlan({
        tenantId: actor.tenantId,
        domain: "evidence",
        filename: parsed.data.filename,
        contentType: parsed.data.contentType,
        fileSizeBytes: parsed.data.fileSizeBytes,
        source: parsed.data.source
      })
    );
  }

  @Post("v1/uploads/plan")
  @RequirePermissions("evidence:write")
  planUpload(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = uploadPlanSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    return ok(requestId, this.buildUploadPlan({ ...parsed.data, tenantId: actor.tenantId }));
  }

  @Post("v1/uploads/multipart-session")
  @RequirePermissions("evidence:write")
  createMultipartSessionEndpoint(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = multipartUploadSessionCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    const manifest = this.createMultipartSession({ ...parsed.data, tenantId: actor.tenantId }, req.headers ?? {});
    return this.saveMultipartManifest(manifest).then(() => ok(requestId, this.toMultipartResponse(manifest)));
  }

  @Put("v1/uploads/multipart-session/:sessionId/parts/:partNumber")
  @RequirePermissions("evidence:write")
  async uploadMultipartPart(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Param("partNumber") partNumberRaw: string
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const partNumber = Number(partNumberRaw);
    if (!Number.isInteger(partNumber) || partNumber <= 0) {
      throw new BadRequestException("Invalid part number");
    }

    const manifest = await this.readMultipartManifest(sessionId);
    const part = manifest.parts.find((item) => item.partNumber === partNumber);
    if (!part) {
      throw new BadRequestException("Multipart part not found");
    }

    const bytesReceived = Number(req.headers?.["x-part-size"] ?? req.headers?.["content-length"] ?? 0);
    const etag = `etag-${sessionId}-${partNumber}-${Date.now()}`;
    part.status = "uploaded";
    part.uploadedAt = new Date().toISOString();
    part.bytesReceived = Number.isFinite(bytesReceived) && bytesReceived > 0
      ? bytesReceived
      : Math.max(0, part.endByte - part.startByte + 1);
    part.etag = etag;

    await this.saveMultipartManifest(manifest);
    return ok(requestId, {
      sessionId,
      partNumber,
      status: part.status,
      bytesReceived: part.bytesReceived,
      etag: part.etag,
      uploadedAt: part.uploadedAt
    });
  }

  @Post("v1/uploads/multipart-session/complete")
  @RequirePermissions("evidence:write")
  async completeMultipartSession(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = multipartUploadSessionCompleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const requestId = resolveRequestId(req.headers ?? {});
    const manifest = await this.readMultipartManifest(parsed.data.sessionId);
    const providedEtags = new Map(parsed.data.parts.map((part) => [part.partNumber, part.etag]));
    let partsReceived = 0;
    manifest.parts = manifest.parts.map((part) => {
      const etag = providedEtags.get(part.partNumber);
      if (etag) {
        part.status = "uploaded";
        part.etag = etag;
        part.uploadedAt = part.uploadedAt ?? new Date().toISOString();
        part.bytesReceived = part.bytesReceived || Math.max(0, part.endByte - part.startByte + 1);
        partsReceived += 1;
      }
      return part;
    });
    await this.saveMultipartManifest(manifest);

    return ok(requestId, {
      sessionId: parsed.data.sessionId,
      status: "completed",
      completedAt: new Date().toISOString(),
      partsReceived,
      totalParts: manifest.parts.length
    });
  }

  @Post("v1/evidence")
  @RequirePermissions("evidence:write")
  async register(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = registerEvidenceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const evidence = await this.evidenceService.register({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      requestId,
      projectId: parsed.data.projectId,
      jobId: parsed.data.jobId,
      milestoneId: parsed.data.milestoneId,
      key: parsed.data.key,
      kind: parsed.data.kind
    });

    return ok(requestId, toVisibleEvidence(evidence));
  }

  @Get("v1/jobs/:jobId/evidence")
  @RequirePermissions("evidence:read")
  async listByJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const evidence = await this.evidenceService.listByJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId
    });
    return ok(resolveRequestId(req.headers ?? {}), evidence.map((item) => toVisibleEvidence(item)));
  }

  @Get("v1/projects/:projectId/evidence")
  @RequirePermissions("evidence:read")
  async listByProject(@Req() req: { headers?: Record<string, unknown> }, @Param("projectId") projectId: string) {
    const actor = resolveRequestContext(req);
    const evidence = await this.evidenceService.listByProject({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId
    });
    return ok(resolveRequestId(req.headers ?? {}), evidence.map((item) => toVisibleEvidence(item)));
  }

  @Get("v1/evidence/:evidenceId")
  @RequirePermissions("evidence:read")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("evidenceId") evidenceId: string) {
    const actor = resolveRequestContext(req);
    const evidence = await this.evidenceService.detail({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      evidenceId
    });
    return ok(resolveRequestId(req.headers ?? {}), toVisibleEvidence(evidence));
  }
}
