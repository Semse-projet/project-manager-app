import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_DOMAIN_IDS,
  createStaticDigitalTwinSnapshot,
} from "../../apps/web/lib/digital-twin/topology-adapter.ts";
import { mergeConsciousnessIntoSnapshot } from "../../apps/web/lib/digital-twin/consciousness-adapter.ts";
import { SEMSE_NEURONS } from "../../apps/web/lib/data/semse-consciousness-topology.ts";

test("adapta los 33 IDs históricos una sola vez a dominios canónicos", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  const historicalIds = Object.keys(SEMSE_NEURONS);

  assert.equal(historicalIds.length, 33);
  assert.equal(snapshot.nodes.length, historicalIds.length);
  assert.deepEqual(
    snapshot.nodes.map((node) => node.id).sort(),
    historicalIds.sort(),
  );
  assert.equal(new Set(snapshot.nodes.map((node) => node.id)).size, 33);
  for (const node of snapshot.nodes) {
    assert.ok(CANONICAL_DOMAIN_IDS.includes(node.canonicalDomain));
    assert.equal(node.runtimeHealth, null);
    assert.equal(node.observedAt, null);
    assert.equal(node.status, "unobserved");
    assert.equal(node.maturity, null);
    assert.equal(node.maturitySource, "not-available");
    assert.deepEqual(node.sources, ["static-topology"]);
  }
  assert.equal(snapshot.topologySource, "static-definition");
  assert.equal(snapshot.globalHealth, null);
});

test("toda arista estática referencia nodos existentes", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  const ids = new Set(snapshot.nodes.map((node) => node.id));
  assert.ok(snapshot.edges.length > 0);
  for (const edge of snapshot.edges) {
    assert.ok(ids.has(edge.source), `source ausente: ${edge.source}`);
    assert.ok(ids.has(edge.target), `target ausente: ${edge.target}`);
    assert.notEqual(edge.source, edge.target);
    assert.ok(edge.strength > 0 && edge.strength <= 1);
  }
});

test("madurez coincidente se etiqueta como registro, nunca como salud runtime", () => {
  const staticSnapshot = createStaticDigitalTwinSnapshot();
  const snapshot = mergeConsciousnessIntoSnapshot(staticSnapshot, {
    generatedAt: "2026-11-15T12:00:00.000Z",
    maturity: {
      byModule: [
        { module: "BuildOps", score: 93, status: "mature", gaps: [] },
        { module: "Payment Governance", score: 81, status: "functional", gaps: ["audit"] },
        { module: "Marketplace Bids", score: 77, status: "functional", gaps: [] },
      ],
    },
    observation: {
      healthScore: 67,
      observedAt: "2026-11-15T11:59:00.000Z",
    },
  });

  const buildops = snapshot.nodes.find((node) => node.id === "buildops");
  const governance = snapshot.nodes.find((node) => node.id === "payment_governance");
  assert.equal(buildops?.maturity, 93);
  assert.equal(buildops?.maturitySource, "consciousness-registry");
  assert.ok(buildops?.sources.includes("consciousness-registry"));
  assert.equal(buildops?.runtimeHealth, null);
  assert.equal(buildops?.observedAt, null);
  assert.equal(buildops?.status, "unobserved");
  assert.equal(governance?.maturity, 81);
  assert.equal(snapshot.globalHealth, 67);
  assert.equal(snapshot.generatedAt, "2026-11-15T12:00:00.000Z");
  assert.equal(snapshot.observedAt, "2026-11-15T11:59:00.000Z");
  assert.deepEqual(snapshot.unmappedMaturityModules, ["Marketplace Bids"]);
});

test("una respuesta parcial conserva topología y degrada sólo la fuente ausente", () => {
  const snapshot = mergeConsciousnessIntoSnapshot(
    createStaticDigitalTwinSnapshot(),
    { maturity: { byModule: null } },
  );
  assert.equal(snapshot.nodes.length, 33);
  assert.equal(snapshot.globalHealth, null);
  assert.equal(snapshot.generatedAt, null);
  assert.equal(snapshot.observedAt, null);
  assert.ok(snapshot.degradedSources.includes("consciousness-registry"));
  assert.ok(snapshot.degradedSources.includes("consciousness-observation"));
  assert.ok(snapshot.nodes.every((node) => node.maturity === null));
});

test("la ruta estática sin fuente no anuncia fuentes degradadas", () => {
  const snapshot = mergeConsciousnessIntoSnapshot(createStaticDigitalTwinSnapshot(), null);
  assert.deepEqual(snapshot.degradedSources, []);
  assert.equal(snapshot.globalHealth, null);
  assert.equal(snapshot.observedAt, null);
  assert.equal(snapshot.nodes.length, 33);
});

test("no copia los valores históricos de energía o madurez como observaciones", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  for (const node of snapshot.nodes) {
    const historical = SEMSE_NEURONS[node.id];
    assert.ok(historical.energy >= 0);
    assert.notEqual(node.runtimeHealth, historical.energy);
    assert.notEqual(node.runtimeHealth, historical.maturity);
    assert.equal(node.observedAt, null);
  }
});
