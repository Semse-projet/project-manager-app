import test from "node:test";
import assert from "node:assert/strict";
import { ProToolsAgent } from "../dist/modules/semse-agents/protools.agent.js";

const bus = { register() {} };
const example = { trade: "drywall", description: "Drywall", area: 100, rooms: 1 };

function makeAgent(pricing, tools) {
  return new ProToolsAgent(bus, tools, pricing);
}

test("T-008b ProTools: legacy cache is labeled UNVERIFIED and numeric tool inputs are unchanged", async () => {
  const received = [];
  const prices = { "lumber-framing": 1.11 };
  const agent = makeAgent({
    async getCurrentPricesWithProvenance() {
      return {
        prices,
        source: "LEGACY_CACHE_UNVERIFIED",
        provenance: { "lumber-framing": { verification: "UNVERIFIED" } },
      };
    },
  }, {
    calculate(input) { received.push(input); return { riskFlags: [] }; },
  });
  const result = await agent.estimate({ ...example, locale: "en" });
  assert.deepEqual(received[0]?.prices, prices);
  assert.equal(result.pricingEvidence.status, "UNVERIFIED");
  assert.equal(result.pricingEvidence.source, "LEGACY_CACHE_UNVERIFIED");
  assert.equal(result.pricingEvidence.verificationBasis, "NO_COMMERCIAL_PRICE_VALIDATION");
  assert.equal(result.confidenceBasis, "HEURISTIC_NOT_CALIBRATED");
  assert.match(result.riskFlags.join(" "), /not commercially verified/i);
  assert.match(result.agentNote, /tax treatment are preliminary and unverified/i);
  assert.equal(typeof result.totalCost, "number");
});

test("T-008b ProTools: hardcoded fallback remains unverified in Spanish", async () => {
  const result = await makeAgent({
    async getCurrentPricesWithProvenance() {
      return { prices: { "lumber-framing": 0.65 }, source: "HARDCODED_FALLBACK_UNVERIFIED", provenance: {} };
    },
  }).estimate({ ...example, locale: "es" });
  assert.equal(result.pricingEvidence.source, "HARDCODED_FALLBACK_UNVERIFIED");
  assert.equal(result.pricingEvidence.status, "UNVERIFIED");
  assert.match(result.riskFlags.join(" "), /no verificados comercialmente/i);
  assert.match(result.agentNote, /sin validación comercial o fiscal/i);
});

test("T-008b ProTools: pricing read failure cannot claim BLS verification", async () => {
  const received = [];
  const result = await makeAgent({
    async getCurrentPricesWithProvenance() { throw Error("synthetic database outage"); },
  }, {
    calculate(input) { received.push(input); return { riskFlags: [] }; },
  }).estimate(example);
  assert.equal(result.pricingEvidence.source, "PRICING_READ_FAILED");
  assert.deepEqual(received[0]?.prices, {});
  assert.equal(result.pricingEvidence.status, "UNVERIFIED");
  assert.equal(result.confidenceBasis, "HEURISTIC_NOT_CALIBRATED");
});

test("T-008b ProTools: absent pricing dependency cannot look like verified BLS", async () => {
  const result = await makeAgent(undefined).estimate(example);
  assert.equal(result.pricingEvidence.source, "PRICING_NOT_CONFIGURED");
  assert.equal(result.pricingEvidence.status, "UNVERIFIED");
  assert.match(result.riskFlags.join(" "), /no verificados comercialmente/i);
});
