import test from "node:test";
import assert from "node:assert/strict";
import { MarketplaceAgent } from "../dist/modules/semse-agents/marketplace.agent.js";
import { SemseAgentsService } from "../dist/modules/semse-agents/semse-agents.service.js";
import { encodePendingReview } from "../dist/modules/semse-agents/marketplace-confidence-gate.js";
import { resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";

/**
 * Jev Decision Layer — Wave: Marketplace confidence gate, agent-level tests.
 * Spec: docs/specs/prometeo/jev-human-review-queue.spec.md — P1/P2/P3/P4.
 * Real MarketplaceAgent + real SemseAgentsService (in-memory bus), fake
 * telemetry/prisma. No network, no Postgres.
 */

type RecordedEvent = Record<string, unknown> & { id: string };

class FakeTelemetry {
  events: RecordedEvent[] = [];
  outcomes: Array<{ eventId: string; tenantId: string; outcome: string }> = [];
  async record(event: Record<string, unknown>): Promise<string> {
    const id = `evt_${this.events.length + 1}`;
    this.events.push({ id, ...event });
    return id;
  }
  async recordOutcome(input: { eventId: string; tenantId: string; outcome: string }): Promise<void> {
    this.outcomes.push(input);
  }
}

function fakePrisma(rows: Array<Record<string, unknown>>) {
  return {
    jevDecisionEvent: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
        rows.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null,
      findMany: async ({ where }: { where: { tenantId: string } }) =>
        rows.filter((r) => r.tenantId === where.tenantId && r.outcome == null && r.finalSystemAction === "HUMAN_REVIEW_PENDING"),
    },
  };
}

function makeBusWithSpies() {
  const bus = new SemseAgentsService();
  const dispatched: Array<{ to: string; event: string; payload: unknown }> = [];
  bus.register("protools", async (msg: { to: string; event: string; payload: unknown }) => { dispatched.push(msg); });
  bus.register("buildops", async (msg: { to: string; event: string; payload: unknown }) => { dispatched.push(msg); });
  return { bus, dispatched };
}

function publishedMessage(overrides: Record<string, unknown> = {}) {
  return {
    from: "marketplace" as const,
    to: "marketplace" as const,
    event: "PROJECT_PUBLISHED" as const,
    payload: { jobId: "job_1", tenantId: "tenant_default", description: "arreglar cables pelados", area: 50 },
    projectId: "job_1",
    correlationId: "corr_1",
    timestamp: new Date(),
    ...overrides,
  };
}

test("MAG.P2: modo live + score bajo → NO dispara dispatch, registra evento pendiente", async () => {
  const { bus, dispatched } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const config = resolveDecisionLayerConfig({
    SEMSE_JEV_ENABLED: "true",
    SEMSE_JEV_MARKETPLACE_GATE_ENABLED: "true",
    SEMSE_JEV_MARKETPLACE_GATE_MODE: "live",
  } as NodeJS.ProcessEnv);

  const agent = new MarketplaceAgent(bus, undefined, undefined, undefined, undefined, telemetry, () => config);
  await agent.handleMessage(publishedMessage());

  assert.equal(dispatched.length, 0, "no debe dispatchar ESTIMATE_REQUESTED/PROJECT_PLANNED mientras está pendiente");
  assert.equal(telemetry.events.length, 1);
  assert.equal(telemetry.events[0].finalSystemAction, "HUMAN_REVIEW_PENDING");
  assert.equal(telemetry.events[0].mode, "live");
  assert.ok(String(telemetry.events[0].inputClass).startsWith("marketplace_pending_review:v1:"));
});

test("MAG.P1: modo shadow + score bajo → SÍ dispara dispatch, además registra el evento", async () => {
  const { bus, dispatched } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const config = resolveDecisionLayerConfig({
    SEMSE_JEV_ENABLED: "true",
    SEMSE_JEV_MARKETPLACE_GATE_ENABLED: "true",
    // mode default = shadow
  } as NodeJS.ProcessEnv);

  const agent = new MarketplaceAgent(bus, undefined, undefined, undefined, undefined, telemetry, () => config);
  await agent.handleMessage(publishedMessage());

  assert.equal(dispatched.length, 2, "shadow nunca bloquea: ESTIMATE_REQUESTED + PROJECT_PLANNED se disparan igual");
  assert.equal(telemetry.events.length, 1);
  assert.equal(telemetry.events[0].mode, "shadow");
  assert.equal(telemetry.events[0].finalSystemAction, "AUTO_PROCEED");
});

test("MAG.gate-off: gate desactivado (default) → dispatch normal, sin telemetría", async () => {
  const { bus, dispatched } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const agent = new MarketplaceAgent(bus, undefined, undefined, undefined, undefined, telemetry, () => resolveDecisionLayerConfig({} as NodeJS.ProcessEnv));
  await agent.handleMessage(publishedMessage());

  assert.equal(dispatched.length, 2);
  assert.equal(telemetry.events.length, 0, "sin gate activo no se escribe JevDecisionEvent (cero costo cuando está apagado)");
});

