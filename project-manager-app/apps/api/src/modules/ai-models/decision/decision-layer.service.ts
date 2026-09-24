import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { resolveDecisionLayerConfig, isFeatureActive, isTenantInCanary, type DecisionLayerConfig } from "./decision-flags.js";
import {
  DECISION_FEATURE_ACTIONS,
  isDecisionFeature,
  type DecisionActionFor,
  type DecisionFeature,
  type DecisionOutcome,
  type FallbackReason,
  type StructuredDecision,
} from "./decision.types.js";
import { DecisionProviderError, parseProviderDecision, type DecisionProvider } from "./jev.provider.js";

export const DECISION_PROVIDER = Symbol("DECISION_PROVIDER");
export const DECISION_TELEMETRY = Symbol("DECISION_TELEMETRY");
export const DECISION_CONFIG = Symbol("DECISION_CONFIG");

export type DecisionTelemetryEvent = {
  tenantId: string;
  userId?: string;
  feature: DecisionFeature;
  decision: string;
  confidence: number;
  reasonCode: string;
  source: "jev" | "deterministic";
  fallbackUsed: boolean;
  fallbackReason?: FallbackReason;
  latencyMs: number;
  model?: string;
  finalSystemAction: string;
};

export interface DecisionTelemetry {
  /** Returns the stored event id, or null when nothing was stored. */
  record(event: DecisionTelemetryEvent): Promise<string | null>;
  recordOutcome(input: { eventId: string; tenantId: string; outcome: string }): Promise<void>;
}

export type DecideParams<F extends DecisionFeature> = {
  feature: F;
  tenantId: string;
  userId?: string;
  /** Structured, non-sensitive context sent to Jev (never raw images/messages beyond what the feature needs). */
  input: Record<string, unknown>;
  /** SEMSE's existing deterministic decision — used whenever Jev isn't used. */
  fallback: StructuredDecision<DecisionActionFor<F>>;
  /** State invariants a Jev decision must satisfy (e.g. no ACCEPT without an object). */
  isValid?: (decision: StructuredDecision<DecisionActionFor<F>>) => boolean;
  /** Action SEMSE finally executes for this outcome (e.g. shadow mode keeps the deterministic one). */
  finalSystemAction?: (outcome: DecisionOutcome<DecisionActionFor<F>>) => string;
};

/**
 * Jev Decision Layer (spec: docs/specs/prometeo/jev-decision-layer.spec.md).
 *
 * Jev proposes; SEMSE validates; the existing deterministic path is always
 * the fallback. This service only returns data — it has no dependency on
 * payments, escrow, evidence, contracts, auth or RBAC, so a decision can't
 * trigger any of them directly. It must never become a single point of
 * failure: every failure mode resolves to `params.fallback`.
 */
@Injectable()
export class DecisionLayerService {
  private readonly logger = new Logger(DecisionLayerService.name);

  constructor(
    @Inject(DECISION_PROVIDER) private readonly provider: DecisionProvider,
    @Inject(DECISION_TELEMETRY) private readonly telemetry: DecisionTelemetry,
    @Optional() @Inject(DECISION_CONFIG) private readonly configOverride?: () => DecisionLayerConfig,
  ) {}

  private config(): DecisionLayerConfig {
    return this.configOverride ? this.configOverride() : resolveDecisionLayerConfig();
  }

  isActive(feature: DecisionFeature, tenantId?: string): boolean {
    const config = this.config();
    return isFeatureActive(config, feature) && isTenantInCanary(config, tenantId);
  }

  get agentRouterMode() {
    return this.config().agentRouterMode;
  }

  async decide<F extends DecisionFeature>(params: DecideParams<F>): Promise<DecisionOutcome<DecisionActionFor<F>>> {
    // Closed registry: anything else (escrow_release, auth, ...) is a programming error.
    if (!isDecisionFeature(params.feature)) {
      throw new Error(`Decision feature '${String(params.feature)}' is not registered for the decision layer`);
    }
    const config = this.config();
    const startedAt = Date.now();
    const fallbackOutcome = (reason: FallbackReason, proposed?: StructuredDecision<string>, model?: string) => ({
      ...params.fallback,
      source: "deterministic" as const,
      fallbackReason: reason,
      latencyMs: Date.now() - startedAt,
      ...(model ? { model } : {}),
      ...(proposed ? { proposed } : {}),
    });

    if (!isFeatureActive(config, params.feature)) return fallbackOutcome("disabled");
    if (!isTenantInCanary(config, params.tenantId)) return fallbackOutcome("not_in_canary");

    const allowedActions = DECISION_FEATURE_ACTIONS[params.feature] as readonly string[];
    let outcome: DecisionOutcome<DecisionActionFor<F>>;
    try {
      const { raw, model } = await this.provider.decide({ feature: params.feature, allowedActions, input: params.input });
      const parsed = parseProviderDecision(raw, allowedActions) as StructuredDecision<DecisionActionFor<F>> | null;
      if (!parsed) {
        outcome = fallbackOutcome("invalid_response", undefined, model);
      } else if (parsed.confidence < config.minConfidence) {
        outcome = fallbackOutcome("low_confidence", parsed, model);
      } else if (params.isValid && !params.isValid(parsed)) {
        outcome = fallbackOutcome("invariant_violation", parsed, model);
      } else {
        outcome = { ...parsed, source: "jev", latencyMs: Date.now() - startedAt, ...(model ? { model } : {}) };
      }
    } catch (error) {
      const reason: FallbackReason = error instanceof DecisionProviderError ? error.kind : "provider_error";
      outcome = fallbackOutcome(reason);
    }

    const finalSystemAction = params.finalSystemAction ? params.finalSystemAction(outcome) : outcome.action;
    try {
      const eventId = await this.telemetry.record({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: params.feature,
        decision: outcome.proposed?.action ?? outcome.action,
        confidence: outcome.proposed?.confidence ?? outcome.confidence,
        reasonCode: outcome.proposed?.reasonCode ?? outcome.reasonCode,
        source: outcome.source,
        fallbackUsed: outcome.source !== "jev",
        fallbackReason: outcome.fallbackReason,
        latencyMs: outcome.latencyMs,
        model: outcome.model,
        finalSystemAction,
      });
      if (eventId) outcome.eventId = eventId;
    } catch (error) {
      // Observability must never break the request path.
      this.logger.warn(`decision telemetry failed: ${(error as Error)?.message}`);
    }
    return outcome;
  }

  async recordOutcome(input: { eventId: string; tenantId: string; outcome: string }): Promise<void> {
    try {
      await this.telemetry.recordOutcome(input);
    } catch (error) {
      this.logger.warn(`decision outcome telemetry failed: ${(error as Error)?.message}`);
    }
  }
}
