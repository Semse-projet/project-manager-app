import test from "node:test";
import assert from "node:assert/strict";
import { buildAiMissionDiagnostics, buildAiMissionIncident } from "../apps/web/lib/ai-mission-diagnostics.ts";

function healthyReadiness() {
  return {
    llmOrchestrator: {
      hasProvider: true,
      providers: ["anthropic", "openai", "template"],
    },
    environment: {
      anthropicConfigured: true,
      openaiConfigured: true,
      deepseekConfigured: false,
      kimiConfigured: false,
      openSourceEnabled: false,
    },
    models: [
      { slug: "claude-sonnet", provider: "anthropic", enabled: true },
      { slug: "gpt-4", provider: "openai", enabled: true },
    ],
    routeSamples: [
      { taskType: "risk_analysis", route: { primaryModelSlug: "claude-sonnet", fallbackModelSlug: "gpt-4" } },
      { taskType: "construction_contract_analysis", route: { primaryModelSlug: "claude-sonnet", fallbackModelSlug: "gpt-4" } },
      { taskType: "architecture_review", route: { primaryModelSlug: "claude-sonnet", fallbackModelSlug: "gpt-4" } },
    ],
  };
}

test("diagnostics are critical when no provider is configured or active", () => {
  const diagnostics = buildAiMissionDiagnostics({
    stats: { total: 0, success: 0, failureRate: 0, byMode: {} },
    logs: [],
    readiness: {
      llmOrchestrator: { hasProvider: false, providers: ["template"] },
      environment: {
        anthropicConfigured: false,
        openaiConfigured: false,
        deepseekConfigured: false,
        kimiConfigured: false,
        openSourceEnabled: false,
      },
      models: [],
      routeSamples: [],
    },
    context: { mode: "local" },
    liveHealth: { api: "ok", worker: "ok", redis: "ok" },
  });

  assert.equal(diagnostics.posture, "critical");
  assert.ok(diagnostics.alerts.some((alert) => alert.id === "runtime-provider-missing"));
  assert.ok(diagnostics.alerts.some((alert) => alert.id === "provider-config-missing"));
});

test("diagnostics go to watch when context_only dominates", () => {
  const now = new Date().toISOString();
  const diagnostics = buildAiMissionDiagnostics({
    stats: { total: 8, success: 8, failureRate: 0, byMode: { context_only: 6, runtime: 2 } },
    logs: [
      { createdAt: now, mode: "context_only", success: true, fallbackUsed: false },
      { createdAt: now, mode: "context_only", success: true, fallbackUsed: false },
      { createdAt: now, mode: "context_only", success: true, fallbackUsed: false },
      { createdAt: now, mode: "context_only", success: true, fallbackUsed: false },
      { createdAt: now, mode: "context_only", success: true, fallbackUsed: false },
      { createdAt: now, mode: "context_only", success: true, fallbackUsed: false },
      { createdAt: now, mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: now, mode: "runtime", success: true, fallbackUsed: false },
    ],
    readiness: healthyReadiness(),
    context: { mode: "local" },
    liveHealth: { api: "ok", worker: "ok", redis: "ok" },
  });

  assert.equal(diagnostics.posture, "watch");
  assert.ok(diagnostics.alerts.some((alert) => alert.id === "context-only-dominant"));
});

test("diagnostics stay stable on healthy runtime posture", () => {
  const now = new Date().toISOString();
  const diagnostics = buildAiMissionDiagnostics({
    stats: { total: 6, success: 6, failureRate: 0, byMode: { runtime: 4, report: 2 } },
    logs: [
      { createdAt: now, mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: now, mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: now, mode: "report", success: true, fallbackUsed: false },
      { createdAt: now, mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: now, mode: "report", success: true, fallbackUsed: false },
      { createdAt: now, mode: "runtime", success: true, fallbackUsed: false },
    ],
    readiness: healthyReadiness(),
    context: { mode: "local" },
    liveHealth: { api: "ok", worker: "ok", redis: "ok" },
  });

  assert.equal(diagnostics.posture, "stable");
  assert.equal(diagnostics.alerts.length, 0);
});

test("incident appears when posture worsens", () => {
  const previous = buildAiMissionDiagnostics({
    stats: { total: 6, success: 6, failureRate: 0, byMode: { runtime: 4, report: 2 } },
    logs: [],
    readiness: healthyReadiness(),
    context: { mode: "local" },
    liveHealth: { api: "ok", worker: "ok", redis: "ok" },
  });
  const current = buildAiMissionDiagnostics({
    stats: { total: 6, success: 6, failureRate: 0, byMode: { runtime: 4, report: 2 } },
    logs: [],
    readiness: healthyReadiness(),
    context: { mode: "local" },
    liveHealth: { api: "down", worker: "ok", redis: "ok" },
  });

  const incident = buildAiMissionIncident({
    previous,
    current,
    source: "health-stream",
    now: "2026-05-01T00:00:00.000Z",
  });

  assert.ok(incident);
  assert.equal(incident?.severity, "critical");
  assert.equal(incident?.source, "health-stream");
});

test("incident appears when new high alert is introduced even without posture jump", () => {
  const previous = buildAiMissionDiagnostics({
    stats: { total: 10, success: 8, failureRate: 0.2, byMode: { runtime: 8, fallback: 2 } },
    logs: [
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "fallback", success: true, fallbackUsed: true },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
    ],
    readiness: healthyReadiness(),
    context: { mode: "local" },
    liveHealth: { api: "ok", worker: "ok", redis: "ok" },
  });
  const current = buildAiMissionDiagnostics({
    stats: { total: 10, success: 8, failureRate: 0.2, byMode: { runtime: 7, fallback: 3 } },
    logs: [
      { createdAt: new Date().toISOString(), mode: "fallback", success: true, fallbackUsed: true },
      { createdAt: new Date().toISOString(), mode: "fallback", success: true, fallbackUsed: true },
      { createdAt: new Date().toISOString(), mode: "fallback", success: true, fallbackUsed: true },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
      { createdAt: new Date().toISOString(), mode: "runtime", success: true, fallbackUsed: false },
    ],
    readiness: healthyReadiness(),
    context: { mode: "local" },
    liveHealth: { api: "ok", worker: "ok", redis: "ok" },
  });

  const incident = buildAiMissionIncident({
    previous,
    current,
    source: "poll",
    now: "2026-05-01T00:00:00.000Z",
  });

  assert.ok(incident);
  assert.match(incident?.title ?? "", /alto impacto/i);
});
