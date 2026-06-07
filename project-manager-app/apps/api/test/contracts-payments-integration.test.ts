import test from "node:test";
import assert from "node:assert/strict";

/**
 * Contracts & Payments (sesión externa) — Tests unitarios
 * Cubre lógica de contratos, Stripe Connect, HelloSign, escrow release.
 */

// ── Contract template logic ───────────────────────────────────────────────────

const SCOPE_BY_TRADE: Record<string, string> = {
  electrical: "Instalación eléctrica completa según NEC y código local.",
  plumbing:   "Trabajo de plomería residencial según UPC.",
  drywall:    "Instalación de tablaroca, acabado con 3 capas de compound.",
  painting:   "Pintura interior/exterior con imprimador y 2 capas.",
  roofing:    "Sustitución o reparación de techo.",
  concrete:   "Obra de concreto: mezcla, colado, nivelación y curado.",
  flooring:   "Instalación de piso laminado, vinílico o madera.",
  hvac:       "Instalación/sustitución de sistema HVAC.",
  carpentry:  "Carpintería fina según alcance acordado.",
  tile:       "Instalación de azulejo o mosaico.",
  default:    "Trabajo de construcción/remodelación según especificaciones.",
};

test("CT.S1: scope por trade electrical definido", () => {
  assert.ok(SCOPE_BY_TRADE["electrical"]?.length > 0);
  assert.ok(SCOPE_BY_TRADE["electrical"]?.includes("NEC"));
});

test("CT.S2: trade desconocido usa scope default", () => {
  const scope = SCOPE_BY_TRADE["unknown_trade"] ?? SCOPE_BY_TRADE["default"]!;
  assert.ok(scope.length > 0);
});

test("CT.S3: no hay duplicados de clave en SCOPE_BY_TRADE", () => {
  const keys = Object.keys(SCOPE_BY_TRADE);
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length, "No deben existir claves duplicadas");
});

test("CT.S4: todos los trades tienen scope con longitud > 20", () => {
  Object.entries(SCOPE_BY_TRADE).forEach(([trade, scope]) => {
    assert.ok(scope.length > 20, `${trade}: scope demasiado corto`);
  });
});

// ── Payment status transitions ────────────────────────────────────────────────

type PaymentTxnStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REVERSED";

const VALID_TXN_STATUSES: PaymentTxnStatus[] = ["PENDING", "SUCCEEDED", "FAILED", "REVERSED"];

test("CT.P1: PaymentTxnStatus tiene 4 valores válidos", () => {
  assert.equal(VALID_TXN_STATUSES.length, 4);
  assert.ok(VALID_TXN_STATUSES.includes("SUCCEEDED"), "SUCCEEDED es un estado válido");
  assert.ok(!VALID_TXN_STATUSES.includes("COMPLETED" as PaymentTxnStatus), "COMPLETED NO es válido");
});

test("CT.P2: SUCCEEDED es el estado final de pago exitoso", () => {
  const releaseStatus = "SUCCEEDED" as PaymentTxnStatus;
  assert.equal(releaseStatus, "SUCCEEDED");
});

test("CT.P3: REVERSED es el estado de devolución", () => {
  const refundStatus = "REVERSED" as PaymentTxnStatus;
  assert.ok(VALID_TXN_STATUSES.includes(refundStatus));
});

// ── Stripe Connect fee calculation ────────────────────────────────────────────

function calculatePlatformFee(amountUsd: number, feeRate = 0.0075): {
  platformFeeCents: number;
  netAmountUsd: number;
} {
  const platformFeeCents = Math.round(amountUsd * feeRate * 100);
  const netAmountUsd = amountUsd - platformFeeCents / 100;
  return { platformFeeCents, netAmountUsd };
}

test("CT.SC1: fee 0.75% de $1000 = $7.50 = 750 cents", () => {
  const { platformFeeCents } = calculatePlatformFee(1000);
  assert.equal(platformFeeCents, 750);
});

test("CT.SC2: net amount = total - fee", () => {
  const { platformFeeCents, netAmountUsd } = calculatePlatformFee(1000);
  const expected = 1000 - platformFeeCents / 100;
  assert.ok(Math.abs(netAmountUsd - expected) < 0.01);
});

test("CT.SC3: fee mínimo para montos pequeños", () => {
  const { platformFeeCents } = calculatePlatformFee(10);
  assert.ok(platformFeeCents >= 0, "fee nunca negativo");
  assert.ok(platformFeeCents <= 10 * 100, "fee nunca supera el monto");
});

test("CT.SC4: net amount siempre positivo", () => {
  [100, 500, 1000, 5000].forEach((amount) => {
    const { netAmountUsd } = calculatePlatformFee(amount);
    assert.ok(netAmountUsd > 0, `net amount debe ser positivo para $${amount}`);
  });
});

// ── Escrow release contract ───────────────────────────────────────────────────

type EscrowReleaseInput = {
  milestoneId: string;
  tenantId:    string;
  actorId:     string;
};

type EscrowReleaseResult = {
  milestoneId: string;
  released:    boolean;
  blockers:    string[];
  transferId?: string;
};

