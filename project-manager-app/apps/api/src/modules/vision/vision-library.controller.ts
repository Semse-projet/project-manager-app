import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  dictionaryListQuerySchema,
  librarySearchQuerySchema,
  saveDictionaryItemSchema,
  updateDictionaryItemSchema,
  visionCorrectionSchema,
  visionRecognizeInputSchema,
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { resolveFrameMaxBytes, validateVisionInput } from "./vision-frame.js";
import { VisionLibraryService } from "./vision-library.service.js";

type Req_ = { headers?: Record<string, unknown>; authContext?: { tenantId: string; orgId: string; userId: string; roles: string[] } };

function parseWith<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }, value: unknown): T {
  const parsed = schema.safeParse(value ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error);
  return parsed.data as T;
}

// Sense Vision — spec: docs/specs/vision/sense-vision-field-library.spec.md §5.
// Reuses the vision module's existing permissions (vision:read / vision:run);
// no new RBAC entries. The dictionary is always the caller's own ("me" is the
// authenticated context), so no route takes a userId.
@Controller("v1/vision")
@RequirePermissions("vision:read")
export class VisionLibraryController {
  constructor(private readonly service: VisionLibraryService) {}

  @Post("recognize")
  @RequirePermissions("vision:run")
  // Live camera samples ~1 frame / 1.5 s (≈ 40/min); 60/min leaves headroom
  // for retries without letting a runaway client hammer the provider.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async recognize(@Req() req: Req_, @Body() body: unknown) {
    const requestId = resolveRequestId(req.headers ?? {});
    const raw = parseWith(visionRecognizeInputSchema, body);
    const validation = validateVisionInput(raw, resolveFrameMaxBytes());
    if (!validation.ok) {
      throw new BadRequestException({ code: validation.code, message: validation.message });
    }
    const actor = resolveRequestContext(req);
    const result = await this.service.recognize(validation.value, {
      actor: { tenantId: actor.tenantId, userId: actor.userId, roles: actor.roles },
      trade: raw.trade,
      correlationId: requestId,
    });
    return ok(requestId, result);
  }

  @Get("library/search")
  async searchLibrary(@Req() req: Req_, @Query() query: Record<string, unknown>) {
    const requestId = resolveRequestId(req.headers ?? {});
    const input = parseWith(librarySearchQuerySchema, query);
    return ok(requestId, await this.service.searchLibrary(input));
  }

  @Get("library/:idOrSlug")
  async getLibraryItem(@Req() req: Req_, @Param("idOrSlug") idOrSlug: string) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, await this.service.getLibraryItem(idOrSlug));
  }

  @Get("dictionary")
  async listDictionary(@Req() req: Req_, @Query() query: Record<string, unknown>) {
    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    const input = parseWith(dictionaryListQuerySchema, query);
    const result = await this.service.listDictionary(
      { ...actor, requestId },
      {
        q: input.q,
        limit: input.limit,
        favorite: input.favorite === undefined ? undefined : input.favorite === "true",
        learned: input.learned === undefined ? undefined : input.learned === "true",
      },
    );
    return ok(requestId, result);
  }

  @Post("dictionary/:libraryItemId")
  @RequirePermissions("vision:run")
  async saveToDictionary(@Req() req: Req_, @Param("libraryItemId") libraryItemId: string, @Body() body: unknown) {
    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    const input = parseWith(saveDictionaryItemSchema, body);
    return ok(
      requestId,
      await this.service.saveToDictionary({ ...actor, requestId }, libraryItemId, input.source, input.decisionEventId),
    );
  }

  @Patch("dictionary/:libraryItemId")
  @RequirePermissions("vision:run")
  async updateDictionaryEntry(@Req() req: Req_, @Param("libraryItemId") libraryItemId: string, @Body() body: unknown) {
    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    const input = parseWith(updateDictionaryItemSchema, body);
    return ok(requestId, await this.service.updateDictionaryEntry({ ...actor, requestId }, libraryItemId, input));
  }

  @Delete("dictionary/:libraryItemId")
  @RequirePermissions("vision:run")
  async removeFromDictionary(@Req() req: Req_, @Param("libraryItemId") libraryItemId: string) {
    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    return ok(requestId, await this.service.removeFromDictionary({ ...actor, requestId }, libraryItemId));
  }

  @Post("corrections")
  @RequirePermissions("vision:run")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async recordCorrection(@Req() req: Req_, @Body() body: unknown) {
    const requestId = resolveRequestId(req.headers ?? {});
    const actor = resolveRequestContext(req);
    const input = parseWith(visionCorrectionSchema, body);
    return ok(requestId, await this.service.recordCorrection({ ...actor, requestId }, input));
  }
}
