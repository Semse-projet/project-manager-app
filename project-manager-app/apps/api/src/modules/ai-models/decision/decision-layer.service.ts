import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { DecisionCircuitBreaker } from "./decision-circuit-breaker.js";
import { resolveCanary, resolveDecisionLayerConfig, isFeatureActive, type DecisionLayerConfig } from "./decision-flags.js";
import { evaluateInvariants } from "./decision-invariants.js";
import {
  DECISION_FEATURES,
  isDecisionFeature,
  type CanaryVia,
  type DecisionActionFor,
  type DecisionFeature,
  type DecisionMode,
  type DecisionOutcome,
  type FallbackReason,
  type RiskSignals,
  type StructuredDecision,
} from "./decision.types.js";
import { DecisionProviderError, parseProviderDecision, type DecisionProvider } from "./jev.provider.js";

export const DECISION_PROVIDER = Symbol("DECISION_PROVIDER");
export const DECISION_TELEMETRY = Symbol("DECISION_TELEMETRY");
export const DECISION_CONFIG = Symbol("DECISION_CONFIG");

/** JevDecisionEvent (handoff §55) — metadata only, never the raw context. */
export type DecisionTelemetryEvent = {
  tenantId: string;
  userId?: string;
  feature: DecisionFeature;
  /** Final decision SEMSE returned to the caller. */
  decision: string;
  confidence: number;
  reasonCode: string;
  source: "jev" | "deterministic";
  fallbackUsed: boolean;
  fallbackReason?: FallbackReason;
  latencyMs: number;
  model?: string;
  provider: string;
  mode: DecisionMode;
  canary?: CanaryVia;
  deterministicDecision: string;
  jevDecision?: string;
  jevConfidence?: number;
  jevReasonCode?: string;
  agreement?: boolean;
  invariantsViolated?: string[];
  inputClass?: string;
  correlationId?: string;
  costUsd?: number;
  finalSystemAction: string;
};

export interface DecisionTelemetry {
  /** Returns the stored event id, or null when nothing was stored. */
  record(event: DecisionTelemetryEvent): Promise<string | null>;
  recordOutcome(input: { eventId: string; tenantId: string; outcome: string }): Promise<void>;
}

/** DecisionRequest (handoff §34). */
export type DecisionRequest<F extends DecisionFeature> = {
  feature: F;
  actor: { tenantId: string; userId?: string; roles?: readonly string[] };
  /** Structured, non-sensitive context sent to Jev (never raw images or secrets). */
  context: Record<string, unknown>;
  candidates?: unknown[];
  /** SEMSE's existing deterministic decision — the baseline and the fallback. */
  deterministicDecision: StructuredDecision<DecisionActionFor<F>>;
  riskSignals?: RiskSignals;
  correlationId?: string;
  /** Short, non-sensitive classification of the input for telemetry (e.g. "intent:unknown"). */
  inputClass?: string;
  /** Feature-specific state invariants, applied on top of the global registry. */
  isValid?: (decision: StructuredDecision<DecisionActionFor<F>>) => boolean;
  /** Action SEMSE finally executes for this outcome, when it differs from the returned action. */
  finalSystemAction?: (outcome: DecisionOutcome<DecisionActionFor<F>>) => string;
};

const PROVIDER_FAILURES: ReadonlySet<FallbackReason> = new Set(["unavailable", "timeout", "provider_error"]);

/**
 * Jev Decision Layer — the single central decision service
 * (spec: docs/specs/prometeo/jev-decision-layer.spec.md; handoff §34).
 *
 * Flow: flags → canary → circuit breaker → Jev → schema → confidence →
 * invariant registry + feature invariants → mode (shadow returns the
 * deterministic decision) → telemetry. Every failure resolves to the
 * deterministic decision, so Jev is never a single point of failure. This
 * service only returns data — it has no dependency on payments, escrow,
 * evidence, contracts, auth or RBAC.
 */
@Injectable()
export class DecisionLayerService {
  private readonly logger = new Logger(DecisionLayerService.name);
  private readonly breakers = new Map<DecisionFeature, DecisionCircuitBreaker>();

  constructor(
    @Inject(DECISION_PROVIDER) private readonly provider: DecisionProvider,
    @Inject(DECISION_TELEMETRY) private readonly telemetry: DecisionTelemetry,
    @Optional() @Inject(DECISION_CONFIG) private readonly configOverride?: () => DecisionLayerConfig,
  ) {}

  private config(): DecisionLayerConfig {
    return this.configOverride ? this.configOverride() : resolveDecisionLayerConfig();
  }

  private breaker(feature: DecisionFeature): DecisionCircuitBreaker {
    let breaker = this.breakers.get(feature);
    if (!breaker) {
      breaker = new DecisionCircuitBreaker(() => this.config().breaker);
      this.breakers.set(feature, breaker);
    }
    return breaker;
  }

