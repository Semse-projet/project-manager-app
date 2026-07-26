import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseSafePayoutMethodPayload } from "../../apps/web/lib/payout-method-security.ts";

const payoutFormSource = readFileSync(
  "apps/web/app/components/payments/PayoutMethodForm.tsx",
  "utf8",
);
const bffSource = readFileSync(
  "apps/web/app/api/semse/workers/payout-method/route.ts",
  "utf8",
);
const apiControllerSource = readFileSync(
  "apps/api/src/modules/payments/payments.controller.ts",
  "utf8",
);

test("manual payout payload accepts only non-sensitive identifiers", () => {
  assert.deepEqual(
    parseSafePayoutMethodPayload({
      type: "paypal",
      email: "worker@example.com",
    }),
    {
      ok: true,
      data: {
        type: "paypal",
        email: "worker@example.com",
      },
    },
  );
});

test("bank, card and extra financial fields fail closed", () => {
  for (const payload of [
    { type: "bank_account", email: "ignored" },
    { type: "debit_card", email: "ignored" },
    { type: "paypal", email: "worker@example.com", routingNumber: "123456789" },
    { type: "paypal", email: "worker@example.com", accountNumber: "123456789012" },
    { type: "paypal", email: "worker@example.com", cardNumber: "4111111111111111" },
  ]) {
    assert.equal(parseSafePayoutMethodPayload(payload).ok, false);
  }
});

test("web form no longer renders or serializes direct financial credentials", () => {
  assert.match(payoutFormSource, /Captura financiera directa deshabilitada/);
  assert.match(payoutFormSource, /Stripe Connect/);
  assert.doesNotMatch(payoutFormSource, /payout-routing/);
  assert.doesNotMatch(payoutFormSource, /payout-account/);
  assert.doesNotMatch(payoutFormSource, /payout-card-number/);
  assert.doesNotMatch(payoutFormSource, /routingNumber/);
  assert.doesNotMatch(payoutFormSource, /accountNumber/);
  assert.doesNotMatch(payoutFormSource, /cardNumber/);
});

test("BFF and API both enforce the reduced payload", () => {
  assert.match(bffSource, /parseSafePayoutMethodPayload/);
  assert.match(bffSource, /JSON\.stringify\(parsed\.data\)/);
  assert.match(apiControllerSource, /z\.enum\(\["paypal", "zelle", "cashapp"\]\)/);
  assert.match(apiControllerSource, /\.strict\(\)/);
  assert.doesNotMatch(apiControllerSource, /routingNumber/);
  assert.doesNotMatch(apiControllerSource, /accountNumber/);
});
