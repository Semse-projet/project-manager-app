import test from "node:test";
import assert from "node:assert/strict";
import { AiModelRouterService } from "../dist/modules/ai-models/router/ai-model-router.service.js";
import type { AiGenerateRequest } from "../dist/modules/ai-models/dto/ai-generate-request.dto.js";

// SPEC-GTW-001 (prometeo.model-gateway-unification), acceptance criterion:
// "Una request con privacyCritical: true o localOnly: true nunca resuelve a
// un provider fuera de PRIVATE, sin importar el taskType." AiModelRouterService
// previously only enforced this for privacyLevel === "local_only" — a
// "sensitive"/"restricted" request fell through to the taskType-based routes
// below, which can select cloud providers (kimi-k2, deepseek-reasoner,
// glm-4) with zero privacy enforcement. Fixed 2026-08-27.

function makeRequest(overrides: Partial<AiGenerateRequest>): AiGenerateRequest {
  return {
    taskType: "construction_contract_analysis",
    input: "some contract text",
    ...overrides,
  } as AiGenerateRequest;
}

test("privacyLevel=local_only routes to ollama-local regardless of taskType", () => {
  const router = new AiModelRouterService();
  const route = router.selectRoute(makeRequest({ privacyLevel: "local_only", taskType: "code_generation" }));
  assert.equal(route.primaryModelSlug, "ollama-local");
  assert.equal(route.fallbackModelSlug, undefined);
});

test("privacyLevel=sensitive routes to ollama-local, never to the cloud provider its taskType would otherwise pick", () => {
  const router = new AiModelRouterService();
  // Without the privacy check, this taskType resolves to kimi-k2 (a cloud provider).
  const unprotected = router.selectRoute(makeRequest({ taskType: "construction_contract_analysis" }));
  assert.notEqual(unprotected.primaryModelSlug, "ollama-local");

  const protectedRoute = router.selectRoute(
    makeRequest({ privacyLevel: "sensitive", taskType: "construction_contract_analysis" }),
  );
  assert.equal(protectedRoute.primaryModelSlug, "ollama-local");
  assert.equal(protectedRoute.fallbackModelSlug, undefined);
});

test("privacyLevel=restricted routes to ollama-local, never to the cloud provider its taskType would otherwise pick", () => {
  const router = new AiModelRouterService();
  const unprotected = router.selectRoute(makeRequest({ taskType: "project_planning" }));
  assert.notEqual(unprotected.primaryModelSlug, "ollama-local");

  const protectedRoute = router.selectRoute(makeRequest({ privacyLevel: "restricted", taskType: "project_planning" }));
  assert.equal(protectedRoute.primaryModelSlug, "ollama-local");
  assert.equal(protectedRoute.fallbackModelSlug, undefined);
});

test("privacyLevel=standard_external / internal / unset still route normally (no behavior change)", () => {
  const router = new AiModelRouterService();
  for (const privacyLevel of ["standard_external", "internal", undefined] as const) {
    const route = router.selectRoute(makeRequest({ privacyLevel, taskType: "construction_contract_analysis" }));
    assert.notEqual(route.primaryModelSlug, "ollama-local");
  }
});

test("forceModelSlug still wins over privacy level (explicit operator override, unchanged behavior)", () => {
  const router = new AiModelRouterService();
  const route = router.selectRoute(
    makeRequest({ privacyLevel: "sensitive", forceModelSlug: "claude-sonnet" }),
  );
  assert.equal(route.primaryModelSlug, "claude-sonnet");
});
