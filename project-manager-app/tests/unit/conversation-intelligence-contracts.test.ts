import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationFactSchema,
  conversationSourceRefSchema,
  intelligenceFindingSchema,
} from "../../packages/schemas/dist/index.js";

// Conversation Intelligence · Wave 0 (CI-002, CI-007): contratos de provenance y "hecho ≠ finding ≠ decisión".

const ref = {
  kind: "communication",
  threadId: "thr_1",
  messageId: "msg_1",
  provider: "WEB_CHAT",
  sequence: 0,
  occurredAt: null,
  contentHash: "sha256:abc",
};

test("SourceRef exige hilo y proveedor, y admite occurredAt/sequence/messageId nulos sin inventarlos", () => {
  assert.equal(conversationSourceRefSchema.safeParse(ref).success, true);
  // referencia a nivel de hilo (sin mensaje) y fuente legacy sin tiempo ni orden
  assert.equal(conversationSourceRefSchema.safeParse({ ...ref, messageId: null, sequence: null, contentHash: null }).success, true);
  assert.equal(conversationSourceRefSchema.safeParse({ ...ref, threadId: "" }).success, false);
  assert.equal(conversationSourceRefSchema.safeParse({ ...ref, provider: "TELEGRAM" }).success, false);
  assert.equal(conversationSourceRefSchema.safeParse({ ...ref, occurredAt: "ayer" }).success, false, "no acepta fechas inventadas o inválidas");
  const { occurredAt: _omit, ...withoutTime } = ref;
  assert.equal(conversationSourceRefSchema.safeParse(withoutTime).success, false, "el campo es obligatorio aunque sea null: la ausencia se declara");
});

test("un hecho es un fragmento literal con su fuente; no admite interpretación", () => {
  assert.equal(conversationFactSchema.safeParse({ kind: "fact", sourceRef: ref, snippet: "quiero planear un trabajo" }).success, true);
  assert.equal(conversationFactSchema.safeParse({ kind: "fact", sourceRef: ref, snippet: "" }).success, false);
  assert.equal(conversationFactSchema.safeParse({ kind: "fact", sourceRef: ref, snippet: "x".repeat(501) }).success, false);
  assert.equal(conversationFactSchema.safeParse({ kind: "fact", sourceRef: ref, snippet: "x", conclusion: "el cliente está molesto" }).success, false);
});

const finding = {
  kind: "finding",
  id: "fnd_1",
  category: "inconsistency",
  summary: "El presupuesto citado difiere entre dos mensajes",
  confidence: 0.7,
  sourceRefs: [ref],
  derived: true,
  authority: "none",
};

test("un finding exige provenance, es derivado y no tiene autoridad", () => {
  assert.equal(intelligenceFindingSchema.safeParse(finding).success, true);
  assert.equal(intelligenceFindingSchema.safeParse({ ...finding, sourceRefs: [] }).success, false, "sin fuente no hay finding");
  assert.equal(intelligenceFindingSchema.safeParse({ ...finding, derived: false }).success, false);
  assert.equal(intelligenceFindingSchema.safeParse({ ...finding, authority: "approve" }).success, false);
  assert.equal(intelligenceFindingSchema.safeParse({ ...finding, confidence: 1.2 }).success, false);
  assert.equal(intelligenceFindingSchema.safeParse({ ...finding, kind: "fact" }).success, false, "un finding no se hace pasar por un hecho");
  assert.equal(intelligenceFindingSchema.safeParse({ ...finding, correlationId: "req_9" }).success, true);
  assert.equal(intelligenceFindingSchema.safeParse({ ...finding, correlationId: "" }).success, false);
});

test("un finding no puede transportar decisión, acción, aprobación ni outcome (la spec: V1 no persiste Decision/Action/Outcome)", () => {
  for (const forbidden of ["decision", "action", "approved", "outcome", "approvalId", "executed"]) {
    const result = intelligenceFindingSchema.safeParse({ ...finding, [forbidden]: "x" });
    assert.equal(result.success, false, `debe rechazar el campo '${forbidden}'`);
  }
  assert.equal(conversationSourceRefSchema.safeParse({ ...ref, decision: "x" }).success, false);
});