  modeFor(feature: DecisionFeature): DecisionMode {
    return this.config().modes[feature];
  }

  /** @deprecated use modeFor("agent_router"); kept for the router's shadow/assist naming. */
  get agentRouterMode(): "shadow" | "assist" {
    return this.modeFor("agent_router") === "live" ? "assist" : "shadow";
  }

  async decide<F extends DecisionFeature>(request: DecisionRequest<F>): Promise<DecisionOutcome<DecisionActionFor<F>>> {
    // Closed registry: anything else (escrow_release, auth, ...) is a programming error.
    if (!isDecisionFeature(request.feature)) {
      throw new Error(`Decision feature '${String(request.feature)}' is not registered for the decision layer`);
    }
    const config = this.config();
    const feature = request.feature;
    const mode = config.modes[feature];
    const deterministic = request.deterministicDecision;
    const startedAt = Date.now();
    const base = { provider: this.provider.name, mode, shadowMode: mode === "shadow", deterministic };

    const fallback = (reason: FallbackReason, extra: Partial<DecisionOutcome<DecisionActionFor<F>>> = {}) =>
      ({ ...deterministic, ...base, source: "deterministic" as const, fallbackReason: reason, latencyMs: Date.now() - startedAt, ...extra });

    // No Jev involvement at all → no telemetry row (handoff §53: off by default).
    if (!isFeatureActive(config, feature)) return fallback("disabled");
    const canary = resolveCanary(config, feature, request.actor);
    if (!canary) return fallback("not_in_canary");

    const breaker = this.breaker(feature);
    let outcome: DecisionOutcome<DecisionActionFor<F>>;
    if (!breaker.allow()) {
      outcome = fallback("circuit_open", { canary });
    } else {
      const allowedActions = DECISION_FEATURES[feature].actions as readonly string[];
      try {
        const { raw, model, costUsd } = await this.provider.decide({
          feature,
          allowedActions,
          question: DECISION_FEATURES[feature].question as { instructions: string; criteria: Record<string, string> },
          input: request.context,
          candidates: request.candidates,
          riskSignals: request.riskSignals as Record<string, boolean> | undefined,
          correlationId: request.correlationId,
        });
        breaker.recordSuccess();
        const meta = { canary, ...(model ? { model } : {}), ...(costUsd !== undefined ? { costUsd } : {}) };
        const parsed = parseProviderDecision(raw, allowedActions) as StructuredDecision<DecisionActionFor<F>> | null;
        if (!parsed) {
          outcome = fallback("invalid_response", meta);
        } else {
          const agreement = parsed.action === deterministic.action;
          const violated = [
            ...evaluateInvariants({ feature, deterministic, proposed: parsed, riskSignals: request.riskSignals ?? {} }),
            ...(request.isValid && !request.isValid(parsed) ? [`${feature.toUpperCase()}_STATE_INVARIANT`] : []),
          ];
          const compared = { ...meta, jev: parsed, agreement };
          if (parsed.confidence < config.minConfidence) {
            outcome = fallback("low_confidence", compared);
          } else if (violated.length > 0) {
            outcome = fallback("invariant_violation", { ...compared, invariantsViolated: violated });
          } else if (mode === "shadow") {
            // Shadow (handoff §52): Jev is measured, the real action never changes.
            outcome = { ...deterministic, ...base, ...compared, source: "deterministic", latencyMs: Date.now() - startedAt };
          } else {
            outcome = { ...parsed, ...base, ...compared, source: "jev", latencyMs: Date.now() - startedAt };
          }
        }
      } catch (error) {
        const reason: FallbackReason = error instanceof DecisionProviderError ? error.kind : "provider_error";
        if (PROVIDER_FAILURES.has(reason)) breaker.recordFailure();
        outcome = fallback(reason, { canary });
      }
    }

    const finalSystemAction = request.finalSystemAction ? request.finalSystemAction(outcome) : outcome.action;
    try {
      const eventId = await this.telemetry.record({
        tenantId: request.actor.tenantId,
        userId: request.actor.userId,
        feature,
        decision: outcome.action,
        confidence: outcome.confidence,
        reasonCode: outcome.reasonCode,
        source: outcome.source,
        fallbackUsed: outcome.fallbackReason !== undefined,
        fallbackReason: outcome.fallbackReason,
        latencyMs: outcome.latencyMs,
        model: outcome.model,
        provider: outcome.provider,
        mode,
        canary: outcome.canary,
        deterministicDecision: deterministic.action,
        jevDecision: outcome.jev?.action,
        jevConfidence: outcome.jev?.confidence,
        jevReasonCode: outcome.jev?.reasonCode,
        agreement: outcome.agreement,
        invariantsViolated: outcome.invariantsViolated,
        inputClass: request.inputClass,
        correlationId: request.correlationId,
        costUsd: outcome.costUsd,
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
