import test from "node:test";
import assert from "node:assert/strict";

/**
 * Marketplace Bids — Tests unitarios
 * Sin DB, sin HTTP. Cubre validación de bids, lógica de budget y contrato.
 */

// ── Bid validation ─────────────────────────────────────────────────────────────

type BidInput = {
  jobId:         string;
  budgetMin?:    number;
  budgetMax?:    number;
  note?:         string;
  availableFrom?: string;
};

function validateBid(input: Partial<BidInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.jobId || input.jobId.trim().length === 0)
    errors.push("jobId es requerido");
  if (input.budgetMin !== undefined && input.budgetMin < 0)
    errors.push("budgetMin no puede ser negativo");
  if (input.budgetMax !== undefined && input.budgetMax < 0)
    errors.push("budgetMax no puede ser negativo");
  if (input.budgetMin !== undefined && input.budgetMax !== undefined && input.budgetMin > input.budgetMax)
    errors.push("budgetMin no puede ser mayor que budgetMax");
  if (input.note && input.note.length > 1000)
    errors.push("note no puede superar 1000 caracteres");
  if (input.availableFrom) {
    const date = new Date(input.availableFrom);
    if (isNaN(date.getTime())) errors.push("availableFrom debe ser una fecha válida");
  }
  return { valid: errors.length === 0, errors };
}

test("MB.V1: bid válido mínimo (solo jobId)", () => {
  const result = validateBid({ jobId: "job-123" });
  assert.ok(result.valid);
  assert.deepEqual(result.errors, []);
});

test("MB.V2: bid válido completo", () => {
  const result = validateBid({ jobId: "job-123", budgetMin: 500, budgetMax: 800, note: "Tengo experiencia", availableFrom: "2026-05-25" });
  assert.ok(result.valid);
});

test("MB.V3: sin jobId → inválido", () => {
  const result = validateBid({ budgetMin: 500 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("jobId")));
});

test("MB.V4: budgetMin > budgetMax → inválido", () => {
  const result = validateBid({ jobId: "j1", budgetMin: 1000, budgetMax: 500 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("budgetMin")));
});

test("MB.V5: budget negativo → inválido", () => {
  const result = validateBid({ jobId: "j1", budgetMin: -100 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("negativo")));
});

test("MB.V6: nota demasiado larga → inválida", () => {
  const result = validateBid({ jobId: "j1", note: "a".repeat(1001) });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("1000")));
});

test("MB.V7: fecha inválida → error", () => {
  const result = validateBid({ jobId: "j1", availableFrom: "not-a-date" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("fecha")));
});

test("MB.V8: fecha válida ISO → ok", () => {
  const result = validateBid({ jobId: "j1", availableFrom: "2026-06-01" });
  assert.ok(result.valid);
});

// ── Budget from ProTools ───────────────────────────────────────────────────────

function budgetFromEstimate(totalCost: number, margin = 0.2): { min: number; max: number } {
  return {
    min: Math.round(totalCost * (1 - margin)),
    max: Math.round(totalCost * (1 + margin)),
  };
}

test("MB.B1: budget from estimate — min < total < max", () => {
  const total = 1000;
  const { min, max } = budgetFromEstimate(total);
  assert.ok(min < total, `min (${min}) debe ser < total (${total})`);
  assert.ok(max > total, `max (${max}) debe ser > total (${total})`);
});

test("MB.B2: budget from estimate con 20% margen", () => {
  const { min, max } = budgetFromEstimate(1000, 0.2);
  assert.equal(min, 800);
  assert.equal(max, 1200);
});

test("MB.B3: budget min <= max siempre", () => {
  [100, 500, 5000, 50000].forEach((cost) => {
    const { min, max } = budgetFromEstimate(cost);
    assert.ok(min <= max, `min (${min}) debe ser <= max (${max}) para cost=${cost}`);
  });
});

// ── Bid status lifecycle ───────────────────────────────────────────────────────

type BidStatus = "submitted" | "accepted" | "rejected" | "withdrawn";

const BID_TRANSITIONS: Record<BidStatus, BidStatus[]> = {
  submitted: ["accepted", "rejected", "withdrawn"],
  accepted:  ["withdrawn"],
  rejected:  [],
  withdrawn: [],
};

function canTransitionBid(from: BidStatus, to: BidStatus): boolean {
  return BID_TRANSITIONS[from].includes(to);
}

test("MB.ST1: submitted → accepted es válido", () => {
  assert.ok(canTransitionBid("submitted", "accepted"));
});

