import test from "node:test";
import assert from "node:assert/strict";
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
