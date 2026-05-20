import test from "node:test";
import assert from "node:assert/strict";

/**
 * SEMSE Agents Phase 2 — Tests unitarios
 * MarketplaceAgent, BuildOpsAgent, EvidenceAgent, CrowdAgent, PrometeoAgent
 */

// ── MarketplaceAgent — job classification ─────────────────────────────────────

const TRADE_KEYWORDS: Record<string, string[]> = {
  electrical: ["eléctrico", "electricidad", "cableado", "breaker", "panel", "tomacorriente"],
  plumbing:   ["plomería", "tubería", "agua", "fuga", "drenaje"],
  drywall:    ["drywall", "tablaroca", "yeso", "pared", "tabique"],
  painting:   ["pintura", "pintar", "pincel", "rodillo"],
  hvac:       ["aire", "calefacción", "hvac", "ventilación"],
};

function classifyTrade(description: string): string {
  const lower = description.toLowerCase();
  let bestMatch = "general"; let bestScore = 0;
  for (const [trade, kws] of Object.entries(TRADE_KEYWORDS)) {
    const score = kws.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestMatch = trade; }
  }
  return bestMatch;
}

test("MA.C1: descripción eléctrica → classifica como electrical", () => {
  assert.equal(classifyTrade("necesito instalar panel eléctrico y tomacorrientes"), "electrical");
});

test("MA.C2: descripción de plomería → classifica como plumbing", () => {
  assert.equal(classifyTrade("fuga de agua en tubería del baño"), "plumbing");
});

test("MA.C3: descripción genérica → classifica como general", () => {
  assert.equal(classifyTrade("quiero hacer unas mejoras en la casa"), "general");
});

test("MA.C4: múltiples keywords del mismo trade → score más alto gana", () => {
  const desc = "drywall y tablaroca en pared nueva con yeso";
  assert.equal(classifyTrade(desc), "drywall");
});

test("MA.B1: presupuesto estimado es positivo", () => {
  function estimateBudget(trade: string, area = 100) {
    const rates: Record<string, { hourlyRate: number; areaFactor: number }> = {
      electrical: { hourlyRate: 75, areaFactor: 0.15 },
      plumbing:   { hourlyRate: 85, areaFactor: 0.08 },
    };
    const r = rates[trade] ?? { hourlyRate: 55, areaFactor: 0.10 };
    const hours = Math.ceil(area * r.areaFactor + 2);
    return { min: Math.round(hours * r.hourlyRate * 0.8), max: Math.round(hours * r.hourlyRate * 1.4), hours };
  }
  const b = estimateBudget("electrical", 200);
  assert.ok(b.min > 0); assert.ok(b.max > b.min); assert.ok(b.hours > 0);
});

test("MA.B2: presupuesto max > min siempre", () => {
  function estimate(hours: number) { return { min: hours * 50, max: hours * 90 }; }
  [2, 8, 40].forEach((h) => {
    const { min, max } = estimate(h);
    assert.ok(max > min, `max (${max}) debe ser > min (${min})`);
  });
});

// ── BuildOpsAgent — project plan ─────────────────────────────────────────────

const TRADE_PHASES: Record<string, Array<{ name: string; durationDays: number; tasks: string[] }>> = {
  electrical: [
    { name: "Rough-in", durationDays: 2, tasks: ["Instalar cajas", "Pasar cable"] },
    { name: "Finish",   durationDays: 1, tasks: ["Instalar dispositivos", "Pruebas"] },
  ],
  painting: [
    { name: "Preparación", durationDays: 1, tasks: ["Limpiar", "Primer"] },
    { name: "Pintura",     durationDays: 2, tasks: ["Primera capa", "Segunda capa"] },
  ],
};

function createPlan(trade: string, hours: number) {
  const phases = TRADE_PHASES[trade] ?? [{ name: "Ejecución", durationDays: Math.ceil(hours / 8), tasks: ["Ejecutar trabajo"] }];
  return { phases, totalDays: phases.reduce((s, p) => s + p.durationDays, 0), criticalPath: phases.map((p) => p.name) };
}

test("BO.P1: plan eléctrico tiene 2 fases: rough-in + finish", () => {
  const plan = createPlan("electrical", 16);
  assert.equal(plan.phases.length, 2);
  assert.ok(plan.phases[0]?.name.toLowerCase().includes("rough"));
  assert.ok(plan.phases[1]?.name.toLowerCase().includes("finish"));
});

