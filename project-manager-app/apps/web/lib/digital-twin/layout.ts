import {
  CANONICAL_DOMAIN_IDS,
  type DigitalTwinDomainLayout,
  type DigitalTwinExecutionLayer,
  type DigitalTwinNode,
  type DigitalTwinPosition,
} from "./view-model.ts";

const LAYER_HEIGHT: Record<DigitalTwinExecutionLayer, number> = {
  "experience-platform": 4.6,
  "semse-core": 2.2,
  "ecosystem-orchestrator": 3.4,
  "domain-capability": 1.3,
  "semse-ai": 5.6,
  "mission-control": 6.7,
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDomainLayout(): DigitalTwinDomainLayout[] {
  return CANONICAL_DOMAIN_IDS.map((id, index) => ({
    id,
    x: (index % 3 - 1) * 14,
    y: 0,
    z: (Math.floor(index / 3) - 1) * 12,
  }));
}

export function createDigitalTwinLayout(
  nodes: readonly DigitalTwinNode[],
): Record<string, DigitalTwinPosition> {
  const centers = new Map(createDomainLayout().map((domain) => [domain.id, domain]));
  const positions: Record<string, DigitalTwinPosition> = {};
  for (const domainId of CANONICAL_DOMAIN_IDS) {
    const center = centers.get(domainId);
    if (!center) continue;
    const domainNodes = nodes
      .filter((node) => node.canonicalDomain === domainId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const domainOffset = (stableHash(domainId) % 360) * Math.PI / 180;
    domainNodes.forEach((node, index) => {
      const hash = stableHash(node.id);
      // Even angular spacing keeps every centre farther apart than the rendered
      // diameters in both views; per-node hashes previously caused collisions.
      const angle = domainOffset + index * Math.PI * 2 / domainNodes.length;
      const radius = 3.6;
      positions[node.id] = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + LAYER_HEIGHT[node.executionLayer] + (hash % 5) * 0.11,
        z: center.z + Math.sin(angle) * radius,
      };
    });
  }
  return positions;
}
