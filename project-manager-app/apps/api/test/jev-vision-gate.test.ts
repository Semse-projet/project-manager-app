import test from "node:test";
import assert from "node:assert/strict";
import { CONSTRUCTION_LIBRARY_SEED } from "@semse/schemas";
import { DecisionLayerService } from "../dist/modules/ai-models/decision/decision-layer.service.js";
import { resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";
import { deterministicVisionGate, visionGateInvariant } from "../dist/modules/ai-models/decision/vision-gate.js";
import { VisionLibraryService } from "../dist/modules/vision/vision-library.service.js";

// Sense Vision Decision Gate pilot — spec: docs/specs/prometeo/jev-decision-layer.spec.md §4 (J9, J10).
// Pipeline under test: recognition → library matching → decision gate.

const ROWS = CONSTRUCTION_LIBRARY_SEED.map((item: any) => ({
  ...item,
  id: `cli_${item.slug.replace(/-/g, "_")}`,
  canonicalName: item.nameEn,
  active: true,
}));

const ON = { SEMSE_JEV_ENABLED: "true", SEMSE_JEV_VISION_GATE_ENABLED: "true", SEMSE_JEV_VISION_GATE_MODE: "live" };
const SHADOW = { SEMSE_JEV_ENABLED: "true", SEMSE_JEV_VISION_GATE_ENABLED: "true" };
const actor = { tenantId: "t1", userId: "u1" };
const frame = { kind: "data", imageData: "AAAA", mimeType: "image/jpeg", byteLength: 3 } as const;

function build(opts: { candidates?: unknown; disabled?: boolean; throws?: boolean; env?: Record<string, string> | null; jev?: unknown }) {
  const events: any[] = [];
  const outcomes: any[] = [];
  const repository = {
    async listActiveLibraryItems() { return ROWS; },
    async findLibraryItemById(id: string) { return ROWS.find((r: any) => r.id === id) ?? null; },
    async upsertDictionaryEntry(input: any) {
      const row = ROWS.find((r: any) => r.id === input.libraryItemId);
      const now = new Date();
      return { id: "dict_1", ...input, firstSeenAt: now, lastSeenAt: now, timesViewed: 0, timesScanned: 1, favorite: false, learned: false, notes: null, libraryItem: row };
    },
    async createCorrection(input: any) { return { id: "corr_1", ...input, createdAt: new Date() }; },
  };
  const client = {
    async recognizeObjects() {
      if (opts.throws) throw new Error("down");
      if (opts.disabled) return { disabled: true };
      return { disabled: false, body: { provider: "ollama", model: "qwen2.5vl:3b", candidates: opts.candidates } };
    },
  };
  const decisionLayer = opts.env === null
    ? undefined
    : new DecisionLayerService(
        { name: "fake", async decide() { return { raw: opts.jev, model: "jev-fast" }; } } as any,
        {
          async record(e: any) { events.push(e); return `evt_${events.length}`; },
          async recordOutcome(o: any) { outcomes.push(o); },
        } as any,
        () => resolveDecisionLayerConfig(opts.env ?? {}),
      );
  const service = new VisionLibraryService(repository as any, client as any, { async append() {} } as any, decisionLayer);
  return { service, events, outcomes };
}

const recognized = [{ slug: "emt-coupling", confidence: 0.92 }];
const ambiguous = [
  { slug: "emt-coupling", confidence: 0.67 },
  { slug: "compression-coupling", confidence: 0.55 },
  { slug: "rigid-coupling", confidence: 0.4 },
];

test("flags off: gate is deterministic and mirrors the confidence policy", async () => {
  const cases: Array<[any, string, string]> = [
    [{ candidates: recognized }, "ACCEPT_RESULT", "HIGH_CONFIDENCE_LIBRARY_MATCH"],
    [{ candidates: ambiguous }, "SHOW_ALTERNATIVES", "AMBIGUOUS_VISUAL_MATCH"],
    [{ candidates: [{ slug: "emt-coupling", confidence: 0.6 }] }, "ASK_USER", "MEDIUM_CONFIDENCE_NO_ALTERNATIVES"],
    [{ candidates: [{ slug: "emt-coupling", confidence: 0.3 }] }, "RETRY_SCAN", "LOW_CONFIDENCE_OR_NO_CANDIDATE"],
    [{ candidates: [] }, "RETRY_SCAN", "LOW_CONFIDENCE_OR_NO_CANDIDATE"],
    [{ candidates: [{ label: "Flux capacitor", confidence: 0.95 }] }, "UNKNOWN", "NOT_IN_LIBRARY"],
    [{ candidates: "garbage" }, "ESCALATE_MODEL", "MALFORMED_MODEL_OUTPUT"],
    [{ disabled: true }, "UNKNOWN", "RECOGNITION_UNAVAILABLE"],
    [{ throws: true }, "RETRY_SCAN", "RECOGNITION_ERROR"],
  ];
  for (const [opts, action, reasonCode] of cases) {
    const { service, events } = build({ ...opts });
    const result = await service.recognize(frame, { actor, trade: "electrical" });
    assert.equal(result.gate.action, action, JSON.stringify(opts));
    assert.equal(result.gate.reasonCode, reasonCode);
    assert.equal(result.gate.source, "deterministic");
    assert.equal(events.length, 0, "no telemetry while flags are off");
  }
});

test("gate without an actor (or without the layer) stays deterministic", async () => {
  const { service } = build({ candidates: recognized, env: null });
  assert.equal((await service.recognize(frame)).gate.action, "ACCEPT_RESULT");
});

test("Jev SHOW_ALTERNATIVES on an ambiguous match is used and recorded", async () => {
  const { service, events } = build({ candidates: ambiguous, env: ON, jev: { action: "SHOW_ALTERNATIVES", confidence: 0.91, reasonCode: "AMBIGUOUS_VISUAL_MATCH" } });
  const result = await service.recognize(frame, { actor, trade: "electrical" });
  assert.equal(result.status, "uncertain", "recognition itself is untouched");
  assert.equal(result.object?.slug, "emt-coupling");
  assert.equal(result.gate.action, "SHOW_ALTERNATIVES");
  assert.equal(result.gate.source, "jev");
  assert.equal(result.gate.decisionEventId, "evt_1");
  assert.equal(events[0].feature, "vision_gate");
});

test("Jev may ask for a rescan on a borderline result", async () => {
  const { service } = build({ candidates: ambiguous, env: ON, jev: { action: "RETRY_SCAN", confidence: 0.85, reasonCode: "BLURRY_FRAME" } });
  const result = await service.recognize(frame, { actor });
  assert.equal(result.gate.action, "RETRY_SCAN");
  assert.equal(result.gate.source, "jev");
});

test("Jev can't accept a non-existent object or show missing alternatives (J10)", async () => {
  let built = build({ candidates: [], env: ON, jev: { action: "ACCEPT_RESULT", confidence: 0.99, reasonCode: "LOOKS_FINE" } });
  let result = await built.service.recognize(frame, { actor });
  assert.equal(result.gate.action, "RETRY_SCAN");
  assert.equal(result.gate.source, "deterministic");
  assert.equal(built.events[0].fallbackReason, "invariant_violation");

  built = build({ candidates: recognized, env: ON, jev: { action: "SHOW_ALTERNATIVES", confidence: 0.99, reasonCode: "WANT_ALTS" } });
  result = await built.service.recognize(frame, { actor });
  assert.equal(result.gate.action, "ACCEPT_RESULT");

  built = build({ disabled: true, env: ON, jev: { action: "ACCEPT_RESULT", confidence: 0.99, reasonCode: "LOOKS_FINE" } });
  result = await built.service.recognize(frame, { actor });
  assert.equal(result.gate.action, "UNKNOWN");
});

test("Jev failure modes fall back to the deterministic gate", async () => {
  for (const jev of [undefined, { action: "RELEASE_PAYMENT", confidence: 1, reasonCode: "X_Y" }, { action: "ACCEPT_RESULT", confidence: 0.2, reasonCode: "UNSURE" }]) {
    const { service } = build({ candidates: recognized, env: ON, jev });
    const result = await service.recognize(frame, { actor });
    assert.equal(result.gate.action, "ACCEPT_RESULT");
    assert.equal(result.gate.source, "deterministic");
  }
});

test("user outcomes close the loop: save → user_saved, correction → user_corrected", async () => {
  const { service, outcomes } = build({ candidates: ambiguous, env: ON, jev: { action: "SHOW_ALTERNATIVES", confidence: 0.9, reasonCode: "AMBIGUOUS_VISUAL_MATCH" } });
  const ctx = { tenantId: "t1", orgId: "o1", userId: "u1", requestId: "r1" };
  await service.saveToDictionary(ctx, "cli_emt_coupling", "scan", "evt_1");
  await service.recordCorrection(ctx, {
    predictedLibraryItemId: "cli_emt_coupling",
    selectedLibraryItemId: "cli_compression_coupling",
    predictedConfidence: 0.67,
    source: "ollama",
    decisionEventId: "evt_1",
  });
  assert.deepEqual(outcomes, [
    { eventId: "evt_1", tenantId: "t1", outcome: "user_saved" },
    { eventId: "evt_1", tenantId: "t1", outcome: "user_corrected" },
  ]);
});

test("pure gate helpers", () => {
  const state = { status: "uncertain", candidate: { slug: "a", confidence: 0.6, trades: [] }, alternatives: [] } as any;
  assert.equal(deterministicVisionGate(state).action, "ASK_USER");
  assert.equal(visionGateInvariant(state)({ action: "SHOW_ALTERNATIVES", confidence: 1, reasonCode: "X_Y" }), false);
  assert.equal(visionGateInvariant(state)({ action: "ACCEPT_RESULT", confidence: 1, reasonCode: "X_Y" }), true);
  assert.equal(visionGateInvariant({ ...state, candidate: null })({ action: "ASK_USER", confidence: 1, reasonCode: "X_Y" }), false);
});

test("vision gate defaults to shadow: Jev is recorded, the UI gets the deterministic gate", async () => {
  const { service, events } = build({ candidates: ambiguous, env: SHADOW, jev: { action: "RETRY_SCAN", confidence: 0.9, reasonCode: "BLURRY_FRAME" } });
  const result = await service.recognize(frame, { actor, correlationId: "req_9" });
  assert.equal(result.gate.action, "SHOW_ALTERNATIVES");
  assert.equal(result.gate.source, "deterministic");
  assert.equal(events[0].jevDecision, "RETRY_SCAN");
  assert.equal(events[0].mode, "shadow");
  assert.equal(events[0].correlationId, "req_9");
  assert.equal(events[0].inputClass, "status:uncertain/low_confidence");
});

test("LOW_CONFIDENCE_NOT_CERTAINTY: Jev can't accept an uncertain match", async () => {
  const { service, events } = build({ candidates: ambiguous, env: ON, jev: { action: "ACCEPT_RESULT", confidence: 0.99, reasonCode: "LOOKS_FINE" } });
  const result = await service.recognize(frame, { actor });
  assert.equal(result.gate.action, "SHOW_ALTERNATIVES");
  assert.deepEqual(events[0].invariantsViolated, ["LOW_CONFIDENCE_NOT_CERTAINTY"]);
});
