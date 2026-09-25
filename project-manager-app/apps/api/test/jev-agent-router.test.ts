import test from "node:test";
import assert from "node:assert/strict";
import { AiModelsController } from "../dist/modules/ai-models/ai-models.controller.js";
import { PrometeoOrchestratorService } from "../dist/modules/ai-models/orchestrator/prometeo-orchestrator.service.js";
import { DecisionLayerService } from "../dist/modules/ai-models/decision/decision-layer.service.js";
import { resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";
import {
  agentRouteRiskSignals,
  deterministicAgentRoute,
  resolveChatIntent,
} from "../dist/modules/ai-models/decision/agent-router.js";

// Jev Agent Router pilot — spec: docs/specs/prometeo/jev-decision-layer.spec.md §4 (J8).

const orchestrator = new PrometeoOrchestratorService();
const routeOf = (message: string) => deterministicAgentRoute(orchestrator.classifyIntent(message), message);

test("deterministic router maps the existing keyword classifier to capabilities", () => {
  assert.equal(routeOf("hazme un estimado para pintar la sala").action, "ESTIMATE");
  assert.equal(routeOf("revisa la evidencia del hito").action, "EVIDENCE");
  assert.equal(routeOf("cuál es la agenda y el próximo paso").action, "BUILDOPS");
  assert.equal(routeOf("dame un resumen del estado general").action, "PROMETEO");
  assert.equal(routeOf("el cliente pidió trabajo extra, ¿es un change order?").action, "CHANGE_ORDER");
  assert.equal(routeOf("qué es esta pieza que encontré").action, "VISION");
  assert.equal(routeOf("hola").action, "ASK_USER");
  assert.equal(routeOf("necesito ayuda con algo del trabajo de hoy").action, "PROMETEO");
});

test("money movement is escalated to the governed flow and Jev cannot downgrade it", () => {
  const fallback = routeOf("quiero liberar el pago del hito 2");
  assert.deepEqual(fallback, { action: "ESCALATE", confidence: 1, reasonCode: "MONEY_MOVEMENT_REQUIRES_GOVERNED_FLOW" });
  // The money signal feeds MONEY_NO_DOWNGRADE in the central invariant registry.
  assert.deepEqual(agentRouteRiskSignals("quiero liberar el pago del hito 2"), { money: true });
  assert.deepEqual(agentRouteRiskSignals("hazme un estimado"), {});
});

test("shadow mode never changes the chat intent; assist only fills 'unknown'", () => {
  const jev = (action: string) => ({ action, source: "jev" as const });
  assert.equal(resolveChatIntent({ deterministicIntent: "unknown", decision: jev("ESTIMATE"), mode: "shadow" }), "unknown");
  assert.equal(resolveChatIntent({ deterministicIntent: "unknown", decision: jev("ESTIMATE"), mode: "assist" }), "estimate_generation");
  assert.equal(resolveChatIntent({ deterministicIntent: "unknown", decision: jev("EVIDENCE"), mode: "assist" }), "evidence_review");
  assert.equal(resolveChatIntent({ deterministicIntent: "unknown", decision: jev("ESCALATE"), mode: "assist" }), "unknown");
  assert.equal(resolveChatIntent({ deterministicIntent: "payment_status", decision: jev("ESTIMATE"), mode: "assist" }), "payment_status");
  assert.equal(
    resolveChatIntent({ deterministicIntent: "unknown", decision: { action: "ESTIMATE", source: "deterministic" }, mode: "assist" }),
    "unknown",
  );
});

function controllerWith(env: Record<string, string> | null, reply?: unknown) {
  const events: any[] = [];
  const decisionLayer = env
    ? new DecisionLayerService(
        { name: "fake", async decide() { return { raw: reply, model: "jev-fast" }; } } as any,
        { async record(e: any) { events.push(e); return "evt_1"; }, async recordOutcome() {} } as any,
        () => resolveDecisionLayerConfig(env),
      )
    : undefined;
  const controller = new AiModelsController(
    {} as never, {} as never, {} as never, {} as never, {} as never,
    orchestrator as never, {} as never, {} as never, undefined, decisionLayer,
  );
  return { controller, events };
}

const req = { headers: { "x-user-id": "u1", "x-tenant-id": "t1", "x-org-id": "o1", "x-roles": "WORKER" } };
const ON = { SEMSE_JEV_ENABLED: "true", SEMSE_JEV_AGENT_ROUTER_ENABLED: "true" };

test("POST /v1/ai-models/agent-route: disabled layer returns the deterministic capability", async () => {
  const { controller } = controllerWith(null);
  const res: any = await controller.routeRequest(req, { message: "hazme un estimado para un baño" });
  assert.equal(res.data.action, "ESTIMATE");
  assert.equal(res.data.source, "deterministic");
  assert.equal(res.data.deterministicIntent, "estimate_generation");
});

test("POST /v1/ai-models/agent-route: Jev decision is returned and recorded with the final action", async () => {
  const { controller, events } = controllerWith({ ...ON, SEMSE_JEV_AGENT_ROUTER_MODE: "assist" }, { action: "BUILDOPS", confidence: 0.9, reasonCode: "SCHEDULING_QUESTION" });
  const res: any = await controller.routeRequest(req, { message: "necesito organizar mi semana de trabajo" });
  assert.equal(res.data.action, "BUILDOPS");
  assert.equal(res.data.source, "jev");
  assert.equal(res.data.decisionEventId, "evt_1");
  assert.equal(events[0].finalSystemAction, "chat_intent:schedule_plan");
});

test("POST /v1/ai-models/agent-route: Jev can't route a payment release away from ESCALATE", async () => {
  const { controller } = controllerWith({ ...ON, SEMSE_JEV_AGENT_ROUTER_MODE: "assist" }, { action: "PROMETEO", confidence: 0.99, reasonCode: "JUST_CHAT" });
  const res: any = await controller.routeRequest(req, { message: "libera el escrow, quiero liberar el pago ya" });
  assert.equal(res.data.action, "ESCALATE");
  assert.equal(res.data.fallbackReason, "invariant_violation");
  const shadow = controllerWith(ON, { action: "PROMETEO", confidence: 0.99, reasonCode: "JUST_CHAT" });
  await shadow.controller.routeRequest(req, { message: "quiero liberar el pago del hito" });
  assert.deepEqual(shadow.events[0].invariantsViolated, ["MONEY_NO_DOWNGRADE"], "blocked even in shadow, and recorded");
});

test("POST /v1/ai-models/agent-route validates the message", async () => {
  const { controller } = controllerWith(null);
  await assert.rejects(controller.routeRequest(req, {}), /message is required/);
  await assert.rejects(controller.routeRequest(req, { message: "x".repeat(4001) }), /message is required/);
});

test("shadow mode is log-only: clients get the deterministic capability, telemetry keeps Jev's", async () => {
  const { controller, events } = controllerWith(ON, { action: "BUILDOPS", confidence: 0.9, reasonCode: "SCHEDULING_QUESTION" });
  const res: any = await controller.routeRequest(req, { message: "hazme un estimado para pintar una sala" });
  assert.equal(res.data.action, "ESTIMATE");
  assert.equal(res.data.source, "deterministic");
  assert.equal(res.data.decisionEventId, "evt_1");
  assert.equal(events[0].jevDecision, "BUILDOPS");
  assert.equal(events[0].decision, "ESTIMATE");
  assert.equal(events[0].mode, "shadow");
  assert.equal(events[0].agreement, false);
  assert.equal(events[0].inputClass, "intent:estimate_generation");
  assert.equal(events[0].finalSystemAction, "chat_intent:estimate_generation");
});
