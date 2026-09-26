import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMarketplaceConfidenceGate,
  encodePendingReview,
  decodePendingReview,
} from "../dist/modules/semse-agents/marketplace-confidence-gate.js";
import { resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";

/**
 * Jev Decision Layer — Wave: Marketplace confidence gate.
 * Spec: docs/specs/prometeo/jev-human-review-queue.spec.md
 * Pure logic only — no DB, no LLM, no NestJS DI.
 */

function config(env: Record<string, string> = {}) {
  return resolveDecisionLayerConfig({ ...process.env, ...env } as NodeJS.ProcessEnv);
}

test("MCG.1: gate apagado por defecto → AUTO_PROCEED, no bloquea, sin importar el matchScore", () => {
  const result = evaluateMarketplaceConfidenceGate({ config: config(), tenantId: "tenant_default", matchScore: 10 });
  assert.equal(result.active, false);
  assert.equal(result.action, "AUTO_PROCEED");
  assert.equal(result.shouldBlockDispatch, false);
  assert.equal(result.reasonCode, "GATE_INACTIVE");
});

test("MCG.2: SEMSE_JEV_ENABLED=true pero SEMSE_JEV_MARKETPLACE_GATE_ENABLED sin definir → sigue inactivo", () => {
  const result = evaluateMarketplaceConfidenceGate({
    config: config({ SEMSE_JEV_ENABLED: "true" }),
    tenantId: "tenant_default",
    matchScore: 10,
  });
  assert.equal(result.active, false);
  assert.equal(result.shouldBlockDispatch, false);
});

test("MCG.3: activo pero tenant fuera del canary → no bloquea aunque el score sea bajo", () => {
  const result = evaluateMarketplaceConfidenceGate({
    config: config({
      SEMSE_JEV_ENABLED: "true",
      SEMSE_JEV_MARKETPLACE_GATE_ENABLED: "true",
      SEMSE_JEV_MARKETPLACE_GATE_MODE: "live",
      SEMSE_JEV_CANARY_TENANT_IDS: "tenant_other",
    }),
    tenantId: "tenant_default",
    matchScore: 10,
  });
  assert.equal(result.canary, null);
  assert.equal(result.shouldBlockDispatch, false);
});

test("MCG.4: activo + shadow + score bajo → HUMAN_REVIEW pero NO bloquea (shadow nunca bloquea)", () => {
  const result = evaluateMarketplaceConfidenceGate({
    config: config({ SEMSE_JEV_ENABLED: "true", SEMSE_JEV_MARKETPLACE_GATE_ENABLED: "true" }), // mode default = shadow
    tenantId: "tenant_default",
    matchScore: 40,
  });
  assert.equal(result.active, true);
  assert.equal(result.mode, "shadow");
  assert.equal(result.action, "HUMAN_REVIEW");
  assert.equal(result.reasonCode, "MATCH_SCORE_BELOW_THRESHOLD");
  assert.equal(result.shouldBlockDispatch, false);
});

test("MCG.5: activo + live + score bajo → HUMAN_REVIEW y SÍ bloquea", () => {
  const result = evaluateMarketplaceConfidenceGate({
    config: config({
      SEMSE_JEV_ENABLED: "true",
      SEMSE_JEV_MARKETPLACE_GATE_ENABLED: "true",
      SEMSE_JEV_MARKETPLACE_GATE_MODE: "live",
    }),
    tenantId: "tenant_default",
    matchScore: 40,
  });
  assert.equal(result.action, "HUMAN_REVIEW");
  assert.equal(result.shouldBlockDispatch, true);
});

test("MCG.6: activo + live + score alto → AUTO_PROCEED, nunca bloquea", () => {
  const result = evaluateMarketplaceConfidenceGate({
    config: config({
      SEMSE_JEV_ENABLED: "true",
      SEMSE_JEV_MARKETPLACE_GATE_ENABLED: "true",
      SEMSE_JEV_MARKETPLACE_GATE_MODE: "live",
    }),
    tenantId: "tenant_default",
    matchScore: 85,
  });
  assert.equal(result.action, "AUTO_PROCEED");
  assert.equal(result.reasonCode, "MATCH_SCORE_OK");
  assert.equal(result.shouldBlockDispatch, false);
});

test("MCG.7: encode/decodePendingReview hacen round-trip exacto", () => {
  const input = {
    jobId: "job_1",
    projectId: "job_1",
    originalPayload: { jobId: "job_1", title: "Instalar panel eléctrico" },
    classification: { trade: "electrical", matchScore: 40 },
  };
  const encoded = encodePendingReview(input);
  const decoded = decodePendingReview(encoded);
  assert.deepEqual(decoded, input);
});

test("MCG.8: decodePendingReview devuelve null para strings de otras features (no revienta)", () => {
  assert.equal(decodePendingReview("intent:unknown"), null);
  assert.equal(decodePendingReview("job:abc123"), null);
  assert.equal(decodePendingReview(null), null);
  assert.equal(decodePendingReview(undefined), null);
  assert.equal(decodePendingReview("marketplace_pending_review:v1:{not valid json"), null);
});