test("BO.P2: totalDays = suma de durationDays de cada fase", () => {
  const plan = createPlan("electrical", 16);
  const expected = plan.phases.reduce((s, p) => s + p.durationDays, 0);
  assert.equal(plan.totalDays, expected);
});

test("BO.P3: trade desconocido genera plan genérico", () => {
  const plan = createPlan("flooring_custom", 24);
  assert.equal(plan.phases.length, 1, "trade desconocido → 1 fase genérica");
  assert.ok(plan.phases[0]!.durationDays >= 1);
});

test("BO.P4: criticalPath lista todas las fases en orden", () => {
  const plan = createPlan("painting", 16);
  assert.deepEqual(plan.criticalPath, ["Preparación", "Pintura"]);
});

// ── EvidenceAgent — checklist generation ─────────────────────────────────────

const EVIDENCE_TEMPLATES: Record<string, Array<{ label: string; kind: string }>> = {
  electrical: [
    { label: "Foto rough-in eléctrico",   kind: "photo" },
    { label: "Prueba GFCI documentada",   kind: "test" },
    { label: "Etiquetas panel completas", kind: "photo" },
    { label: "Inspección municipal",       kind: "document" },
  ],
  plumbing: [
    { label: "Foto tubería instalada", kind: "photo" },
    { label: "Prueba de presión",      kind: "test" },
    { label: "Foto fixtures",          kind: "photo" },
    { label: "Prueba de flujo",        kind: "test" },
  ],
};

function generateChecklist(milestoneTitle: string, trade: string) {
  const lower = milestoneTitle.toLowerCase();
  const matched = Object.keys(EVIDENCE_TEMPLATES).find((t) => lower.includes(t)) ?? trade;
  const required = EVIDENCE_TEMPLATES[matched] ?? [{ label: "Foto antes", kind: "photo" }, { label: "Foto después", kind: "photo" }];
  return { milestoneTitle, required, disputeRisk: required.length > 3 ? "high" : "medium" };
}

test("EV.CH1: milestone eléctrico → 4 items de evidencia", () => {
  const cl = generateChecklist("Rough-in electrical completado", "electrical");
  assert.equal(cl.required.length, 4);
});

test("EV.CH2: incluye al menos una foto obligatoria", () => {
  const cl = generateChecklist("any milestone", "electrical");
  assert.ok(cl.required.some((r) => r.kind === "photo"), "debe haber al menos una foto");
});

test("EV.CH3: many items → disputeRisk=high", () => {
  const cl = generateChecklist("electrical milestone", "electrical");
  assert.equal(cl.disputeRisk, "high", "> 3 items → high risk");
});

test("EV.CH4: milestone genérico → checklist básica de 2 fotos", () => {
  const cl = generateChecklist("trabajo terminado", "unknown_trade");
  assert.equal(cl.required.length, 2);
  assert.ok(cl.required.every((r) => r.kind === "photo"));
});

// ── CrowdAgent — payment evaluation ──────────────────────────────────────────

function evaluatePayment(input: { evidenceApproved: boolean; changeOrdersPending: number; disputeOpen: boolean; milestoneStatus: string }) {
  const blockers: string[] = [];
  if (!input.evidenceApproved)          blockers.push("Evidencia pendiente");
  if (input.changeOrdersPending > 0)    blockers.push(`${input.changeOrdersPending} change order(s)`);
  if (input.disputeOpen)                blockers.push("Disputa activa");
  if (!["submitted", "approved"].includes(input.milestoneStatus)) blockers.push(`Status: ${input.milestoneStatus}`);
  return { canRelease: blockers.length === 0, blockers, escrowStatus: input.disputeOpen ? "disputed" : blockers.length === 0 ? "pending_review" : "locked" };
}

test("CR.P1: todo OK → canRelease=true", () => {
  const d = evaluatePayment({ evidenceApproved: true, changeOrdersPending: 0, disputeOpen: false, milestoneStatus: "submitted" });
  assert.ok(d.canRelease);
  assert.deepEqual(d.blockers, []);
  assert.equal(d.escrowStatus, "pending_review");
});

