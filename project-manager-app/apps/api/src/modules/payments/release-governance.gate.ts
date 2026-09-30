import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { WaiverPaymentGateService } from "../liens/waiver-payment-gate.service.js";
import { PaymentGovernanceService, type PaymentGovernanceActor } from "./payment-governance.service.js";

/**
 * ADR-041 / spec payments.escrow-release-command — one economic authorization
 * for every release entrypoint (C27/C28).
 *
 * Until now only the auto-release path (EscrowReleaseService) ran
 * PaymentGovernanceService.evaluate() (evidence, disputes, change orders,
 * critical signals, lien waivers); the manual/agent path
 * (PaymentsService.release: REST, copilot harness, Prometeo tool) did not, so
 * the same money had two rule sets. This gate is the shared authorization.
 *
 * Rollout (canary, rollback = env var, no deploy of old code needed):
 *  - Lien-waiver gate: enforced by default. PAYMENTS_RELEASE_WAIVER_GATE=off disables it.
 *  - Full governance evaluate(): PAYMENTS_RELEASE_GOVERNANCE_MODE =
 *      "shadow" (default) — evaluate and log what WOULD be blocked, never block;
 *      "enforce"          — block on any blocker, fail closed if evaluate() errors;
 *      "off"              — skip.
 */
export type ReleaseGovernanceMode = "off" | "shadow" | "enforce";

export function resolveReleaseGovernanceMode(env: NodeJS.ProcessEnv): ReleaseGovernanceMode {
  const raw = env.PAYMENTS_RELEASE_GOVERNANCE_MODE?.trim().toLowerCase();
  return raw === "off" || raw === "enforce" ? raw : "shadow";
}

export function isWaiverGateEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.PAYMENTS_RELEASE_WAIVER_GATE?.trim().toLowerCase() !== "off";
}

export type ReleaseGateInput = {
  actor: PaymentGovernanceActor;
  milestoneId: string;
  projectId: string;
  amount: number;
  /** Which entrypoint is releasing; only used for observability. */
  source: "manual" | "agent" | "auto";
};

@Injectable()
export class ReleaseGovernanceGate {
  private readonly logger = new Logger(ReleaseGovernanceGate.name);

  constructor(
    private readonly governance: PaymentGovernanceService,
    private readonly waiverGate: WaiverPaymentGateService,
  ) {}

  /** Throws ConflictException when the release must not proceed. */
  async assertReleasable(input: ReleaseGateInput, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (isWaiverGateEnabled(env)) {
      const waiver = await this.waiverGate.authorizeRelease(input.projectId, input.amount);
      if (!waiver.approved) {
        throw new ConflictException(waiver.reason ?? "escrow release is blocked: lien waiver requirements not met");
      }
    }

    const mode = resolveReleaseGovernanceMode(env);
    if (mode === "off") return;

    if (mode === "enforce") {
      const result = await this.governance.evaluate(input.milestoneId, input.actor.tenantId, input.actor);
      if (!result.canRelease) {
        throw new ConflictException({
          message: "escrow release is blocked by payment governance",
          blockers: result.blockers,
        });
      }
      return;
    }

    // shadow: observe only, never affect the release.
    try {
      const result = await this.governance.evaluate(input.milestoneId, input.actor.tenantId, input.actor);
      if (!result.canRelease) {
        this.logger.warn(
          JSON.stringify({
            event: "release_governance_shadow_would_block",
            source: input.source,
            milestoneId: input.milestoneId,
            tenantId: input.actor.tenantId,
            blockers: result.blockers,
          }),
        );
      }
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "release_governance_shadow_error",
          source: input.source,
          milestoneId: input.milestoneId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
