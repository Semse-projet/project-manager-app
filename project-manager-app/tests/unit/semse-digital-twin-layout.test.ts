import test from "node:test";
import assert from "node:assert/strict";
import { createStaticDigitalTwinSnapshot, CANONICAL_DOMAIN_IDS } from "../../apps/web/lib/digital-twin/topology-adapter.ts";
import { createDigitalTwinLayout, createDomainLayout } from "../../apps/web/lib/digital-twin/layout.ts";

test("expone las nueve posiciones de dominio, incluso sin módulos históricos", () => {
  const domains = createDomainLayout();
  assert.equal(domains.length, 9);
  assert.deepEqual(domains.map((domain) => domain.id).sort(), [...CANONICAL_DOMAIN_IDS].sort());
  assert.equal(new Set(domains.map((domain) => `${domain.x}:${domain.y}:${domain.z}`)).size, 9);
});

test("el layout es determinista, finito e independiente del orden de entrada", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  const first = createDigitalTwinLayout(snapshot.nodes);
  const second = createDigitalTwinLayout([...snapshot.nodes].reverse());
  assert.deepEqual(first, second);
  assert.equal(Object.keys(first).length, 33);

  const uniquePositions = new Set<string>();
  for (const node of snapshot.nodes) {
    const position = first[node.id];
    assert.ok(position, node.id);
    for (const value of [position.x, position.y, position.z]) {
      assert.ok(Number.isFinite(value));
    }
    uniquePositions.add(`${position.x}:${position.y}:${position.z}`);
  }
  assert.equal(uniquePositions.size, 33);
});

test("cada módulo permanece próximo al centro de su dominio", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  const positions = createDigitalTwinLayout(snapshot.nodes);
  const domains = new Map(createDomainLayout().map((domain) => [domain.id, domain]));
  for (const node of snapshot.nodes) {
    const center = domains.get(node.canonicalDomain);
    const position = positions[node.id];
    assert.ok(center && position);
    const horizontalDistance = Math.hypot(position.x - center.x, position.z - center.z);
    assert.ok(horizontalDistance >= 2.5 && horizontalDistance <= 6.5);
  }
});
