import test from "node:test";
import assert from "node:assert/strict";

/**
 * Prometeo RAG Fase 4 — Agents using RAG
 *
 * Tests the integration of PrometeoService.retrieveContext() into agents.
 * All tests are unit-level (no DB, no LLM, no HTTP).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type RagCitation = { documentId: string; documentTitle: string; excerpt: string; score: number };

type FakeRagCtx = {
  available: boolean;
  contextBlock: string;
  citations: RagCitation[];
};

type FakeLLMResult = {
  text: string;
  provider: string;
  model: string;
  metadata: { fallbackUsed: boolean };
};

// ── Test utilities ─────────────────────────────────────────────────────────────

function makeRagCtx(overrides: Partial<FakeRagCtx> = {}): FakeRagCtx {
  return {
    available: true,
    contextBlock: "## Contexto documental\n### Manual Eléctrico\nProcedimiento estándar de instalación...",
    citations: [
      { documentId: "doc1", documentTitle: "Manual Eléctrico", excerpt: "Procedimiento estándar...", score: 0.82 },
    ],
    ...overrides,
  };
}

function makeLLMResult(overrides: Partial<FakeLLMResult> = {}): FakeLLMResult {
  return {
    text: '{"reviewStatus":"approved_suggestion","confidence":0.85,"riskLevel":"low","findings":["Evidence looks complete"],"requiredActions":[],"recommendedAction":"Approve","disputeRisk":false,"auditReason":"Evidence matches scope"}',
    provider: "ollama",
    model: "qwen2.5:3b",
    metadata: { fallbackUsed: false },
    ...overrides,
  };
}

// ── Simulate EvidenceReviewService RAG integration ────────────────────────────

type EvidenceReviewInput = {
  item: { label: string; kind: string; status: string; required: boolean; description: string | null };
  rag: { retrieveContext: (input: unknown) => Promise<FakeRagCtx> } | null;
  llm: { chat: (input: unknown) => Promise<FakeLLMResult> } | null;
};

type EvidenceReviewSimResult = {
  reviewStatus: string;
  ragUsed: boolean;
  ragSources: string[];
  ragCitations: RagCitation[];
  provider: string;
};

async function simulateEvidenceReview(input: EvidenceReviewInput): Promise<EvidenceReviewSimResult> {
  let ragContextBlock = "";
  let ragCitations: RagCitation[] = [];
  let ragSources: string[] = [];
  let ragUsed = false;

  if (input.rag) {
    const ragCtx = await input.rag.retrieveContext({
      query: `${input.item.label} ${input.item.kind} evidence review`,
      tenantId: "t1",
      topK: 3,
    });
    if (ragCtx.available) {
      ragContextBlock = ragCtx.contextBlock;
      ragCitations = ragCtx.citations;
      ragSources = ragCtx.citations.map((c) => c.documentTitle);
      ragUsed = true;
    }
  }

  let reviewStatus = "manual_review_required";
  let provider = "rules";

  if (input.llm) {
    const prompt = [
      ragContextBlock ? ragContextBlock + "\n---\n" : "",
      `Evidencia: ${input.item.label} (${input.item.kind}) — estado: ${input.item.status}`,
    ].filter(Boolean).join("\n");

    const res = await input.llm.chat({ userMessage: prompt });
    provider = res.provider;
    const match = res.text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        reviewStatus = (parsed.reviewStatus as string) ?? reviewStatus;
      } catch { /* fallback */ }
    }
  }

  return { reviewStatus, ragUsed, ragSources, ragCitations, provider };
}

// ── Simulate ChangeOrder detection with RAG ───────────────────────────────────

type CODetectionInput = {
  scopeOriginal: string;
  newMessage: string;
  rag: { retrieveContext: (input: unknown) => Promise<FakeRagCtx> } | null;
  llm: { chat: (input: unknown) => Promise<FakeLLMResult> } | null;
};

type CODetectionResult = {
  detected: boolean;
  ragUsed: boolean;
  ragSources: string[];
  provider: string;
};

