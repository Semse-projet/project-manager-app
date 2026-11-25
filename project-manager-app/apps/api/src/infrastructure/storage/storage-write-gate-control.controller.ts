import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { hasPermission, normalizeRoles } from "../../common/rbac.js";
import { isProductionStorage } from "./production-storage-guard.js";
import {
  STORAGE_WRITE_GATE_FREEZE_TTL_MAX_SECONDS,
  STORAGE_WRITE_GATE_FREEZE_TTL_MIN_SECONDS,
  StorageWriteGateBlockedError,
} from "./storage-write-gate-state.js";
import { StorageWriteGateControlService } from "./storage-write-gate-control.service.js";

const metadataSchema = z.object({
  ticket: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
}).strict();

const epochSchema = z.string().regex(/^[1-9][0-9]{0,15}$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

const transitionSchema = metadataSchema.extend({
  expectedEpoch: epochSchema,
  action: z.enum(["BEGIN_DRAIN", "MARK_FROZEN", "THAW", "ABORT_DRAIN"]),
  freezeTtlSeconds: z.number().int()
    .min(STORAGE_WRITE_GATE_FREEZE_TTL_MIN_SECONDS)
    .max(STORAGE_WRITE_GATE_FREEZE_TTL_MAX_SECONDS)
    .optional(),
}).strict();

const coverageSchema = metadataSchema.extend({
  expectedEpoch: epochSchema,
  coverageDigest: digestSchema,
}).strict();

const windowClosedSchema = metadataSchema.extend({
  expectedEpoch: epochSchema,
  windowEvidenceDigest: digestSchema,
}).strict();

const recoverySchema = metadataSchema.extend({
  expectedEpoch: epochSchema,
  writerInstanceId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{5,190}$/),
  terminationEvidenceDigest: digestSchema,
}).strict();

function requireOpsAdmin(roles: string[]): void {
  if (!normalizeRoles(roles).includes("OPS_ADMIN")) {
    throw new ForbiddenException({
      message: "Storage write gate control requires OPS_ADMIN role",
      requiredRole: "OPS_ADMIN",
    });
  }
}

/**
 * Production mutate is denied unless this permission is present.
 * Staging keeps the existing manage permission only.
 */
export function productionMutateAuthorized(roles: string[]): boolean {
  if (!isProductionStorage(process.env)) return false;
  if (!hasPermission(roles, "ops:storage-write-gate:production-mutate")) {
    throw new ForbiddenException({
      message: "Production storage write gate mutation requires ops:storage-write-gate:production-mutate",
      requiredPermission: "ops:storage-write-gate:production-mutate",
    });
  }
  return true;
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}

async function control<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof StorageWriteGateBlockedError) {
      if (error.reason.startsWith("invalid_")) {
        throw new BadRequestException({
          message: "Storage write gate control request is invalid",
          reason: error.reason,
        });
      }
      throw new ConflictException({
        message: "Storage write gate control rejected",
        reason: error.reason,
      });
    }
    throw error;
  }
}

@Controller("v1/internal/storage-write-gate")
export class StorageWriteGateControlController {
  constructor(private readonly service: StorageWriteGateControlService) {}

  @Get("status")
  @RequirePermissions("ops:storage-write-gate:manage")
  async status(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    requireOpsAdmin(actor.roles);
    return ok(resolveRequestId(req.headers ?? {}), await control(() => this.service.status()));
  }

  @Post("provision")
  @RequirePermissions("ops:storage-write-gate:manage")
  async provision(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    requireOpsAdmin(actor.roles);
    const parsed = parse(metadataSchema, body);
    const data = await control(() => this.service.provision({
      actorUserId: actor.userId,
      ...parsed,
    }));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("transition")
  @RequirePermissions("ops:storage-write-gate:manage")
  async transition(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    requireOpsAdmin(actor.roles);
    const parsed = parse(transitionSchema, body);
    const granted = productionMutateAuthorized(actor.roles);
    const data = await control(() => this.service.transition({
      actorUserId: actor.userId,
      ticket: parsed.ticket,
      reason: parsed.reason,
      idempotencyKey: parsed.idempotencyKey,
      expectedEpoch: BigInt(parsed.expectedEpoch),
      action: parsed.action,
      freezeTtlSeconds: parsed.freezeTtlSeconds,
      productionMutateAuthorized: granted,
    }));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("coverage")
  @RequirePermissions("ops:storage-write-gate:manage")
  async coverage(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    requireOpsAdmin(actor.roles);
    const parsed = parse(coverageSchema, body);
    const granted = productionMutateAuthorized(actor.roles);
    const data = await control(() => this.service.attestCoverage({
      actorUserId: actor.userId,
      ticket: parsed.ticket,
      reason: parsed.reason,
      idempotencyKey: parsed.idempotencyKey,
      expectedEpoch: BigInt(parsed.expectedEpoch),
      coverageDigest: parsed.coverageDigest,
      productionMutateAuthorized: granted,
    }));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("window-closed")
  @RequirePermissions("ops:storage-write-gate:manage")
  async windowClosed(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    requireOpsAdmin(actor.roles);
    const parsed = parse(windowClosedSchema, body);
    const granted = productionMutateAuthorized(actor.roles);
    const data = await control(() => this.service.attestWindowClosed({
      actorUserId: actor.userId,
      ticket: parsed.ticket,
      reason: parsed.reason,
      idempotencyKey: parsed.idempotencyKey,
      expectedEpoch: BigInt(parsed.expectedEpoch),
      windowEvidenceDigest: parsed.windowEvidenceDigest,
      productionMutateAuthorized: granted,
    }));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("operations/:operationId/recover")
  @RequirePermissions("ops:storage-write-gate:manage")
  async recover(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("operationId") operationId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    requireOpsAdmin(actor.roles);
    if (!z.string().uuid().safeParse(operationId).success) {
      throw new BadRequestException({message: "operationId must be a UUID"});
    }
    const parsed = parse(recoverySchema, body);
    const granted = productionMutateAuthorized(actor.roles);
    const data = await control(() => this.service.recoverOperation({
      actorUserId: actor.userId,
      ticket: parsed.ticket,
      reason: parsed.reason,
      idempotencyKey: parsed.idempotencyKey,
      expectedEpoch: BigInt(parsed.expectedEpoch),
      operationId,
      writerInstanceId: parsed.writerInstanceId,
      terminationEvidenceDigest: parsed.terminationEvidenceDigest,
      productionMutateAuthorized: granted,
    }));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
