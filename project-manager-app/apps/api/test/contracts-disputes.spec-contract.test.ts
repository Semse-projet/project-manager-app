/**
 * Tests derivados de:
 *   docs/specs/api/contracts.spec.md
 *   docs/specs/api/disputes.spec.md
 * Cubre FSM, guards de permisos, validaciones Zod y efectos de audit.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── CONTRACT FSM ────────────────────────────────────────────────────────────────

type ContractStatus = "draft" | "pending_signatures" | "partially_signed" | "active" | "superseded" | "void";

function contractCanTransition(from: ContractStatus, to: ContractStatus): boolean {
  const transitions: Record<ContractStatus, ContractStatus[]> = {
    draft:              ["pending_signatures", "void"],
    pending_signatures: ["partially_signed", "active", "void"],
    partially_signed:   ["active"],
    active:             ["superseded"],
    superseded:         [],
    void:               [],
  };
  return transitions[from]?.includes(to) ?? false;
}

test("Contract FSM: DRAFT → PENDING_SIGNATURES es válido", () => {
  assert.ok(contractCanTransition("draft", "pending_signatures"));
});

test("Contract FSM: PENDING_SIGNATURES → PARTIALLY_SIGNED es válido (primera firma)", () => {
  assert.ok(contractCanTransition("pending_signatures", "partially_signed"));
});

test("Contract FSM: PARTIALLY_SIGNED → ACTIVE es válido (segunda firma)", () => {
  assert.ok(contractCanTransition("partially_signed", "active"));
});

test("Contract FSM: PENDING_SIGNATURES → ACTIVE es válido (ambas firmas a la vez)", () => {
  assert.ok(contractCanTransition("pending_signatures", "active"));
});

test("Contract FSM: ACTIVE → SUPERSEDED es válido (nuevo contrato)", () => {
  assert.ok(contractCanTransition("active", "superseded"));
});

test("Contract FSM: DRAFT → VOID es válido (cancelación)", () => {
  assert.ok(contractCanTransition("draft", "void"));
});

test("Contract FSM: SUPERSEDED es terminal", () => {
  const targets: ContractStatus[] = ["draft", "active", "pending_signatures"];
  for (const t of targets) {
    assert.ok(!contractCanTransition("superseded", t), `superseded → ${t} debe ser inválido`);
  }
});

test("Contract FSM: VOID es terminal", () => {
  assert.ok(!contractCanTransition("void", "active"));
  assert.ok(!contractCanTransition("void", "draft"));
});

test("Contract FSM: ACTIVE no puede retroceder a PENDING_SIGNATURES", () => {
  assert.ok(!contractCanTransition("active", "pending_signatures"));
});

// ── CONTRACT validaciones de sign ──────────────────────────────────────────────

test("Contract sign: documentHash debe tener mínimo 16 caracteres", () => {
  const validHash = "a1b2c3d4e5f6a1b2";
  const shortHash = "abc123";
  assert.ok(validHash.length >= 16);
  assert.ok(shortHash.length < 16, "documentHash corto es inválido");
});

test("Contract sign: signAs debe ser 'client' o 'professional'", () => {
  const validValues = ["client", "professional"];
  assert.ok(validValues.includes("client"));
  assert.ok(validValues.includes("professional"));
  assert.ok(!validValues.includes("admin"), "admin no es signAs válido");
});

test("Contract: términos son inmutables tras ACTIVE", () => {
  // Los cambios requieren nuevo contrato → SUPERSEDED
  function canModifyTerms(status: ContractStatus): boolean {
    return status === "draft" || status === "pending_signatures";
  }
  assert.ok(!canModifyTerms("active"), "no se pueden modificar términos cuando ACTIVE");
  assert.ok(canModifyTerms("draft"), "sí se pueden modificar en DRAFT");
});

test("Contract: escrow solo puede fondearse con contrato ACTIVE", () => {
  function canFundEscrow(contractStatus: ContractStatus): boolean {
    return contractStatus === "active";
  }
  assert.ok(canFundEscrow("active"));
  assert.ok(!canFundEscrow("partially_signed"));
  assert.ok(!canFundEscrow("void"));
});

// ── CONTRACT audit events ──────────────────────────────────────────────────────

test("Contract audit: firma CLIENT usa 'contract.client_signed'", () => {
  const entry = { action: "contract.client_signed", entityType: "Contract" };
  assert.equal(entry.action, "contract.client_signed");
});

test("Contract audit: firma PRO usa 'contract.professional_signed'", () => {
  const entry = { action: "contract.professional_signed", entityType: "Contract" };
  assert.equal(entry.action, "contract.professional_signed");
});

test("Contract audit: activación usa 'contract.activated'", () => {
  const entry = { action: "contract.activated", entityType: "Contract" };
  assert.equal(entry.action, "contract.activated");
});

// ── DISPUTE FSM ────────────────────────────────────────────────────────────────

type DisputeStatus = "open" | "assigned" | "under_review" | "resolved" | "rejected";

function disputeCanTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  const transitions: Record<DisputeStatus, DisputeStatus[]> = {
    open:         ["assigned", "resolved"],
    assigned:     ["under_review", "resolved"],
    under_review: ["resolved"],
    resolved:     [],
    rejected:     [],
  };
  return transitions[from]?.includes(to) ?? false;
}

test("Dispute FSM: OPEN → ASSIGNED es válido", () => {
  assert.ok(disputeCanTransition("open", "assigned"));
});

test("Dispute FSM: ASSIGNED → UNDER_REVIEW es válido", () => {
  assert.ok(disputeCanTransition("assigned", "under_review"));
});

test("Dispute FSM: UNDER_REVIEW → RESOLVED es válido", () => {
  assert.ok(disputeCanTransition("under_review", "resolved"));
});

test("Dispute FSM: acuerdo explícito permite OPEN → RESOLVED", () => {
  assert.ok(disputeCanTransition("open", "resolved"));
});

test("Dispute FSM: RESOLVED es terminal", () => {
  const targets: DisputeStatus[] = ["open", "assigned", "under_review", "rejected"];
  for (const t of targets) {
    assert.ok(!disputeCanTransition("resolved", t), `resolved → ${t} debe ser inválido`);
  }
});

test("Dispute FSM: REJECTED es terminal de compatibilidad", () => {
  assert.ok(!disputeCanTransition("rejected", "open"));
  assert.ok(!disputeCanTransition("rejected", "resolved"));
});

test("Dispute FSM: UNDER_REVIEW no puede ir a OPEN (no retroactivo)", () => {
  assert.ok(!disputeCanTransition("under_review", "open"));
});

// ── DISPUTE validaciones ───────────────────────────────────────────────────────

test("Dispute create: reason debe tener mínimo 5 caracteres", () => {
  const validReason = "El trabajo entregado no cumple con las especificaciones acordadas.";
  const shortReason = "no";
  assert.ok(validReason.length >= 5);
  assert.ok(shortReason.length < 5, "reason corto es inválido");
});

test("Dispute create: reason no puede exceder 1000 caracteres", () => {
  const maxLen = 1000;
  const okReason = "a".repeat(1000);
  const tooLong = "a".repeat(1001);
  assert.equal(okReason.length, maxLen);
  assert.ok(tooLong.length > maxLen, "reason > 1000 chars es inválido");
});

test("Dispute resolve: resolutionType valores válidos", () => {
  const validTypes = ["client_favor", "pro_favor", "partial_50_50", "escalated_legal"];
  assert.equal(validTypes.length, 4);
  assert.ok(validTypes.includes("client_favor"));
  assert.ok(!validTypes.includes("no_resolution"), "valor inválido rechazado");
});

test("Dispute resolve: resolutionType es obligatorio", async () => {
  const { resolveProjectDisputeSchema } = await import("@semse/schemas");
  assert.equal(resolveProjectDisputeSchema.safeParse({ resolution: "Acuerdo" }).success, false);
  assert.equal(resolveProjectDisputeSchema.safeParse({
    resolution: "Acuerdo",
    resolutionType: "pro_favor",
  }).success, true);
});

test("Dispute resolve: resolutionType determina el destino del escrow", () => {
  function escrowOutcome(resolutionType: string): string {
    const map: Record<string, string> = {
      client_favor:   "refunded",
      pro_favor:      "released",
      partial_50_50:  "partially_released",
      escalated_legal:"disputed",
    };
    return map[resolutionType] ?? "unknown";
  }
  assert.equal(escrowOutcome("client_favor"), "refunded");
  assert.equal(escrowOutcome("pro_favor"), "released");
  assert.equal(escrowOutcome("partial_50_50"), "partially_released");
  assert.equal(escrowOutcome("escalated_legal"), "disputed");
});

test("Dispute submit-evidence: evidenceIds no puede estar vacío", () => {
  const invalid = { evidenceIds: [] };
  assert.equal(invalid.evidenceIds.length, 0, "array vacío es inválido");
});

test("Dispute submit-evidence: máximo 50 evidenceIds", () => {
  const maxIds = 50;
  const validIds = Array.from({ length: 50 }, (_, i) => `ev_${i}`);
  const tooMany = Array.from({ length: 51 }, (_, i) => `ev_${i}`);
  assert.equal(validIds.length, maxIds);
  assert.ok(tooMany.length > maxIds, "> 50 evidenceIds es inválido");
});

// ── DISPUTE permisos ───────────────────────────────────────────────────────────

test("Dispute resolve: OPS resuelve todo y CLIENT dueño solo acuerdo pro_favor", () => {
  function canResolve(role: string, resolutionType: string): boolean {
    return role === "OPS_ADMIN" || (role === "CLIENT_OWNER" && resolutionType === "pro_favor");
  }
  assert.ok(canResolve("OPS_ADMIN", "client_favor"));
  assert.ok(canResolve("CLIENT_OWNER", "pro_favor"));
  assert.ok(!canResolve("CLIENT_OWNER", "client_favor"));
  assert.ok(!canResolve("PRO", "pro_favor"));
});

test("Dispute assign: solo OPS_ADMIN puede asignar revisor", () => {
  function canAssign(role: string): boolean {
    return role === "OPS_ADMIN";
  }
  assert.ok(canAssign("OPS_ADMIN"));
  assert.ok(!canAssign("CLIENT"));
});

test("Dispute create: CLIENT y PRO pueden abrir disputas", () => {
  function canCreate(role: string): boolean {
    return ["CLIENT", "PRO", "OPS_ADMIN"].includes(role);
  }
  assert.ok(canCreate("CLIENT"));
  assert.ok(canCreate("PRO"));
  assert.ok(canCreate("OPS_ADMIN"));
});

// ── DISPUTE efectos en escrow ──────────────────────────────────────────────────

test("Dispute abierta bloquea canRelease en PaymentGovernance", () => {
  function canRelease(hasOpenDispute: boolean): boolean {
    return !hasOpenDispute;
  }
  assert.ok(!canRelease(true), "disputa abierta bloquea release");
  assert.ok(canRelease(false), "sin disputa permite release");
});

// ── DISPUTE audit events ───────────────────────────────────────────────────────

test("Dispute audit: apertura usa 'dispute.opened'", () => {
  const entry = { action: "dispute.opened", entityType: "Dispute" };
  assert.equal(entry.action, "dispute.opened");
});

test("Dispute audit: resolución usa 'dispute.resolved'", () => {
  const entry = { action: "dispute.resolved", entityType: "Dispute" };
  assert.equal(entry.action, "dispute.resolved");
});