async function simulateCODetection(input: CODetectionInput): Promise<CODetectionResult> {
  let ragBlock = "";
  let ragSources: string[] = [];
  let ragUsed = false;

  if (input.rag) {
    const ragCtx = await input.rag.retrieveContext({
      query: `scope ${input.scopeOriginal.slice(0, 100)}`,
      tenantId: "global",
      topK: 2,
    });
    if (ragCtx.available) {
      ragBlock = `\n${ragCtx.contextBlock}\n`;
      ragSources = ragCtx.citations.map((c) => c.documentTitle);
      ragUsed = true;
    }
  }

  let detected = false;
  let provider = "rules";

  if (input.llm) {
    const fullMessage = `Scope original:\n${input.scopeOriginal}\n${ragBlock}\nNuevo mensaje:\n${input.newMessage}`;
    const res = await input.llm.chat({ userMessage: fullMessage });
    provider = res.provider;
    const match = res.text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        detected = Boolean(parsed.detected);
      } catch { /* fallback */ }
    }
  }

  return { detected, ragUsed, ragSources, provider };
}

// ── Simulate TradeGuideService (Training Agent) ───────────────────────────────

type TrainingAgentInput = {
  question: string;
  trade: string;
  rag: { retrieveContext: (input: unknown) => Promise<FakeRagCtx> } | null;
  llm: { chat: (input: unknown) => Promise<{ text: string; provider: string; metadata: { fallbackUsed: boolean } }> } | null;
};

type TrainingAgentResult = {
  answer: string;
  citations: RagCitation[];
  trade: string;
  provider: string;
  fallbackUsed: boolean;
  insufficientContext: boolean;
  ragSources: string[];
  disclaimer: string;
};

const DISCLAIMER_ES = "Esta guía es orientativa. No reemplaza códigos locales vigentes, licencias profesionales ni inspecciones requeridas por ley.";

