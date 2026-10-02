import { Body, Controller, Post } from "@nestjs/common";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { ok } from "../../common/api-response.js";
import { EscrowReleaseReconcileService } from "./escrow-release-reconcile.service.js";

/**
 * ADR-041 2b — endpoint INTERNO que dispara el worker (kill switch
 * PAYMENTS_RECONCILE_ENABLED, cada ~15 min). No es publico: exige permiso de
 * operaciones (mismo patron que /v1/admin/liens/check-deadlines). Solo
 * lectura sobre dinero; ver EscrowReleaseReconcileService.
 */
@Controller("v1/admin/payments")
export class EscrowReleaseReconcileController {
  constructor(private readonly service: EscrowReleaseReconcileService) {}

  @Post("release-reconcile/check")
  @RequirePermissions("ops:dashboard:write")
  async check(@Body() body: Record<string, unknown> = {}) {
    const staleMinutes = Number(body?.staleMinutes);
    const staleAfterMs = Number.isFinite(staleMinutes) && staleMinutes >= 1 ? Math.floor(staleMinutes) * 60_000 : undefined;
    const result = await this.service.runCheck({ staleAfterMs });
    return ok("system", result);
  }
}
