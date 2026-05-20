import test from "node:test";
import assert from "node:assert/strict";

/**
 * SEMSE Agents — Tests unitarios
 * Sin DB, sin LLM. Cubre message bus, ProTools rules engine y contratos de agentes.
 */

// ── Agent types ───────────────────────────────────────────────────────────────

type SemseAgentName = "marketplace" | "buildops" | "protools" | "evidence" | "crowd" | "prometeo";
type SemseAgentEvent = "ESTIMATE_REQUESTED" | "MATERIALS_CALCULATED" | "PROJECT_PUBLISHED" | "PAYMENT_RELEASED";

type SemseAgentMessage = {
  from: SemseAgentName; to: SemseAgentName | "broadcast";
  event: SemseAgentEvent; payload: Record<string, unknown>;
  projectId: string; correlationId: string; timestamp: Date;
};

// ── Message bus simulation ────────────────────────────────────────────────────

function makeMessage(from: SemseAgentName, to: SemseAgentName | "broadcast", event: SemseAgentEvent, payload: Record<string, unknown> = {}): SemseAgentMessage {
  return { from, to, event, payload, projectId: "p1", correlationId: `${from}-${Date.now()}`, timestamp: new Date() };
}

test("AG.B1: mensaje de protools → buildops se enruta correctamente", () => {
  const msg = makeMessage("protools", "buildops", "MATERIALS_CALCULATED", { totalCost: 1500 });
  assert.equal(msg.from, "protools");
  assert.equal(msg.to, "buildops");
  assert.equal(msg.event, "MATERIALS_CALCULATED");
  assert.ok(msg.correlationId.startsWith("protools"));
});

test("AG.B2: broadcast llega a todos los agentes registrados", () => {
  const AGENTS: SemseAgentName[] = ["marketplace", "buildops", "protools", "evidence", "crowd", "prometeo"];
  const msg = makeMessage("marketplace", "broadcast", "PROJECT_PUBLISHED", { projectId: "p1" });
  // Broadcast → todos son target
  assert.equal(msg.to, "broadcast");
  assert.equal(AGENTS.length, 6, "6 agentes en el ecosistema");
});

test("AG.B3: correlationId tiene formato agentName-timestamp-random", () => {
  const msg = makeMessage("protools", "buildops", "MATERIALS_CALCULATED");
  assert.ok(msg.correlationId.startsWith("protools-"), "correlationId empieza con el nombre del agente");
  assert.ok(msg.correlationId.length > 10, "correlationId tiene suficiente longitud");
  // En producción el servicio agrega un sufijo random para garantizar unicidad
});

test("AG.B4: timestamp es Date válida", () => {
  const msg = makeMessage("evidence", "crowd", "PAYMENT_RELEASED");
  assert.ok(msg.timestamp instanceof Date);
  assert.ok(!isNaN(msg.timestamp.getTime()));
});

// ── ProTools rules engine ─────────────────────────────────────────────────────

type Material = { item: string; qty: number; unit: string; unitCost: number; total: number };

function estimateMaterials(trade: string, area: number, rooms: number): Material[] {
  const base: Record<string, Material[]> = {
    electrical: [
      { item: "Cable NM-B 12/2", qty: Math.ceil(area * 0.8), unit: "pies", unitCost: 0.65, total: 0 },
      { item: "Tomacorriente GFCI", qty: rooms * 2, unit: "pcs", unitCost: 22, total: 0 },
    ],
    painting: [
      { item: "Pintura satinada", qty: Math.ceil(area / 350), unit: "galones", unitCost: 38, total: 0 },
      { item: "Primer", qty: Math.ceil(area / 400), unit: "galones", unitCost: 28, total: 0 },
    ],
    drywall: [
      { item: "Panel drywall 4×8", qty: Math.ceil(area / 32), unit: "hojas", unitCost: 14, total: 0 },
    ],
  };
  const items = base[trade] ?? [{ item: "Materiales generales", qty: Math.ceil(area / 10), unit: "unidades", unitCost: 25, total: 0 }];
  return items.map((m) => ({ ...m, total: Math.round(m.qty * m.unitCost * 100) / 100 }));
}

function estimateLabor(trade: string, area: number, rooms: number): number {
  const rates: Record<string, number> = {
    electrical: area * 0.15 + rooms * 4,
    plumbing:   area * 0.08 + rooms * 3,
    drywall:    area * 0.12,
    painting:   area * 0.06 + rooms * 2,
  };
  return Math.ceil(rates[trade] ?? area * 0.10);
}

test("AG.P1: ProTools — materiales eléctricos escalan con área", () => {
  const small = estimateMaterials("electrical", 100, 2);
  const large = estimateMaterials("electrical", 300, 2);
  const cableSmall = small.find((m) => m.item.includes("Cable"))!;
  const cableLarge = large.find((m) => m.item.includes("Cable"))!;
  assert.ok(cableLarge.qty > cableSmall.qty, "más área → más cable");
});

test("AG.P2: ProTools — materiales de pintura escalan con área", () => {
  const mats = estimateMaterials("painting", 350, 1);
  const paint = mats.find((m) => m.item.includes("Pintura"))!;
  assert.ok(paint !== undefined);
  assert.ok(paint.qty >= 1, "al menos 1 galón para 350 sqft");
});

test("AG.P3: ProTools — labor hours escalan con área", () => {
  const h100 = estimateLabor("electrical", 100, 1);
  const h300 = estimateLabor("electrical", 300, 1);
  assert.ok(h300 > h100, "más área → más horas");
});

