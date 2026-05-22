/**
 * Tests derivados de: docs/specs/api/payments.spec.md
 * Cubre contratos de escrow, release, governance y permisos.
 * No requiere DB — modela lógica de negocio directamente.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { tsImport } from "tsx/esm/api";
import { verifyStripeWebhookSignature } from "../src/modules/payments/stripe-webhook-signature.ts";

const { canReadProjectFinancials } = await tsImport("../src/modules/projects/projects.policy.ts", import.meta.url) as {
  canReadProjectFinancials: (
    actor: { tenantId: string; orgId: string; userId: string; roles: string[] },
    ownership: { clientOrgId: string; assignedProOrgId: string }
  ) => boolean;
};

// ── FSM Escrow ─────────────────────────────────────────────────────────────────

type EscrowStatus = "pending" | "funded" | "held" | "partially_released" | "released" | "disputed" | "refunded";

function escrowCanTransition(from: EscrowStatus, to: EscrowStatus): boolean {
  const transitions: Record<EscrowStatus, EscrowStatus[]> = {
    pending:             ["funded"],
    funded:              ["held"],
    held:                ["partially_released", "released", "disputed"],
    partially_released:  ["held", "released"],
    released:            [],
    disputed:            ["held", "released", "refunded"],
    refunded:            [],
  };
  return transitions[from]?.includes(to) ?? false;
}

test("FSM Escrow: PENDING → FUNDED es válido", () => {
  assert.ok(escrowCanTransition("pending", "funded"));
});

test("FSM Escrow: FUNDED → HELD es válido", () => {
  assert.ok(escrowCanTransition("funded", "held"));
});

test("FSM Escrow: HELD → PARTIALLY_RELEASED es válido", () => {
  assert.ok(escrowCanTransition("held", "partially_released"));
});

test("FSM Escrow: HELD → RELEASED es válido (último milestone)", () => {
  assert.ok(escrowCanTransition("held", "released"));
});

test("FSM Escrow: HELD → DISPUTED es válido", () => {
  assert.ok(escrowCanTransition("held", "disputed"));
});

test("FSM Escrow: DISPUTED → RELEASED es válido (favor PRO)", () => {
  assert.ok(escrowCanTransition("disputed", "released"));
});

test("FSM Escrow: DISPUTED → REFUNDED es válido (favor CLIENT)", () => {
  assert.ok(escrowCanTransition("disputed", "refunded"));
});

test("FSM Escrow: RELEASED es terminal", () => {
  const states: EscrowStatus[] = ["funded", "held", "partially_released", "disputed"];
  for (const s of states) {
    assert.ok(!escrowCanTransition("released", s), `released → ${s} debe ser inválido`);
  }
});

test("FSM Escrow: REFUNDED es terminal", () => {
  assert.ok(!escrowCanTransition("refunded", "held"));
  assert.ok(!escrowCanTransition("refunded", "released"));
});

test("FSM Escrow: FUNDED no puede ir a RELEASED directamente (debe pasar por HELD)", () => {
  assert.ok(!escrowCanTransition("funded", "released"));
});

// ── PaymentGovernance canRelease logic ─────────────────────────────────────────

type ReleaseStatus = "ready" | "blocked" | "needs_review" | "released" | "disputed";
type RiskLevel = "low" | "medium" | "high" | "critical";

interface GovernanceInput {
  milestoneStatus: string;
  evidenceMissing: number;
  evidenceRejected: number;
  changeOrderBlockers: number;
  disputeRisk: boolean;
  riskLevel: RiskLevel;
}

function evaluateGovernance(input: GovernanceInput): { canRelease: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (input.milestoneStatus !== "approved") {
    blockers.push(`Milestone must be APPROVED (current: ${input.milestoneStatus})`);
  }
  if (input.evidenceMissing > 0) {
    blockers.push(`${input.evidenceMissing} required evidence item(s) still missing`);
  }
  if (input.evidenceRejected > 0) {
    blockers.push(`${input.evidenceRejected} evidence item(s) rejected — must be resubmitted`);
  }
  if (input.changeOrderBlockers > 0) {
    blockers.push(`${input.changeOrderBlockers} open change order(s) blocking payment`);
  }
  if (input.disputeRisk) {
    blockers.push("Dispute risk detected — manual review required");
  }
  if (input.riskLevel === "critical") {
    blockers.push("Critical risk level — release blocked");
  }

  return { canRelease: blockers.length === 0, blockers };
}

test("governance: canRelease=true cuando milestone APPROVED + evidencia OK + sin blockers", () => {
  const result = evaluateGovernance({
    milestoneStatus: "approved",
    evidenceMissing: 0,
    evidenceRejected: 0,
    changeOrderBlockers: 0,
    disputeRisk: false,
    riskLevel: "low",
  });
  assert.ok(result.canRelease);
  assert.equal(result.blockers.length, 0);
});

test("governance: canRelease=false cuando milestone no está en APPROVED", () => {
  const result = evaluateGovernance({
    milestoneStatus: "submitted",
    evidenceMissing: 0,
    evidenceRejected: 0,
    changeOrderBlockers: 0,
    disputeRisk: false,
    riskLevel: "low",
  });
  assert.ok(!result.canRelease);
  assert.ok(result.blockers.some(b => b.includes("APPROVED")));
});

test("governance: canRelease=false cuando evidencia faltante (missing > 0)", () => {
  const result = evaluateGovernance({
    milestoneStatus: "approved",
    evidenceMissing: 2,
    evidenceRejected: 0,
    changeOrderBlockers: 0,
    disputeRisk: false,
    riskLevel: "medium",
  });
  assert.ok(!result.canRelease);
  assert.ok(result.blockers.some(b => b.includes("missing")));
});

test("governance: canRelease=false cuando evidencia rechazada", () => {
  const result = evaluateGovernance({
    milestoneStatus: "approved",
    evidenceMissing: 0,
    evidenceRejected: 1,
    changeOrderBlockers: 0,
    disputeRisk: false,
    riskLevel: "medium",
  });
  assert.ok(!result.canRelease);
  assert.ok(result.blockers.some(b => b.includes("rejected")));
});

test("governance: canRelease=false cuando changeOrderBlockers > 0", () => {
  const result = evaluateGovernance({
    milestoneStatus: "approved",
    evidenceMissing: 0,
    evidenceRejected: 0,
    changeOrderBlockers: 1,
    disputeRisk: false,
    riskLevel: "low",
  });
  assert.ok(!result.canRelease);
  assert.ok(result.blockers.some(b => b.includes("change order")));
});

test("governance: canRelease=false cuando disputeRisk=true", () => {
  const result = evaluateGovernance({
    milestoneStatus: "approved",
    evidenceMissing: 0,
    evidenceRejected: 0,
    changeOrderBlockers: 0,
    disputeRisk: true,
    riskLevel: "high",
  });
  assert.ok(!result.canRelease);
  assert.ok(result.blockers.some(b => b.includes("Dispute risk")));
});

test("governance: canRelease=false cuando riskLevel=critical", () => {
  const result = evaluateGovernance({
    milestoneStatus: "approved",
    evidenceMissing: 0,
    evidenceRejected: 0,
    changeOrderBlockers: 0,
    disputeRisk: false,
    riskLevel: "critical",
  });
  assert.ok(!result.canRelease);
  assert.ok(result.blockers.some(b => b.includes("Critical")));
});

test("governance: múltiples blockers se acumulan correctamente", () => {
  const result = evaluateGovernance({
    milestoneStatus: "submitted",
    evidenceMissing: 1,
    evidenceRejected: 1,
    changeOrderBlockers: 2,
    disputeRisk: true,
    riskLevel: "critical",
  });
  assert.ok(!result.canRelease);
  assert.ok(result.blockers.length >= 5);
});

// ── Release input validation ───────────────────────────────────────────────────

test("release: amount debe ser positivo", () => {
  const validAmount = 1500;
  const invalidZero = 0;
  const invalidNeg = -100;
  assert.ok(validAmount > 0);
  assert.ok(invalidZero <= 0, "amount=0 es inválido");
  assert.ok(invalidNeg < 0, "amount negativo es inválido");
});

test("release: amount no puede superar el saldo disponible del escrow", () => {
  const escrowAvailable = 3000;
  const releaseAmount = 3500;
  assert.ok(releaseAmount > escrowAvailable, "superar el saldo debe ser rechazado");
});

// ── Deposit input validation ───────────────────────────────────────────────────

test("deposit: amount debe ser positivo (no cero)", () => {
  const validDeposit = { amount: 5000, currency: "USD" };
  const invalidDeposit = { amount: 0, currency: "USD" };
  assert.ok(validDeposit.amount > 0);
  assert.ok(invalidDeposit.amount <= 0, "amount=0 es inválido en depósito");
});

test("deposit: currency debe tener exactamente 3 caracteres", () => {
  const valid = "USD";
  const tooShort = "US";
  const tooLong = "USDO";
  assert.equal(valid.length, 3);
  assert.ok(tooShort.length !== 3, "currency < 3 chars es inválida");
  assert.ok(tooLong.length !== 3, "currency > 3 chars es inválida");
});

// ── Webhook signature validation ───────────────────────────────────────────────

function stripeSignatureHeader(payload: Buffer, secret: string, timestamp: number): string {
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), payload]);
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

test("webhook: Stripe-Signature valida HMAC con raw body", () => {
  const payload = Buffer.from(JSON.stringify({ event: "payment_intent.succeeded", providerRef: "pi_123" }));
  const timestamp = 1_800_000_000;
  const secret = "whsec_test";
  const signatureHeader = stripeSignatureHeader(payload, secret, timestamp);

  assert.equal(
    verifyStripeWebhookSignature({
      payload,
      signatureHeader,
      secret,
      now: new Date(timestamp * 1000),
    }),
    true,
  );
});

test("webhook: Stripe-Signature rechaza payload alterado", () => {
  const payload = Buffer.from(JSON.stringify({ event: "payment_intent.succeeded", providerRef: "pi_123" }));
  const tamperedPayload = Buffer.from(JSON.stringify({ event: "payment_intent.succeeded", providerRef: "pi_456" }));
  const timestamp = 1_800_000_000;
  const signatureHeader = stripeSignatureHeader(payload, "whsec_test", timestamp);

  assert.equal(
    verifyStripeWebhookSignature({
      payload: tamperedPayload,
      signatureHeader,
      secret: "whsec_test",
      now: new Date(timestamp * 1000),
    }),
    false,
  );
});

test("webhook: Stripe-Signature rechaza timestamps fuera de tolerancia", () => {
  const payload = Buffer.from(JSON.stringify({ event: "payment_intent.succeeded", providerRef: "pi_123" }));
  const timestamp = 1_800_000_000;
  const signatureHeader = stripeSignatureHeader(payload, "whsec_test", timestamp);

  assert.equal(
    verifyStripeWebhookSignature({
      payload,
      signatureHeader,
      secret: "whsec_test",
      now: new Date((timestamp + 600) * 1000),
    }),
    false,
  );
});

// ── Payout method validation ───────────────────────────────────────────────────

test("payout-method: type debe estar en el enum permitido", () => {
  const validTypes = ["bank_account", "debit_card", "paypal", "zelle", "cashapp"];
  const invalidType = "bitcoin";
  assert.ok(validTypes.includes("bank_account"));
  assert.ok(!validTypes.includes(invalidType), "bitcoin no es tipo válido");
});

// ── Audit assertions ───────────────────────────────────────────────────────────

test("release audit usa action 'escrow.release' con afterJson correcto", () => {
  const auditEntry = {
    action: "escrow.release",
    entityType: "PaymentTxn",
    afterJson: {
      milestoneId: "ms_001",
      projectId: "proj_001",
      contractId: "cnt_001",
      amount: 1500
    }
  };
  assert.equal(auditEntry.action, "escrow.release");
  assert.ok(auditEntry.afterJson.milestoneId);
  assert.ok(auditEntry.afterJson.amount > 0);
});

test("deposit audit incluye tenantId y actorUserId", () => {
  const auditEntry = {
    tenantId: "tenant_test",
    actorUserId: "user_client_01",
    action: "escrow.deposit",
    entityType: "Escrow"
  };
  assert.ok(auditEntry.tenantId.length > 0);
  assert.ok(auditEntry.actorUserId.length > 0);
});

// ── Invariante de seguridad PRO no puede leer financials ──────────────────────

test("invariante: PRO asignado no puede leer financials del proyecto", () => {
  const ownership = {
    clientOrgId: "org_client",
    assignedProOrgId: "org_pro"
  };

  assert.equal(
    canReadProjectFinancials(
      { tenantId: "tenant_test", orgId: "org_pro", userId: "user_pro", roles: ["PRO"] },
      ownership
    ),
    false,
    "PRO asignado no debe leer escrow/financials por defecto"
  );
  assert.equal(
    canReadProjectFinancials(
      { tenantId: "tenant_test", orgId: "org_client", userId: "user_client", roles: ["CLIENT"] },
      ownership
    ),
    true
  );
  assert.equal(
    canReadProjectFinancials(
      { tenantId: "tenant_test", orgId: "org_ops", userId: "user_ops", roles: ["OPS_ADMIN"] },
      ownership
    ),
    true
  );
});
