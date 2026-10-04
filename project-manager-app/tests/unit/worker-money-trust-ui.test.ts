import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { connectPayoutPresentation } from "../../apps/web/lib/worker-money-trust-ui.ts";

const stripeProviderSource = readFileSync(
  "apps/api/src/modules/payments/providers/stripe.provider.ts",
  "utf8",
);

test("Connect UI states that known-recipient payouts are blocked until active", () => {
  const missing = connectPayoutPresentation(null, true, 0.0075);
  const restricted = connectPayoutPresentation("restricted", true, 0.0075);

  assert.equal(missing.ready, false);
  assert.match(missing.label, /bloqueados/i);
  assert.match(missing.detail, /no redirige.*cuenta compartida/i);
  assert.equal(restricted.ready, false);
  assert.match(restricted.detail, /restricted/);
});

test("Connect UI only reports automatic payouts as enabled for active status", () => {
  const loading = connectPayoutPresentation(null, false, 0.0075);
  const active = connectPayoutPresentation("active", true, 0.0075);

  assert.equal(loading.ready, false);
  assert.match(loading.label, /verificando/i);
  assert.equal(active.ready, true);
  assert.match(active.label, /habilitados/i);
  assert.match(active.detail, /0\.75%/);
});

test("UI payout copy matches the provider fail-closed boundary", () => {
  const knownRecipientBranch = stripeProviderSource.slice(
    stripeProviderSource.indexOf("if (input.recipientUserId)"),
    stripeProviderSource.indexOf("let providerRef"),
  );

  assert.match(knownRecipientBranch, /no active Stripe Connect account/);
  assert.match(knownRecipientBranch, /Refusing to fall back to the shared platform account/);
  assert.match(knownRecipientBranch, /throw new PayoutFailureError/);
  assert.match(knownRecipientBranch, /"definitive"/);
});
