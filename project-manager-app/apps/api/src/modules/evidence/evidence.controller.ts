import {
  BadRequestException,
  ConflictException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UnprocessableEntityException
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  multipartUploadSessionCompleteSchema,
  multipartUploadSessionCreateSchema,
  presignEvidenceSchema,
  registerEvidenceSchema,
  registerEvidencePhotoSchema,
  uploadPlanSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleEvidence } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { buildTenantStorageKey } from "../../infrastructure/storage/storage-key.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";
import { validateUploadStream } from "../../infrastructure/storage/uploads.controller.js";
import { EvidenceService } from "./evidence.service.js";
import { randomUUID, createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";

type MultipartSessionManifest = {
  sessionId: string;
  tenantId: string;
  provider: string;
  createdAt: string;
  expiresAt: string;
  key: string;
  domain: "evidence" | "contract" | "dispute" | "travel" | "knowledge_contribution";
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
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly storageService: StorageService
  ) {}

  private readonly multipartRoot = process.env.SEMSE_MULTIPART_STORAGE_ROOT?.trim().length
    ? path.resolve(process.env.SEMSE_MULTIPART_STORAGE_ROOT)
    : path.join("/tmp", "semse-multipart-sessions");

  private buildUploadPlan(input: {
    tenantId: string;
    domain: "evidence" | "contract" | "dispute" | "travel" | "knowledge_contribution";
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

    const domainGuidance: Record<"evidence" | "contract" | "dispute" | "travel" | "knowledge_contribution", string> = {
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
          : "Carga directa recomendada para tickets, facturas y recibos de viaje.",
      knowledge_contribution:
        recommendedStrategy === "external_transfer"
          ? "Para clips de video largos usa transferencia externa o multipart; puedes subir varios clips cortos en vez de uno solo."
          : "Carga directa recomendada para clips cortos, fotos, notas de audio o texto de una misión de conocimiento."
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

  /**
   * Path of a part's raw bytes on disk, scoped under the session so cleanup
   * is a single directory removal. Same path-traversal guard as
   * getMultipartSessionPath — sessionId is already validated there and
   * partNumber is a small positive integer, but never trust a param into a
   * path join without re-confirming the result stays under the root.
   */
  private getMultipartPartPath(sessionId: string, partNumber: number) {
    this.getMultipartSessionPath(sessionId); // validates sessionId shape
    if (!Number.isInteger(partNumber) || partNumber <= 0) {
      throw new BadRequestException("Invalid part number");
    }
    const root = path.resolve(this.multipartRoot, "parts", sessionId);
    const resolved = path.resolve(root, `part-${partNumber}.bin`);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new BadRequestException("Invalid multipart part path");
    }
    return resolved;
  }

  private async saveMultipartManifest(manifest: MultipartSessionManifest) {
    await mkdir(this.multipartRoot, { recursive: true });
    await writeFile(this.getMultipartSessionPath(manifest.sessionId), JSON.stringify(manifest, null, 2), "utf8");
  }

  private async readMultipartManifest(sessionId: string): Promise<MultipartSessionManifest> {
    let content: string;
    try {
      content = await readFile(this.getMultipartSessionPath(sessionId), "utf8");
    } catch (_error) {
      throw new NotFoundException(`Multipart session '${sessionId}' not found`);
    }
    try {
      return JSON.parse(content) as MultipartSessionManifest;
    } catch {
      throw new BadRequestException(`Malformed multipart session manifest '${sessionId}'`);
    }
  }

  private createMultipartSession(input: {
    tenantId: string;
    domain: "evidence" | "contract" | "dispute" | "travel" | "knowledge_contribution";
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
      tenantId: input.tenantId,
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

  /**
   * Authorization is by tenant match against the manifest, not by any part
   * -level ACL — a session belongs to whoever created it (`resolveRequestContext`
   * at session-create time), and every part/complete call must come from that
   * same tenant. A mismatch is reported as 404, not 403, so a wrong-tenant
   * caller can't use this to confirm a session id exists.
   */
  private assertManifestTenant(manifest: MultipartSessionManifest, actorTenantId: string): void {
    if (manifest.tenantId !== actorTenantId) {
      throw new NotFoundException(`Multipart session '${manifest.sessionId}' not found`);
    }
  }

  @Put("v1/uploads/multipart-session/:sessionId/parts/:partNumber")
  @RequirePermissions("evidence:write")
  async uploadMultipartPart(
    @Req() req: FastifyRequest,
    @Param("sessionId") sessionId: string,
    @Param("partNumber") partNumberRaw: string
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    const partNumber = Number(partNumberRaw);
    if (!Number.isInteger(partNumber) || partNumber <= 0) {
      throw new BadRequestException("Invalid part number");
    }

    const manifest = await this.readMultipartManifest(sessionId);
    this.assertManifestTenant(manifest, actor.tenantId);
    if (new Date(manifest.expiresAt).getTime() <= Date.now()) {
      throw new ConflictException(`Multipart session '${sessionId}' has expired`);
    }
    const part = manifest.parts.find((item) => item.partNumber === partNumber);
    if (!part) {
      throw new BadRequestException("Multipart part not found");
    }

    // Actually persist the part's bytes — this used to only record the
    // content-length header and fabricate a timestamp-based etag, silently
    // discarding the uploaded data (see PR-4 ZOOM report). Write to disk and
    // hash the real bytes so the etag verified at completion is meaningful.
    const partPath = this.getMultipartPartPath(sessionId, partNumber);
    await mkdir(path.dirname(partPath), { recursive: true });
    const hash = createHash("sha256");
    const ws = createWriteStream(partPath);
    await pipeline(
      (async function* () {
        for await (const chunk of req.raw) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          hash.update(buffer);
          yield buffer;
        }
      })(),
      ws
    );

    const written = await stat(partPath);
    if (written.size === 0) {
      await unlink(partPath).catch(() => undefined);
      throw new UnprocessableEntityException("Empty multipart part is not allowed");
    }

    part.status = "uploaded";
    part.uploadedAt = new Date().toISOString();
    part.bytesReceived = written.size;
    part.etag = hash.digest("hex");

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
  async completeMultipartSession(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const parsed = multipartUploadSessionCompleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    const manifest = await this.readMultipartManifest(parsed.data.sessionId);
    this.assertManifestTenant(manifest, actor.tenantId);

    // Completion only ever confirms parts the server itself received and
    // hashed in uploadMultipartPart — a client cannot complete a session by
    // just asserting etags for parts it never actually PUT.
    const providedEtags = new Map(parsed.data.parts.map((part) => [part.partNumber, part.etag]));
    const orderedParts = [...manifest.parts].sort((a, b) => a.partNumber - b.partNumber);
    const invalid = orderedParts.filter(
      (part) => part.status !== "uploaded" || !part.etag || providedEtags.get(part.partNumber) !== part.etag
    );
    if (invalid.length > 0) {
      throw new ConflictException(
        `Multipart session '${manifest.sessionId}' is missing or has mismatched parts: ${invalid
          .map((p) => p.partNumber)
          .join(", ")}`
      );
    }

    const partPaths = orderedParts.map((part) => this.getMultipartPartPath(manifest.sessionId, part.partNumber));
    async function* readPartsInOrder(): AsyncGenerator<Buffer> {
      for (const partPath of partPaths) {
        for await (const chunk of createReadStream(partPath)) {
          yield chunk as Buffer;
        }
      }
    }

    const validated = validateUploadStream(readPartsInOrder(), manifest.contentType, manifest.fileSizeBytes);
    const stored = await this.storageService.store({
      key: manifest.key,
      stream: validated,
      contentType: manifest.contentType
    });

    if (stored.sizeBytes !== manifest.fileSizeBytes) {
      await this.storageService.delete(manifest.key);
      throw new ConflictException(
        `Assembled multipart upload size (${stored.sizeBytes}) does not match the declared size (${manifest.fileSizeBytes}); aborted`
      );
    }

    // Best-effort cleanup of the temporary part files — never fails the
    // response, the completed file at manifest.key is already the source of
    // truth at this point.
    await Promise.all(partPaths.map((partPath) => unlink(partPath).catch(() => undefined)));

    return ok(requestId, {
      sessionId: manifest.sessionId,
      status: "completed",
      completedAt: new Date().toISOString(),
      partsReceived: orderedParts.length,
      totalParts: manifest.parts.length,
      key: manifest.key,
      sizeBytes: stored.sizeBytes
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
      kind: parsed.data.kind,
      filename: parsed.data.filename
    });

    return ok(requestId, toVisibleEvidence(evidence));
  }

  /**
   * POST /v1/projects/:projectId/evidence/photos
   * m2.2-dispute-docs Bloque 2.2.A — `key` must already reference an
   * uploaded file (via the existing presign flow). Reads it back
   * server-side to extract EXIF timestamp/GPS; returns 400 (EXIF_INVALID)
   * if the photo has neither, per the spec's own error contract.
   */
  @Post("v1/projects/:projectId/evidence/photos")
  @RequirePermissions("evidence:write")
  async registerPhoto(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("projectId") projectId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = registerEvidencePhotoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const evidence = await this.evidenceService.registerPhotoWithExif({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      requestId,
      projectId,
      key: parsed.data.key,
      filename: parsed.data.filename,
      category: parsed.data.category,
      description: parsed.data.description
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