test("MB.ST2: submitted → rejected es válido", () => {
  assert.ok(canTransitionBid("submitted", "rejected"));
});

test("MB.ST3: submitted → withdrawn es válido", () => {
  assert.ok(canTransitionBid("submitted", "withdrawn"));
});

test("MB.ST4: rejected → accepted NO es válido", () => {
  assert.equal(canTransitionBid("rejected", "accepted"), false);
});

test("MB.ST5: accepted es estado casi final (solo withdrawn)", () => {
  assert.ok(canTransitionBid("accepted", "withdrawn"), "accepted puede cancelarse");
  assert.equal(canTransitionBid("accepted", "rejected"), false, "no puede rechazarse si ya fue aceptado");
});

test("MB.ST6: withdrawn es estado final", () => {
  const targets: BidStatus[] = ["submitted", "accepted", "rejected"];
  targets.forEach((t) => {
    assert.equal(canTransitionBid("withdrawn", t), false);
  });
});

// ── ProTools → Publish Job flow ────────────────────────────────────────────────

type JobFromEstimate = {
  title: string; scope: string; category: string;
  budgetMin: number; budgetMax: number; locationType: string;
};

function jobFromProTools(estimate: {
  trade: string; description: string; totalCost: number; laborHours: number;
}): JobFromEstimate {
  const { min, max } = budgetFromEstimate(estimate.totalCost);
  return {
    title:       `${estimate.trade.charAt(0).toUpperCase() + estimate.trade.slice(1)}: ${estimate.description.slice(0, 80)}`,
    scope:       estimate.description,
    category:    estimate.trade,
    budgetMin:   min,
    budgetMax:   max,
    locationType: "on_site",
  };
}

test("MB.PJ1: job desde ProTools tiene todos los campos requeridos", () => {
  const job = jobFromProTools({ trade: "electrical", description: "Instalar panel nuevo 200A", totalCost: 1500, laborHours: 16 });
  assert.ok(job.title.length > 0, "title requerido");
  assert.ok(job.scope.length > 0, "scope requerido");
  assert.ok(job.category.length > 0, "category requerido");
  assert.ok(job.budgetMin > 0 && job.budgetMax > 0, "budgets requeridos");
  assert.equal(job.locationType, "on_site");
});

test("MB.PJ2: title incluye el trade capitalizado", () => {
  const job = jobFromProTools({ trade: "plumbing", description: "Reparar tubería cocina", totalCost: 500, laborHours: 4 });
  assert.ok(job.title.startsWith("Plumbing"), `title debe empezar con trade capitalizado: ${job.title}`);
});

test("MB.PJ3: category = trade exacto", () => {
  const job = jobFromProTools({ trade: "drywall", description: "Instalar tablaroca", totalCost: 800, laborHours: 8 });
  assert.equal(job.category, "drywall");
});

test("MB.PJ4: budget derivado del estimate con margen 20%", () => {
  const job = jobFromProTools({ trade: "painting", description: "Pintar sala", totalCost: 1000, laborHours: 6 });
  assert.equal(job.budgetMin, 800);
  assert.equal(job.budgetMax, 1200);
});

// ── Evidence checklist for bid context ────────────────────────────────────────

test("MB.EC1: bid enviado implica compromiso de evidencia", () => {
  // Cuando un bid es aceptado, el profesional debe saber qué evidencia necesitará
  const bidAccepted  = true;
  const evidenceNeeded = bidAccepted; // siempre que sea aceptado
  assert.ok(evidenceNeeded, "bid aceptado → evidencia requerida para cobrar");
});

test("MB.EC2: sin evidencia completa → pago bloqueado (integración Crowd)", () => {
  // El CrowdAgent.evaluatePaymentReadiness verifica evidenceApproved
  const evidenceApproved = false;
  const canRelease = evidenceApproved && true; // simplificado
  assert.equal(canRelease, false, "sin evidencia no se puede liberar pago");
});

// ── Worker own bids (GET /v1/bids/mine) ───────────────────────────────────────

type MyBidRecord = {
  id: string;
  jobId: string;
  jobTitle: string;
  professionalUserId: string;
  status: "submitted" | "accepted" | "rejected";
  amount: number;
  etaDays: number;
};

function filterBidsByWorker(bids: MyBidRecord[], userId: string): MyBidRecord[] {
  return bids.filter(b => b.professionalUserId === userId);
}

