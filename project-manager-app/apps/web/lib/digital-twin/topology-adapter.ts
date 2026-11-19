import {
  SEMSE_NEURONS,
  SEMSE_SYNAPSES,
  type Synapse,
} from "../data/semse-consciousness-topology.ts";
import { buildDigitalTwinFlowGraph } from "./flows.ts";
import {
  type CanonicalDomainId,
  type DigitalTwinEdge,
  type DigitalTwinExecutionLayer,
  type DigitalTwinNode,
  type DigitalTwinSnapshot,
} from "./view-model.ts";

export { CANONICAL_DOMAIN_IDS } from "./view-model.ts";

const NODE_TAXONOMY: Record<string, {
  domain: CanonicalDomainId;
  layer: DigitalTwinExecutionLayer;
}> = {
  landing: { domain: "semse-connect", layer: "experience-platform" },
  smart_intake: { domain: "semse-connect", layer: "experience-platform" },
  marketplace: { domain: "semse-connect", layer: "domain-capability" },
  communications: { domain: "semse-connect", layer: "domain-capability" },
  crm: { domain: "semse-connect", layer: "domain-capability" },
  buildops: { domain: "semse-buildops", layer: "domain-capability" },
  projects: { domain: "semse-buildops", layer: "domain-capability" },
  milestones: { domain: "semse-buildops", layer: "domain-capability" },
  task_management: { domain: "semse-buildops", layer: "domain-capability" },
  field_updates: { domain: "semse-buildops", layer: "experience-platform" },
  escrow: { domain: "semse-payments", layer: "domain-capability" },
  payment_engine: { domain: "semse-payments", layer: "domain-capability" },
  payment_governance: { domain: "semse-payments", layer: "ecosystem-orchestrator" },
  disputes: { domain: "semse-trust", layer: "domain-capability" },
  evidence_upload: { domain: "semse-buildops", layer: "experience-platform" },
  evidence_review: { domain: "semse-ai", layer: "semse-ai" },
  evidence_storage: { domain: "semse-integrations", layer: "domain-capability" },
  trust_signals: { domain: "semse-trust", layer: "domain-capability" },
  vision_analysis: { domain: "semse-ai", layer: "semse-ai" },
  governance_proposals: { domain: "semse-trust", layer: "domain-capability" },
  governance_voting: { domain: "semse-trust", layer: "domain-capability" },
  trust_passport: { domain: "semse-trust", layer: "domain-capability" },
  observer: { domain: "semse-core", layer: "mission-control" },
  prometeo: { domain: "semse-ai", layer: "semse-ai" },
  rag_library: { domain: "semse-knowledge", layer: "semse-ai" },
  llm_router: { domain: "semse-ai", layer: "semse-ai" },
  protools_agent: { domain: "semse-buildops", layer: "semse-ai" },
  postgresql: { domain: "semse-core", layer: "semse-core" },
  redis: { domain: "semse-core", layer: "semse-core" },
  api_gateway: { domain: "semse-core", layer: "ecosystem-orchestrator" },
  sse_layer: { domain: "semse-integrations", layer: "ecosystem-orchestrator" },
  mission_control: { domain: "semse-core", layer: "mission-control" },
  railway: { domain: "semse-integrations", layer: "domain-capability" },
};

const STRENGTH: Record<Synapse["strength"], number> = {
  weak: 0.25,
  medium: 0.5,
  strong: 0.75,
  critical: 1,
};

function createNodes(): DigitalTwinNode[] {
  return Object.values(SEMSE_NEURONS).map((neuron) => {
    const taxonomy = NODE_TAXONOMY[neuron.id];
    if (!taxonomy) throw new Error(`Missing canonical taxonomy for ${neuron.id}`);
    return {
      id: neuron.id,
      label: neuron.label,
      canonicalDomain: taxonomy.domain,
      executionLayer: taxonomy.layer,
      criticality: neuron.criticality,
      maturity: null,
      maturitySource: "not-available",
      runtimeHealth: null,
      status: "unobserved",
      sources: ["static-topology"],
      observedAt: null,
      description: neuron.description,
      inputs: [...neuron.inputs],
      outputs: [...neuron.outputs],
    };
  });
}

function createStaticEdges(): DigitalTwinEdge[] {
  return SEMSE_SYNAPSES.map((synapse, index) => ({
    id: `synapse:${index}:${synapse.source}:${synapse.target}`,
    source: synapse.source,
    target: synapse.target,
    relation: synapse.type,
    strength: STRENGTH[synapse.strength],
    derived: false,
  }));
}

export function createStaticDigitalTwinSnapshot(): DigitalTwinSnapshot {
  const graph = buildDigitalTwinFlowGraph(createStaticEdges());
  return {
    nodes: createNodes(),
    edges: graph.edges,
    flows: graph.flows,
    globalHealth: null,
    generatedAt: null,
    observedAt: null,
    topologySource: "static-definition",
    degradedSources: [],
    unmappedMaturityModules: [],
  };
}
