import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const paymentGovernanceServiceUrl = new URL(
  "../../apps/api/src/modules/payment-governance/payment-governance.service.ts",
  import.meta.url,
);
const paymentGovernanceControllerUrl = new URL(
  "../../apps/api/src/modules/payment-governance/payment-governance.controller.ts",
  import.meta.url,
);

// Golden regression: D02 — one canonical payment-release command/path.
//
// KNOWN FAILING — tracked deliberately, not fixed here (out of scope for this
// batch; requires an explicit D02 consolidation decision/ADR, not a
// reconciliation-batch drive-by).
//
// Reality as of this writing: POST /v1/payments/release is live and mounted
// (payment-governance.controller.ts) and calls
// PaymentGovernanceService.releasePayment(), which creates a payment
// transaction row and returns { success: true, message: "Payment released
// successfully" } WITHOUT ever calling Stripe. The only path that actually
// moves money is EscrowReleaseService.tryAutoRelease() (via
// StripeConnectService), which this endpoint does not use. Two independent,
// separately reachable mutation paths exist for "release a payment," and only
// one of them is real. See SEMSE_EXECUTION_LEDGER.md Blockers.
//
// This is `test.todo`, not a passing assertion: per "no fake production
// claims" / "unknown is not safe" (Execution Pack ADR governing principles),
// this suite must not claim the canonical path holds when it doesn't. Marking
// it `todo` keeps the failure visible in CI output without red-blocking an
// unrelated PR on a pre-existing, already-flagged production bug. Flip this
// to a normal `test()` (and to GoldenRegressionStatus.PASSING in the
// golden_regression table) only once releasePayment() is retired or
// delegates to the real Stripe-calling path.
test.todo(
  "payment release has exactly one canonical, Stripe-backed path (D02)",
  async () => {
    const controllerSource = await readFile(paymentGovernanceControllerUrl, "utf8");
    assert.match(
      controllerSource,
      /@Post\(["']release["']\)/,
      "expected POST /v1/payments/release to still be mounted — update this test if the route moved",
    );

    const serviceSource = await readFile(paymentGovernanceServiceUrl, "utf8");
    assert.match(
      serviceSource,
      /EscrowReleaseService/,
      "PaymentGovernanceService.releasePayment() must delegate to the Stripe-backed " +
        "EscrowReleaseService (the only canonical money-moving path) instead of independently " +
        "creating a payment transaction and reporting success without calling Stripe",
    );
  },
);