test("MAG.P3: approve sin override → dispatcha con la clasificación original, outcome=user_saved", async () => {
  const { bus, dispatched } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const pendingRow = {
    id: "evt_pending_1",
    tenantId: "tenant_default",
    outcome: null,
    finalSystemAction: "HUMAN_REVIEW_PENDING",
    inputClass: encodePendingReview({
      jobId: "job_1",
      projectId: "job_1",
      originalPayload: { jobId: "job_1", tenantId: "tenant_default" },
      classification: { trade: "electrical", urgency: "medium", complexity: "simple", estimatedHours: 10, suggestedBudgetMin: 500, suggestedBudgetMax: 900, requiredSkills: [], matchScore: 40, reasoningSteps: [] },
    }),
  };
  const prisma = fakePrisma([pendingRow]);
  const agent = new MarketplaceAgent(bus, prisma as never, undefined, undefined, undefined, telemetry);

  const result = await agent.approveReview({ tenantId: "tenant_default", eventId: "evt_pending_1" });

  assert.equal(result.status, "approved");
  if (result.status === "approved") assert.equal(result.outcome, "user_saved");
  assert.equal(dispatched.length, 2, "aprobar reanuda el dispatch retenido");
  assert.equal(telemetry.outcomes.length, 1);
  assert.equal(telemetry.outcomes[0].outcome, "user_saved");
});

test("MAG.P3b: approve CON override (ej. horas corregidas) → outcome=user_corrected, usa el valor corregido", async () => {
  const { bus, dispatched } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const pendingRow = {
    id: "evt_pending_2",
    tenantId: "tenant_default",
    outcome: null,
    finalSystemAction: "HUMAN_REVIEW_PENDING",
    inputClass: encodePendingReview({
      jobId: "job_2",
      projectId: "job_2",
      originalPayload: { jobId: "job_2", tenantId: "tenant_default" },
      classification: { trade: "electrical", urgency: "medium", complexity: "simple", estimatedHours: 25, suggestedBudgetMin: 500, suggestedBudgetMax: 900, requiredSkills: [], matchScore: 40, reasoningSteps: [] },
    }),
  };
  const prisma = fakePrisma([pendingRow]);
  const agent = new MarketplaceAgent(bus, prisma as never, undefined, undefined, undefined, telemetry);

  const result = await agent.approveReview({ tenantId: "tenant_default", eventId: "evt_pending_2", override: { estimatedHours: 15 } });

  assert.equal(result.status, "approved");
  if (result.status === "approved") assert.equal(result.outcome, "user_corrected");
  const estimateMsg = dispatched.find((d) => d.event === "ESTIMATE_REQUESTED") as { payload: { classification: { estimatedHours: number } } } | undefined;
  assert.equal(estimateMsg?.payload.classification.estimatedHours, 15, "el dispatch debe usar las horas corregidas, no las 25 originales");
});

test("MAG.P4: reject → NO dispatcha nada, outcome=rejected", async () => {
  const { bus, dispatched } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const pendingRow = {
    id: "evt_pending_3", tenantId: "tenant_default", outcome: null, finalSystemAction: "HUMAN_REVIEW_PENDING",
    inputClass: encodePendingReview({ jobId: "job_3", projectId: "job_3", originalPayload: {}, classification: {} }),
  };
  const prisma = fakePrisma([pendingRow]);
  const agent = new MarketplaceAgent(bus, prisma as never, undefined, undefined, undefined, telemetry);

  const result = await agent.rejectReview({ tenantId: "tenant_default", eventId: "evt_pending_3", reason: "trade incorrecto" });

  assert.equal(result.status, "rejected");
  assert.equal(dispatched.length, 0);
  assert.equal(telemetry.outcomes[0]?.outcome, "rejected");
});

test("MAG.dup: aprobar un evento ya resuelto es no-op (already_resolved, no re-dispatcha)", async () => {
  const { bus, dispatched } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const pendingRow = {
    id: "evt_resolved", tenantId: "tenant_default", outcome: "user_saved", finalSystemAction: "HUMAN_REVIEW_PENDING",
    inputClass: encodePendingReview({ jobId: "job_4", projectId: "job_4", originalPayload: {}, classification: {} }),
  };
  const prisma = fakePrisma([pendingRow]);
  const agent = new MarketplaceAgent(bus, prisma as never, undefined, undefined, undefined, telemetry);

  const result = await agent.approveReview({ tenantId: "tenant_default", eventId: "evt_resolved" });

  assert.equal(result.status, "already_resolved");
  if (result.status === "already_resolved") assert.equal(result.outcome, "user_saved");
  assert.equal(dispatched.length, 0, "un evento ya resuelto nunca debe re-dispatchar");
});

test("MAG.tenant-isolation: un tenant no puede resolver el evento de otro tenant", async () => {
  const { bus } = makeBusWithSpies();
  const telemetry = new FakeTelemetry();
  const pendingRow = {
    id: "evt_other_tenant", tenantId: "tenant_a", outcome: null, finalSystemAction: "HUMAN_REVIEW_PENDING",
    inputClass: encodePendingReview({ jobId: "job_5", projectId: "job_5", originalPayload: {}, classification: {} }),
  };
  const prisma = fakePrisma([pendingRow]);
  const agent = new MarketplaceAgent(bus, prisma as never, undefined, undefined, undefined, telemetry);

  const result = await agent.approveReview({ tenantId: "tenant_b", eventId: "evt_other_tenant" });
  assert.equal(result.status, "not_found", "el query ya filtra por tenantId — un tenant ajeno no debe encontrar el evento");
});
