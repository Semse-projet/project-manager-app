import test from "node:test";
import assert from "node:assert/strict";

import { deliverSatelliteWebhook } from "../dist/modules/satellites/satellite-webhook-delivery.js";

// SAT-007 spec §8 point 2 — DNS rebinding defense: deliverSatelliteWebhook
// re-validates the URL immediately before every connection attempt, not
// only at registration time. A loopback/private target must always be
// rejected here regardless of what passed SSRF validation at registration.

test("deliverSatelliteWebhook rejects a loopback URL at delivery time (DNS rebinding defense)", async () => {
  const outcome = await deliverSatelliteWebhook(
    "https://127.0.0.1/hook",
    JSON.stringify({ event: "job.matched" }),
    "sha256=deadbeef",
  );
  assert.equal(outcome.delivered, false);
  assert.ok(!outcome.delivered && outcome.reason.startsWith("ssrf_rejected:"));
});

test("deliverSatelliteWebhook rejects a non-https URL", async () => {
  const outcome = await deliverSatelliteWebhook(
    "http://example.com/hook",
    JSON.stringify({ event: "job.matched" }),
    "sha256=deadbeef",
  );
  assert.equal(outcome.delivered, false);
  assert.ok(!outcome.delivered && outcome.reason === "ssrf_rejected:scheme_must_be_https");
});

test("deliverSatelliteWebhook rejects a private-range IPv6 target (unique local)", async () => {
  const outcome = await deliverSatelliteWebhook(
    "https://[fd00::1]/hook",
    JSON.stringify({ event: "job.matched" }),
    "sha256=deadbeef",
  );
  assert.equal(outcome.delivered, false);
  assert.ok(!outcome.delivered && outcome.reason.startsWith("ssrf_rejected:"));
});