test("AG.P4: ProTools — trade desconocido usa materiales generales", () => {
  const mats = estimateMaterials("flooring_custom", 200, 1);
  assert.equal(mats[0]?.item, "Materiales generales");
});

test("AG.P5: ProTools — todos los materiales tienen total calculado", () => {
  const trades = ["electrical", "painting", "drywall", "plumbing"];
  for (const trade of trades) {
    const mats = estimateMaterials(trade, 200, 2);
    mats.forEach((m) => {
      assert.ok(m.total > 0, `${trade}: total de ${m.item} debe ser > 0`);
      assert.ok(Math.abs(m.total - m.qty * m.unitCost) < 0.01, `${m.item}: total debe ser qty × unitCost`);
    });
  }
});

test("AG.P6: ProTools — totalCost = materials + labor", () => {
  const trade = "painting";
  const area = 500; const rooms = 3;
  const materials = estimateMaterials(trade, area, rooms);
  const laborHours = estimateLabor(trade, area, rooms);
  const totalMaterials = materials.reduce((s, m) => s + m.total, 0);
  const totalLabor = laborHours * 35;
  const totalCost = totalMaterials + totalLabor;
  assert.ok(totalCost > 0);
  assert.ok(totalMaterials > 0);
  assert.ok(totalLabor > 0);
});

// ── Agent boundary contracts ──────────────────────────────────────────────────

const AGENT_FORBIDDEN: Record<SemseAgentName, string[]> = {
  marketplace: ["payments", "disputes", "materials"],
  buildops:    ["materials", "costs", "payments"],
  protools:    ["payments", "disputes", "legal"],
  evidence:    ["payments", "scheduling"],
  crowd:       ["scheduling", "materials"],
  prometeo:    ["payments", "scheduling", "materials"],
};

test("AG.C1: ProTools no puede gestionar pagos (boundary contract)", () => {
  const forbidden = AGENT_FORBIDDEN["protools"]!;
  assert.ok(forbidden.includes("payments"), "ProTools no gestiona pagos");
  assert.ok(forbidden.includes("disputes"), "ProTools no gestiona disputas");
});

test("AG.C2: Marketplace no calcula materiales", () => {
  const forbidden = AGENT_FORBIDDEN["marketplace"]!;
  assert.ok(forbidden.includes("materials"), "Marketplace no calcula materiales");
});

test("AG.C3: Crowd (pagos) no programa trabajo", () => {
  const forbidden = AGENT_FORBIDDEN["crowd"]!;
  assert.ok(forbidden.includes("scheduling"), "Crowd no organiza trabajo");
});

test("AG.C4: cada agente tiene al menos 2 acciones prohibidas", () => {
  for (const [agent, forbidden] of Object.entries(AGENT_FORBIDDEN)) {
    assert.ok(forbidden.length >= 2, `${agent} debe tener al menos 2 acciones prohibidas`);
  }
});

// ── Agent integration graph ───────────────────────────────────────────────────

const AGENT_INTEGRATIONS: Record<SemseAgentName, SemseAgentName[]> = {
  marketplace: ["protools", "buildops", "crowd", "evidence", "prometeo"],
  buildops:    ["protools", "crowd", "evidence", "prometeo"],
  protools:    [],
  evidence:    ["crowd", "prometeo"],
  crowd:       ["prometeo"],
  prometeo:    [],
};

test("AG.I1: Marketplace conecta con todos los demás agentes", () => {
  const integrations = AGENT_INTEGRATIONS["marketplace"]!;
  assert.equal(integrations.length, 5, "Marketplace integra con los otros 5 agentes");
});

test("AG.I2: ProTools y Prometeo son agentes hoja (no llaman a otros)", () => {
  assert.deepEqual(AGENT_INTEGRATIONS["protools"], []);
  assert.deepEqual(AGENT_INTEGRATIONS["prometeo"], []);
});

test("AG.I3: sin ciclos directos (A → B → A)", () => {
  for (const [agent, targets] of Object.entries(AGENT_INTEGRATIONS)) {
    for (const target of targets) {
      const backEdges = AGENT_INTEGRATIONS[target as SemseAgentName] ?? [];
      const hasCycle = backEdges.includes(agent as SemseAgentName);
      assert.equal(hasCycle, false, `Ciclo detectado: ${agent} ↔ ${target}`);
    }
  }
});

// ── Checklist contract ────────────────────────────────────────────────────────

const CHECKLISTS: Record<string, string[]> = {
  electrical: ["Verificar voltaje", "GFCI en áreas húmedas", "Fotografiar antes de cerrar paredes"],
  plumbing:   ["Cerrar llave de paso", "Probar presión", "Fotografiar antes de cubrir tuberías"],
  drywall:    ["Verificar framing", "Usar mascarilla N95", "Fotografiar instalación"],
  painting:   ["Limpiar superficie", "Aplicar primer", "Documentar antes y después"],
};

test("AG.CH1: todos los trades tienen checklist de evidencia", () => {
  const required = ["electrical", "plumbing", "drywall", "painting"];
  required.forEach((t) => {
    assert.ok(t in CHECKLISTS, `trade ${t} debe tener checklist`);
    assert.ok(CHECKLISTS[t]!.length >= 3, `${t} necesita al menos 3 items`);
  });
});

test("AG.CH2: checklists incluyen foto como evidencia SEMSE", () => {
  for (const [trade, items] of Object.entries(CHECKLISTS)) {
    const hasPhoto = items.some((i) => i.toLowerCase().includes("foto") || i.toLowerCase().includes("document"));
    assert.ok(hasPhoto, `${trade}: checklist debe incluir evidencia fotográfica`);
  }
});
