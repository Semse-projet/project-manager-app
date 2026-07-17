import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { Public } from "../../common/public.decorator.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import {DidService, fromDid} from "./did.service.js";

@Controller()
export class DidController {
  constructor(private readonly didService: DidService) {}

  /**
   * Resolve a DID Document by userId.
   * Public — DID Documents are discovery documents, no auth required.
   * tenantId query param allows cross-tenant resolution (defaults to env default).
   */
  @Get("v1/did/:userId")
  @Public()
  async resolveByUserId(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("userId") userId: string,
    @Query("tenantId") tenantId?: string,
  ) {
    const resolvedTenant =
      tenantId ?? process.env.SEMSE_DEFAULT_TENANT_ID ?? "tenant_default";
    const data = await this.didService.resolve(userId, resolvedTenant);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /**
   * Resolve a full DID URI: did:semse:<userId>.
   * Accepts the full DID string and extracts the userId.
   */
  @Get("v1/did")
  @Public()
  async resolveByDid(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("did") did: string,
    @Query("tenantId") tenantId?: string,
  ) {
    const userId = fromDid(did ?? "");
    if (!userId) {
      return ok(resolveRequestId(req.headers ?? {}), {
        error: "invalid_did",
        message: `Cannot resolve: '${did}'. Expected format: did:semse:<userId>`,
      });
    }
    const resolvedTenant =
      tenantId ?? process.env.SEMSE_DEFAULT_TENANT_ID ?? "tenant_default";
    const data = await this.didService.resolve(userId, resolvedTenant);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** Return the DID for the currently authenticated user (self-discovery). */
  @Get("v1/users/me/did")
  @RequirePermissions("users:read")
  async myDid(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.didService.resolve(actor.userId, actor.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