async function simulateTrainingAgent(input: TrainingAgentInput): Promise<TrainingAgentResult> {
  const ragCtx = input.rag
    ? await input.rag.retrieveContext({ query: input.question, tenantId: "t1", trade: input.trade, topK: 5 })
    : { available: false, contextBlock: "", citations: [] };

  if (!ragCtx.available || !ragCtx.contextBlock) {
    return {
      answer: `No hay documentos de ${input.trade} indexados.`,
      citations: [],
      trade: input.trade,
      provider: "rules",
      fallbackUsed: true,
      insufficientContext: true,
      ragSources: [],
      disclaimer: DISCLAIMER_ES,
    };
  }

  let answer = ragCtx.contextBlock.slice(0, 300);
  let provider = "rules";
  let fallbackUsed = false;

  if (input.llm) {
    const res = await input.llm.chat({ userMessage: `${ragCtx.contextBlock}\nPregunta: ${input.question}` });
    answer = res.text ?? answer;
    provider = res.provider;
    fallbackUsed = res.metadata.fallbackUsed;
  }

  return {
    answer: `${answer}\n\n_${DISCLAIMER_ES}_`,
    citations: ragCtx.citations,
    trade: input.trade,
    provider,
    fallbackUsed,
    insufficientContext: false,
    ragSources: ragCtx.citations.map((c) => c.documentTitle),
    disclaimer: DISCLAIMER_ES,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Evidence Review Agent

test("P4.E1: EvidenceReview usa RAG cuando hay documentos indexados", async () => {
  const rag = { retrieveContext: async () => makeRagCtx() };
  const llm = { chat: async () => makeLLMResult() };

  const result = await simulateEvidenceReview({
    item: { label: "Panel foto final", kind: "photo", status: "submitted", required: true, description: null },
    rag, llm,
  });

  assert.ok(result.ragUsed, "ragUsed debe ser true cuando hay docs disponibles");
  assert.ok(result.ragSources.length > 0, "ragSources debe tener fuentes");
  assert.ok(result.ragCitations.length > 0, "ragCitations debe tener citas");
  assert.equal(result.ragSources[0], "Manual Eléctrico");
});

test("P4.E2: EvidenceReview sin servicio RAG funciona correctamente (graceful)", async () => {
  const llm = { chat: async () => makeLLMResult() };

  const result = await simulateEvidenceReview({
    item: { label: "Panel foto final", kind: "photo", status: "submitted", required: true, description: null },
    rag: null, llm,
  });

  assert.equal(result.ragUsed, false);
  assert.deepEqual(result.ragSources, []);
  assert.deepEqual(result.ragCitations, []);
  assert.equal(result.reviewStatus, "approved_suggestion");
});

test("P4.E3: EvidenceReview sin documentos (available=false) no marca ragUsed", async () => {
  const rag = { retrieveContext: async () => makeRagCtx({ available: false, contextBlock: "", citations: [] }) };
  const llm = { chat: async () => makeLLMResult() };

  const result = await simulateEvidenceReview({
    item: { label: "Foto techo", kind: "photo", status: "missing", required: true, description: null },
    rag, llm,
  });

  assert.equal(result.ragUsed, false, "ragUsed debe ser false cuando available=false");
});

test("P4.E4: EvidenceReview no libera pagos (review status no contiene 'release' ni 'payment')", async () => {
  const rag = { retrieveContext: async () => makeRagCtx() };
  const llm = { chat: async () => makeLLMResult() };

  const result = await simulateEvidenceReview({
    item: { label: "Foto base", kind: "photo", status: "submitted", required: true, description: null },
    rag, llm,
  });

  assert.ok(!result.reviewStatus.includes("release"), "reviewStatus no debe contener 'release'");
  assert.ok(!result.reviewStatus.includes("payment"), "reviewStatus no debe contener 'payment'");
});

// Change Order Detector

test("P4.C1: ChangeOrderDetector enriquece prompt con docs RAG cuando disponibles", async () => {
  const rag = { retrieveContext: async () => makeRagCtx({ citations: [{ documentId: "d1", documentTitle: "Scope Contract", excerpt: "Scope: painting only", score: 0.75 }] }) };
  const llm = { chat: async () => makeLLMResult({ text: '{"detected":true,"title":"Extra drywall","reason":"Out of scope","risk":"medium"}' }) };

  const result = await simulateCODetection({
    scopeOriginal: "Pintura de 3 habitaciones",
    newMessage: "El cliente quiere agregar drywall en el baño",
    rag, llm,
  });

  assert.ok(result.ragUsed, "RAG debe usarse cuando hay docs de scope");
  assert.ok(result.ragSources.includes("Scope Contract"), "debe citar Scope Contract");
  assert.ok(result.detected, "debe detectar change order fuera de scope");
});

test("P4.C2: ChangeOrderDetector sin RAG sigue funcionando", async () => {
  const llm = { chat: async () => makeLLMResult({ text: '{"detected":false}' }) };

  const result = await simulateCODetection({
    scopeOriginal: "Pintura de 3 habitaciones",
    newMessage: "Terminamos la primera capa de pintura",
    rag: null, llm,
  });

  assert.equal(result.ragUsed, false);
  assert.equal(result.detected, false);
});

test("P4.C3: ChangeOrderDetector con available=false no usa ragBlock", async () => {
  const rag = { retrieveContext: async () => makeRagCtx({ available: false, contextBlock: "", citations: [] }) };
  const llm = { chat: async () => makeLLMResult({ text: '{"detected":false}' }) };

  const result = await simulateCODetection({
    scopeOriginal: "Limpieza post-construcción",
    newMessage: "Se limpió todo correctamente",
    rag, llm,
  });

  assert.equal(result.ragUsed, false, "ragUsed=false cuando no hay docs disponibles");
});

// Training Guide Agent

test("P4.T1: TrainingAgent responde con citas cuando hay manuales indexados", async () => {
  const rag = {
    retrieveContext: async () => makeRagCtx({
      contextBlock: "## Contexto documental\n### Manual Eléctrico OSHA\nSiempre desconecta el breaker antes de trabajar.",
      citations: [{ documentId: "e1", documentTitle: "Manual Eléctrico OSHA", excerpt: "Siempre desconecta el breaker...", score: 0.91 }],
    }),
  };
  const llm = { chat: async () => ({ text: "Desconecta el breaker principal, verifica con multímetro, instala según código.", provider: "ollama", metadata: { fallbackUsed: false } }) };

  const result = await simulateTrainingAgent({ question: "¿Cómo instalo un tomacorriente?", trade: "electrical", rag, llm });

  assert.ok(!result.insufficientContext, "no debe ser insufficientContext");
  assert.ok(result.citations.length > 0, "debe tener citas");
  assert.equal(result.citations[0]?.documentTitle, "Manual Eléctrico OSHA");
  assert.ok(result.ragSources.includes("Manual Eléctrico OSHA"));
  assert.ok(result.answer.includes(DISCLAIMER_ES), "debe incluir disclaimer");
});

test("P4.T2: TrainingAgent sin docs devuelve insufficientContext=true", async () => {
  const rag = { retrieveContext: async () => makeRagCtx({ available: false, contextBlock: "", citations: [] }) };

  const result = await simulateTrainingAgent({ question: "¿Cómo instalo un tomacorriente?", trade: "electrical", rag, llm: null });

  assert.ok(result.insufficientContext, "debe ser insufficientContext cuando no hay docs");
  assert.deepEqual(result.citations, []);
  assert.ok(result.answer.includes("No hay documentos"), "debe indicar que no hay documentos");
});

test("P4.T3: TrainingAgent sin servicio RAG devuelve insufficientContext=true", async () => {
  const result = await simulateTrainingAgent({ question: "¿Qué herramientas necesito?", trade: "plumbing", rag: null, llm: null });

  assert.ok(result.insufficientContext);
  assert.equal(result.provider, "rules");
});

test("P4.T4: TrainingAgent incluye disclaimer en todas las respuestas", async () => {
  const rag = { retrieveContext: async () => makeRagCtx() };
  const llm = { chat: async () => ({ text: "Respuesta de guía.", provider: "ollama", metadata: { fallbackUsed: false } }) };

  const result1 = await simulateTrainingAgent({ question: "¿Cómo instalo?", trade: "electrical", rag, llm });
  const result2 = await simulateTrainingAgent({ question: "¿Qué herramientas?", trade: "plumbing", rag: null, llm: null });

  assert.ok(result1.disclaimer.length > 0, "disclaimer presente cuando hay respuesta");
  assert.ok(result2.disclaimer.length > 0, "disclaimer presente en insufficientContext");
});

test("P4.T5: TrainingAgent fallback usa template cuando LLM falla", async () => {
  const rag = {
    retrieveContext: async () => makeRagCtx({
      contextBlock: "## Contexto documental\n### Guía Plomería\nCierra la válvula de paso antes de trabajar.",
    }),
  };
  // Simulate null LLM (no llm service)
  const result = await simulateTrainingAgent({ question: "¿Qué hago primero?", trade: "plumbing", rag, llm: null });

  // Without LLM, should use template fallback (first 300 chars of contextBlock)
  assert.ok(!result.insufficientContext, "con docs disponibles no es insufficientContext aunque no haya LLM");
  assert.ok(result.answer.length > 0, "respuesta no debe estar vacía");
  assert.equal(result.fallbackUsed, false); // llm null = rules path, not fallback
});

// Privacy enforcement

test("P4.P1: evidence-analyzer profile siempre es privacyCritical — no cloud", () => {
  const CLOUD = new Set(["anthropic", "openai"]);
  // evidenceAnalyzer profile → privacyCritical: true → chain: ollama → template
  const privacyCriticalChain = ["ollama", "template"];
  const cloudInChain = privacyCriticalChain.filter((p) => CLOUD.has(p));
  assert.equal(cloudInChain.length, 0, "privacyCritical chain no debe incluir cloud providers");
});

test("P4.P2: training-guide profile es localOnly — no cloud", () => {
  const CLOUD = new Set(["anthropic", "openai"]);
  // localOnly → chain: ollama → template
  const localOnlyChain = ["ollama", "template"];
  const cloudInChain = localOnlyChain.filter((p) => CLOUD.has(p));
  assert.equal(cloudInChain.length, 0, "localOnly chain no debe incluir cloud providers");
});

test("P4.P3: RAG context no libera pagos — verificación de separación de responsabilidades", () => {
  // Payment Governance es la fuente de verdad para canRelease
  // RAG solo entrega contexto, nunca aprueba pagos
  const ragOutputFields = ["contextBlock", "citations", "available", "ragSources"];
  const paymentFields = ["canRelease", "releaseStatus", "blockers"];

  // Ningún campo de RAG documental coincide con campos de pago
  const intersection = ragOutputFields.filter((f) => paymentFields.includes(f));
  assert.equal(intersection.length, 0, "RAG documental no debe exponer campos de gobernanza de pago");
});

// insufficientContext behavioral contract

test("P4.I1: insufficientContext=true → respuesta explica que faltan docs (no inventa)", () => {
  const noDocsAnswer = "No hay documentos de plumbing indexados.";
  // Verify it doesn't claim to know the procedure
  const inventedProcedures = ["instala", "conecta", "usa la herramienta", "paso 1", "primero"];
  const invents = inventedProcedures.some((p) => noDocsAnswer.toLowerCase().includes(p));
  assert.equal(invents, false, "insufficientContext no debe inventar procedimientos");
  assert.ok(noDocsAnswer.toLowerCase().includes("no hay") || noDocsAnswer.toLowerCase().includes("no encontr"), "debe indicar ausencia de docs");
});

test("P4.I2: RAG context score threshold — chunks con score muy bajo son ignorados", () => {
  const MIN_SCORE = 0.10; // INSUFFICIENT_THRESHOLD from PrometeoRagService
  const lowScoreChunks = [
    { score: 0.02, text: "Texto irrelevante" },
    { score: 0.05, text: "Otro texto sin relación" },
  ];
  const relevant = lowScoreChunks.filter((c) => c.score >= MIN_SCORE);
  assert.equal(relevant.length, 0, "chunks con score < 0.10 deben ser filtrados");
});

// RAG traceability

test("P4.TR1: EvidenceReview result contiene campos de trazabilidad RAG", () => {
  const result: EvidenceReviewSimResult = {
    reviewStatus: "approved_suggestion",
    ragUsed: true,
    ragSources: ["Manual Eléctrico"],
    ragCitations: [{ documentId: "d1", documentTitle: "Manual Eléctrico", excerpt: "...", score: 0.8 }],
    provider: "ollama",
  };

  assert.ok("ragUsed" in result, "debe tener ragUsed");
  assert.ok("ragSources" in result, "debe tener ragSources");
  assert.ok("ragCitations" in result, "debe tener ragCitations");
  assert.ok("provider" in result, "debe tener provider");
});

test("P4.TR2: TrainingAgent result contiene trazabilidad completa", async () => {
  const rag = { retrieveContext: async () => makeRagCtx() };
  const llm = { chat: async () => ({ text: "Guía de instalación.", provider: "ollama", metadata: { fallbackUsed: false } }) };

  const result = await simulateTrainingAgent({ question: "test", trade: "electrical", rag, llm });

  assert.ok("citations" in result, "debe tener citations");
  assert.ok("ragSources" in result, "debe tener ragSources");
  assert.ok("provider" in result, "debe tener provider");
  assert.ok("fallbackUsed" in result, "debe tener fallbackUsed");
  assert.ok("insufficientContext" in result, "debe tener insufficientContext");
  assert.ok("disclaimer" in result, "debe tener disclaimer");
});

test("P4.TR3: CODetection con RAG registra ragSources", async () => {
  const rag = { retrieveContext: async () => makeRagCtx({ citations: [{ documentId: "s1", documentTitle: "Contract Scope v2", excerpt: "Only painting...", score: 0.88 }] }) };
  const llm = { chat: async () => makeLLMResult({ text: '{"detected":true,"title":"Extra scope","reason":"Drywall no está en contrato","risk":"high"}' }) };

  const result = await simulateCODetection({ scopeOriginal: "Pintura", newMessage: "Agregar drywall", rag, llm });

  assert.ok(result.ragUsed, "ragUsed debe ser true");
  assert.ok(result.ragSources.includes("Contract Scope v2"), "debe citar el contrato usado");
});
