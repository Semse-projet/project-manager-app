import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import {
  ReleaseGovernanceGate,
  isWaiverGateEnabled,
  resolveReleaseGovernanceMode,
} from "../dist/modules/payments/release-governance.gate.js";
import { PaymentsService } from "../dist/modules/payments/payments.service.js";

// C27/C28 (ADR-041): manual/agent release must apply the same economic
// authorization as auto-release. Waiver gate enforced by default; full
// governance in shadow (observe) or enforce (block) mode; env = rollback.

const actor = { tenantId: "t1", orgId: "o1", userId: "u1", roles: ["OPS_ADMIN"] };
const input = { actor, milestoneId: "m1", projectId: "p1", amount: 100, source: "manual" as const };

function build(opts: { waiver?: { approved: boolean; reason?: string }; governance?: { canRelease: boolean; blockers: string[] } | Error }) {
  const calls: string[] = [];
  const governance = {
    async evaluate() {
      calls.push("evaluate");
      if (opts.governance instanceof Error) throw opts.governance;
      return opts.governance ?? { canRelease: true, blockers: [] };
    },
  };
  const waiverGate = {
    async authorizeRelease() {
      calls.push("waiver");
      return opts.waiver ?? { approved: true };
    },
  };
  return { gate: new ReleaseGovernanceGate(governance as never, waiverGate as never), calls };
}

test("mode resolution: default shadow; off/enforce explicit; garbage => shadow", () => {
  assert.equal(resolveReleaseGovernanceMode({}), "shadow");
  assert.equal(resolveReleaseGovernanceMode({ PAYMENTS_RELEASE_GOVERNANCE_MODE: "ENFORCE" }), "enforce");
  assert.equal(resolveReleaseGovernanceMode({ PAYMENTS_RELEASE_GOVERNANCE_MODE: "off" }), "off");
  assert.equal(resolveReleaseGovernanceMode({ PAYMENTS_RELEASE_GOVERNANCE_MODE: "whatever" }), "shadow");
});

test("waiver gate: enabled by default, only 'off' disables it", () => {
  assert.equal(isWaiverGateEnabled({}), true);
  assert.equal(isWaiverGateEnabled({ PAYMENTS_RELEASE_WAIVER_GATE: "on" }), true);
  assert.equal(isWaiverGateEnabled({ PAYMENTS_RELEASE_WAIVER_GATE: "OFF" }), false);
});

test("pending waiver blocks release by default, before anything else", async () => {
  const { gate, calls } = build({ waiver: { approved: false, reason: "Lien waiver required (TX)" } });
  await assert.rejects(gate.assertReleasable(input, {}), (e: Error) => e instanceof ConflictException && /Lien waiver required/.test(e.message));
  assert.deepEqual(calls, ["waiver"]);
});

test("waiver kill switch skips only the waiver gate", async () => {
  const { gate, calls } = build({ waiver: { approved: false } });
  await gate.assertReleasable(input, { PAYMENTS_RELEASE_WAIVER_GATE: "off", PAYMENTS_RELEASE_GOVERNANCE_MODE: "off" });
  assert.deepEqual(calls, []);
});

test("shadow (default): governance blockers are observed, never block", async () => {
  const { gate, calls } = build({ governance: { canRelease: false, blockers: ["2 change order candidate(s) pending"] } });
  await gate.assertReleasable(input, {});
  assert.deepEqual(calls, ["waiver", "evaluate"]);
});

test("shadow: an evaluate() error never affects the release", async () => {
  const { gate } = build({ governance: new Error("db down") });
  await gate.assertReleasable(input, {});
});

test("enforce: governance blockers block with the blocker list", async () => {
  const { gate } = build({ governance: { canRelease: false, blockers: ["critical signal open"] } });
  await assert.rejects(
    gate.assertReleasable(input, { PAYMENTS_RELEASE_GOVERNANCE_MODE: "enforce" }),
    (e: any) => e instanceof ConflictException && JSON.stringify(e.getResponse()).includes("critical signal open"),
  );
});

test("enforce: fails closed when evaluate() errors", async () => {
  const { gate } = build({ governance: new Error("db down") });
  await assert.rejects(gate.assertReleasable(input, { PAYMENTS_RELEASE_GOVERNANCE_MODE: "enforce" }), /db down/);
});

test("enforce: clean governance lets the release proceed", async () => {
  const { gate } = build({});
  await gate.assertReleasable(input, { PAYMENTS_RELEASE_GOVERNANCE_MODE: "enforce" });
});

test("off: no governance evaluation at all", async () => {
  const { gate, calls } = build({});
  await gate.assertReleasable(input, { PAYMENTS_RELEASE_GOVERNANCE_MODE: "off" });
  assert.deepEqual(calls, ["waiver"]);
});

// Integration with PaymentsService.release(): the gate runs before any money moves.
test("PaymentsService.release: a blocking gate stops the release before funds are reserved", async () => {
  let reserved = 0;
  const repo: Record<string, unknown> = {
    async ensureMilestone() { return { id: "m1", projectId: "p1", status: "APPROVED", amount: 100 }; },
    async ensureProject() { return { id: "p1", jobId: "j1" }; },
    async hasOpenDisputeForProject() { return false; },
    async findEscrowByProject() { return { id: "e1", currency: "usd" }; },
    async getDepositedAmount() { return 1000; },
    async getReleasedAmount() { return 0; },
    async getRefundedAmount() { return 0; },
    async releaseFunds() { reserved++; return { id: "tx1" }; },
  };
  const contracts = { async findCurrentByJob() { return { id: "c1", signedClientAt: new Date(), signedProAt: new Date() }; } };
  const gate = { async assertReleasable() { throw new ConflictException("blocked by gate"); } };
  const service = new (PaymentsService as any)(
    repo, {}, { resolve: () => ({}) }, {}, contracts, {}, {}, undefined, undefined, undefined, undefined, undefined, gate,
  );
  await assert.rejects(
    service.release({ tenantId: "t1", orgId: "o1", userId: "u1", roles: ["OPS_ADMIN"], milestoneId: "m1", requestId: "r1" }),
    /blocked by gate/,
  );
  assert.equal(reserved, 0);
});
