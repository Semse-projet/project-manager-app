import test from "node:test";
import assert from "node:assert/strict";
import { Logger } from "@nestjs/common";
import { geocodeAddressSafe, isGoogleMapsConfigured } from "../dist/integrations/google-maps.js";

void test("geocodeAddressSafe never throws and returns null without an API key", async () => {
  delete process.env.SEMSE_GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  assert.equal(isGoogleMapsConfigured(), false);

  const result = await geocodeAddressSafe("Av. Reforma 123, CDMX");
  assert.equal(result, null);
});

void test("geocodeAddressSafe returns null for empty/undefined addresses", async () => {
  assert.equal(await geocodeAddressSafe(undefined), null);
  assert.equal(await geocodeAddressSafe(null), null);
  assert.equal(await geocodeAddressSafe("   "), null);
});

void test("geocodeAddressSafe failure logs never include the address or Google's free text", async () => {
  const address = "Calle Ficticia 742, Colonia Prueba";
  const warnings: string[] = [];
  Logger.overrideLogger({
    log() {},
    error() {},
    warn(message: unknown) { warnings.push(String(message)); },
    debug() {},
    verbose() {},
  });
  const originalFetch = globalThis.fetch;
  process.env.SEMSE_GOOGLE_MAPS_API_KEY = "test-key";
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: `Address "${address}" could not be geocoded` } }), { status: 400 })
    ) as typeof fetch;
    assert.equal(await geocodeAddressSafe(address), null);

    globalThis.fetch = (async () => {
      throw new TypeError(`fetch failed for ${address}`);
    }) as typeof fetch;
    assert.equal(await geocodeAddressSafe(address), null);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.SEMSE_GOOGLE_MAPS_API_KEY;
  }

  assert.equal(warnings.length, 2);
  for (const warning of warnings) {
    assert.ok(!warning.includes("Calle Ficticia"), `log leaked the address: ${warning}`);
    assert.ok(!warning.includes("Colonia Prueba"), `log leaked the address: ${warning}`);
  }
  assert.equal(warnings[0], "Geocoding failed: HTTP 400");
  assert.equal(warnings[1], "Geocoding failed: TypeError");
});
