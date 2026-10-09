import test from "node:test";
import assert from "node:assert/strict";
import { assertContractExecutionVerified } from "../dist/modules/contracts/contract-execution-evidence.gate.js";

const scope = {
  tenantId: "tenant_a", contractId: "contract_a",
  documentVersionSha256: "a".repeat(64),
  clientUserId: "client_a", professionalUserId: "professional_a",
};
const execution = {
  ...scope,
  providerId: "documenso", externalRequestId: "envelope_123",
  signedPdfSha256: "b".repeat(64),
  certificateSha256: "c".repeat(64),
  signedPdfRef: "private/tenant_a/signed.pdf",
  certificateRef: "private/tenant_a/cert.json",
  authorizedPolicyDecisionId: "decision_789",
  verifiedAt: new Date("2026-10-08T20:00:00Z"),
  status: "VERIFIED_EXECUTED" as const,
};

test("unsigned and legacy self-attested contracts cannot satisfy escrow execution gate", () => {
  for (const value of [null, undefined, {
    ...execution, status: "PENDING_VERIFICATION",
    signedClientAt: "2026-10-08T12:00:00Z",
    signedProAt: "2026-10-08T12:02:00Z",
  }]) {
    assert.throws(() => assertContractExecutionVerified(scope, value as never),
      /independently verified contract execution/);
  }
});

test("only a complete, matching independently promoted record passes the pure gate", () => {
  assert.doesNotThrow(() => assertContractExecutionVerified(scope, execution));
});

test("mismatched tenant/contract/version/parties and tampered evidence fail closed", () => {
  for (const patch of [
    { tenantId: "tenant_b" },
    { contractId: "contract_b" },
    { documentVersionSha256: "d".repeat(64) },
    { clientUserId: "attacker" },
    { professionalUserId: "attacker" },
    { signedPdfSha256: "bad" },
    { certificateSha256: "" },
    { authorizedPolicyDecisionId: "" },
    { signedPdfRef: "https://untrusted/cert.pdf" },
    { certificateRef: "//untrusted/cert.pdf" },
    { verifiedAt: new Date("invalid") },
    { status: "REVOKED" },
    { status: "QUARANTINED" },
  ]) {
    assert.throws(() => assertContractExecutionVerified(scope, { ...execution, ...patch } as never),
      /independently verified contract execution/);
  }
});

test("caller-supplied claimed execution cannot override invalid canonical identity", () => {
  assert.throws(() => assertContractExecutionVerified({ ...scope, clientUserId: "" }, execution),
    /independently verified contract execution/);
  assert.throws(() => assertContractExecutionVerified({
    ...scope, documentVersionSha256: "caller_pdf_hash",
  }, execution), /independently verified contract execution/);
});