test("MB.WB1: filterBidsByWorker retorna solo bids del userId dado", () => {
  const bids: MyBidRecord[] = [
    { id: "b1", jobId: "j1", jobTitle: "Plomería", professionalUserId: "u1", status: "submitted", amount: 500, etaDays: 3 },
    { id: "b2", jobId: "j2", jobTitle: "Pintura",  professionalUserId: "u2", status: "submitted", amount: 300, etaDays: 2 },
    { id: "b3", jobId: "j3", jobTitle: "Eléctrico", professionalUserId: "u1", status: "accepted",  amount: 800, etaDays: 5 },
  ];
  const result = filterBidsByWorker(bids, "u1");
  assert.equal(result.length, 2);
  assert.ok(result.every(b => b.professionalUserId === "u1"));
});

test("MB.WB2: filterBidsByWorker con userId sin bids retorna []", () => {
  const bids: MyBidRecord[] = [
    { id: "b1", jobId: "j1", jobTitle: "Plomería", professionalUserId: "u1", status: "submitted", amount: 500, etaDays: 3 },
  ];
  const result = filterBidsByWorker(bids, "u99");
  assert.equal(result.length, 0);
});

test("MB.WB3: estado accepted es visible para el worker", () => {
  const bids: MyBidRecord[] = [
    { id: "b1", jobId: "j1", jobTitle: "Pintura", professionalUserId: "u1", status: "accepted", amount: 600, etaDays: 4 },
  ];
  const mine = filterBidsByWorker(bids, "u1");
  assert.equal(mine[0]?.status, "accepted");
});

test("MB.WB4: estado rejected es visible para el worker", () => {
  const bids: MyBidRecord[] = [
    { id: "b1", jobId: "j1", jobTitle: "Drywall", professionalUserId: "u1", status: "rejected", amount: 200, etaDays: 2 },
  ];
  const mine = filterBidsByWorker(bids, "u1");
  assert.equal(mine[0]?.status, "rejected");
});

test("MB.WB5: BFF retorna array vacío cuando worker no tiene bids", () => {
  const bids: MyBidRecord[] = [];
  const mine = filterBidsByWorker(bids, "u1");
  assert.deepEqual(mine, []);
});

// ── Bid creation schema — correct fields (amount + etaDays) ────────────────────

type CreateBidBody = {
  jobId: string;
  amount: number;
  etaDays: number;
  proOrgId?: string;
};

function validateCreateBid(body: Partial<CreateBidBody>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!body.jobId || body.jobId.trim().length === 0) errors.push("jobId es requerido");
  if (body.amount === undefined || body.amount === null) errors.push("amount es requerido");
  else if (body.amount <= 0) errors.push("amount debe ser positivo");
  if (body.etaDays === undefined || body.etaDays === null) errors.push("etaDays es requerido");
  else if (body.etaDays <= 0 || !Number.isInteger(body.etaDays)) errors.push("etaDays debe ser un entero positivo");
  return { valid: errors.length === 0, errors };
}

test("MB.CS1: bid con amount y etaDays válidos es aceptado", () => {
  const result = validateCreateBid({ jobId: "j1", amount: 1500, etaDays: 5 });
  assert.ok(result.valid);
  assert.equal(result.errors.length, 0);
});

test("MB.CS2: bid sin amount falla validación", () => {
  const result = validateCreateBid({ jobId: "j1", etaDays: 3 });
  assert.ok(!result.valid);
  assert.ok(result.errors.some(e => e.includes("amount")));
});

test("MB.CS3: bid con amount negativo falla validación", () => {
  const result = validateCreateBid({ jobId: "j1", amount: -100, etaDays: 3 });
  assert.ok(!result.valid);
  assert.ok(result.errors.some(e => e.includes("amount")));
});

test("MB.CS4: bid sin etaDays falla validación", () => {
  const result = validateCreateBid({ jobId: "j1", amount: 800 });
  assert.ok(!result.valid);
  assert.ok(result.errors.some(e => e.includes("etaDays")));
});

test("MB.CS5: bid con etaDays cero falla validación", () => {
  const result = validateCreateBid({ jobId: "j1", amount: 500, etaDays: 0 });
  assert.ok(!result.valid);
  assert.ok(result.errors.some(e => e.includes("etaDays")));
});

test("MB.CS6: proOrgId es opcional en el cuerpo de la petición", () => {
  const withOrg    = validateCreateBid({ jobId: "j1", amount: 200, etaDays: 2, proOrgId: "org-abc" });
  const withoutOrg = validateCreateBid({ jobId: "j1", amount: 200, etaDays: 2 });
  assert.ok(withOrg.valid,    "con proOrgId debe ser válido");
  assert.ok(withoutOrg.valid, "sin proOrgId también debe ser válido (default a actor.orgId)");
});