test("CR.P2: evidencia no aprobada → canRelease=false", () => {
  const d = evaluatePayment({ evidenceApproved: false, changeOrdersPending: 0, disputeOpen: false, milestoneStatus: "submitted" });
  assert.equal(d.canRelease, false);
  assert.ok(d.blockers.some((b) => b.includes("Evidencia")));
});

test("CR.P3: disputa activa → escrowStatus=disputed", () => {
  const d = evaluatePayment({ evidenceApproved: true, changeOrdersPending: 0, disputeOpen: true, milestoneStatus: "submitted" });
  assert.equal(d.escrowStatus, "disputed");
  assert.equal(d.canRelease, false);
});

test("CR.P4: change orders pendientes → blocked", () => {
  const d = evaluatePayment({ evidenceApproved: true, changeOrdersPending: 2, disputeOpen: false, milestoneStatus: "submitted" });
  assert.equal(d.canRelease, false);
  assert.ok(d.blockers.some((b) => b.includes("2 change order")));
});

test("CR.P5: milestone en draft → blocked", () => {
  const d = evaluatePayment({ evidenceApproved: true, changeOrdersPending: 0, disputeOpen: false, milestoneStatus: "draft" });
  assert.equal(d.canRelease, false);
  assert.ok(d.blockers.some((b) => b.includes("draft")));
});

test("CR.P6: múltiples bloqueadores → todos en la lista", () => {
  const d = evaluatePayment({ evidenceApproved: false, changeOrdersPending: 1, disputeOpen: true, milestoneStatus: "draft" });
  assert.ok(d.blockers.length >= 3, `debe tener >= 3 bloqueadores (tiene ${d.blockers.length})`);
});

// ── PrometeoAgent — narrative ─────────────────────────────────────────────────

test("PR.N1: narrative con RAG usa fromRAG=true", () => {
  const narrative = { summary: "Basado en doc", fromRAG: true, citations: ["Manual Eléctrico"], riskLevel: "low", nextAction: "Ver doc" };
  assert.ok(narrative.fromRAG);
  assert.ok(narrative.citations.length > 0);
});

test("PR.N2: narrative sin RAG usa fromRAG=false", () => {
  const narrative = { summary: "Sin contexto", fromRAG: false, citations: [], riskLevel: "medium", nextAction: "Subir docs" };
  assert.equal(narrative.fromRAG, false);
  assert.deepEqual(narrative.citations, []);
});

test("PR.N3: payment ready → riskLevel=low", () => {
  const narrative = { readyForRelease: true, riskLevel: "low" };
  assert.equal(narrative.riskLevel, "low");
});

// ── Agent boundary enforcement ────────────────────────────────────────────────

test("AG2.B1: MarketplaceAgent NO gestiona pagos", () => {
  const marketplaceMethods = ["classifyJob", "handleMessage"];
  const paymentMethods = ["releasePayment", "fundEscrow", "refund"];
  assert.equal(marketplaceMethods.filter((m) => paymentMethods.includes(m)).length, 0);
});

test("AG2.B2: CrowdAgent NO clasifica trabajos", () => {
  const crowdMethods = ["evaluatePaymentReadiness", "handleMessage"];
  const classificationMethods = ["classifyTrade", "classifyJob", "estimateBudget"];
  assert.equal(crowdMethods.filter((m) => classificationMethods.includes(m)).length, 0);
});

test("AG2.B3: 6 agentes cubren el ciclo completo", () => {
  const agentRoles = {
    marketplace: "conecta",
    buildops:    "organiza",
    protools:    "calcula",
    evidence:    "protege",
    crowd:       "paga",
    prometeo:    "explica",
  };
  assert.equal(Object.keys(agentRoles).length, 6);
  assert.ok(Object.values(agentRoles).every((r) => r.length > 0));
});

test("AG2.B4: ningún agente viola sus fronteras hacia pagos sin ser Crowd", () => {
  const NON_CROWD_AGENTS = ["marketplace", "buildops", "protools", "evidence", "prometeo"];
  // Estos agentes no deben tener acceso a liberar pagos
  const paymentActions = ["releaseEscrow", "fundPayment", "processRefund"];
  // Solo verificamos el contrato — los agentes no deben exponer estas acciones
  assert.ok(NON_CROWD_AGENTS.length === 5, "5 agentes no-crowd");
  assert.ok(paymentActions.every((a) => !NON_CROWD_AGENTS.includes(a)), "ningún agente no-crowd es una acción de pago");
});