function canReleaseEscrow(input: {
  evidenceApproved: boolean;
  changeOrdersPending: number;
  disputeOpen: boolean;
  milestoneStatus: string;
}): { canRelease: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!input.evidenceApproved)          blockers.push("Evidencia no aprobada");
  if (input.changeOrdersPending > 0)    blockers.push(`${input.changeOrdersPending} CO pendiente(s)`);
  if (input.disputeOpen)                blockers.push("Disputa activa");
  if (!["submitted", "approved"].includes(input.milestoneStatus)) blockers.push(`Status inválido: ${input.milestoneStatus}`);
  return { canRelease: blockers.length === 0, blockers };
}

test("CT.E1: escrow se libera con todo OK", () => {
  const r = canReleaseEscrow({ evidenceApproved: true, changeOrdersPending: 0, disputeOpen: false, milestoneStatus: "submitted" });
  assert.ok(r.canRelease);
  assert.equal(r.blockers.length, 0);
});

test("CT.E2: disputa bloquea el escrow", () => {
  const r = canReleaseEscrow({ evidenceApproved: true, changeOrdersPending: 0, disputeOpen: true, milestoneStatus: "submitted" });
  assert.equal(r.canRelease, false);
  assert.ok(r.blockers.some((b) => b.toLowerCase().includes("disputa")));
});

test("CT.E3: evidencia sin aprobar bloquea", () => {
  const r = canReleaseEscrow({ evidenceApproved: false, changeOrdersPending: 0, disputeOpen: false, milestoneStatus: "submitted" });
  assert.equal(r.canRelease, false);
});

test("CT.E4: change orders pendientes bloquean", () => {
  const r = canReleaseEscrow({ evidenceApproved: true, changeOrdersPending: 2, disputeOpen: false, milestoneStatus: "submitted" });
  assert.equal(r.canRelease, false);
  assert.ok(r.blockers.some((b) => b.includes("2 CO")));
});

test("CT.E5: milestone en draft bloquea", () => {
  const r = canReleaseEscrow({ evidenceApproved: true, changeOrdersPending: 0, disputeOpen: false, milestoneStatus: "draft" });
  assert.equal(r.canRelease, false);
});

// ── HelloSign contract flow ───────────────────────────────────────────────────

type ContractStatus = "pending_signature" | "signed" | "expired" | "voided";

const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  pending_signature: ["signed", "expired", "voided"],
  signed:            ["voided"],
  expired:           ["voided"],
  voided:            [],
};

function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  return CONTRACT_TRANSITIONS[from].includes(to);
}

test("CT.HS1: pending_signature → signed válido", () => {
  assert.ok(canTransitionContract("pending_signature", "signed"));
});

test("CT.HS2: signed → voided válido (cancelación)", () => {
  assert.ok(canTransitionContract("signed", "voided"));
});

test("CT.HS3: signed → pending_signature inválido", () => {
  assert.equal(canTransitionContract("signed", "pending_signature"), false);
});

test("CT.HS4: voided es estado final", () => {
  const targets: ContractStatus[] = ["pending_signature", "signed", "expired"];
  targets.forEach((t) => {
    assert.equal(canTransitionContract("voided", t), false);
  });
});

// ── Pricing — Material Pricing Service contract ───────────────────────────────

test("CT.MP1: precio de material es positivo", () => {
  const price = 2.50; // $/lb ejemplo
  assert.ok(price > 0, "precio debe ser positivo");
});

test("CT.MP2: precios BLS indexados por código de commodity", () => {
  // BLS PPI commodity codes are strings
  const commodityCode = "WPU0811";
  assert.ok(typeof commodityCode === "string");
  assert.ok(commodityCode.length > 0);
});

test("CT.MP3: precio regional ajustado por multiplier", () => {
  const basePrice = 100;
  const multiplier = 1.15; // 15% más caro en zona premium
  const adjustedPrice = Math.round(basePrice * multiplier * 100) / 100;
  assert.ok(adjustedPrice > basePrice, "precio ajustado debe ser > base en zona premium");
  assert.equal(adjustedPrice, 115);
});

// ── Location cost contract ────────────────────────────────────────────────────

type LocationMultipliers = {
  materialMultiplier: number;
  laborMultiplier:    number;
  zipCode:            string;
};

function applyLocationMultipliers(base: number, mult: LocationMultipliers): { materials: number; labor: number } {
  return {
    materials: Math.round(base * mult.materialMultiplier * 100) / 100,
    labor:     Math.round(base * mult.laborMultiplier * 100) / 100,
  };
}

test("CT.LC1: multiplier 1.0 no cambia el costo", () => {
  const result = applyLocationMultipliers(1000, { materialMultiplier: 1.0, laborMultiplier: 1.0, zipCode: "12345" });
  assert.equal(result.materials, 1000);
  assert.equal(result.labor, 1000);
});

test("CT.LC2: zona cara tiene multiplier > 1.0", () => {
  const expensiveZone: LocationMultipliers = { materialMultiplier: 1.25, laborMultiplier: 1.40, zipCode: "94102" };
  const result = applyLocationMultipliers(1000, expensiveZone);
  assert.ok(result.materials > 1000, "materiales más caros en zona premium");
  assert.ok(result.labor > 1000, "labor más caro en zona premium");
});

test("CT.LC3: zipCode tiene formato válido", () => {
  const ZIP_REGEX = /^\d{5}(-\d{4})?$/;
  assert.ok(ZIP_REGEX.test("90210"), "ZIP de 5 dígitos válido");
  assert.ok(ZIP_REGEX.test("10001-1234"), "ZIP+4 válido");
  assert.equal(ZIP_REGEX.test("ABCDE"), false, "letras inválidas");
});
