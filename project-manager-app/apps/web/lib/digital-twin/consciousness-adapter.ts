import type { DigitalTwinSnapshot } from "./view-model.ts";

export interface ConsciousnessModuleMaturity {
  module: string;
  score: number;
  status?: string;
  gaps?: string[];
}

export interface ConsciousnessDigitalTwinSource {
  generatedAt?: string | null;
  maturity?: {
    byModule?: ConsciousnessModuleMaturity[] | null;
  } | null;
  observation?: {
    healthScore?: number | null;
    observedAt?: string | null;
  } | null;
}

const MODULE_NAME_TO_NODE_ID: Record<string, string> = {
  BuildOps: "buildops",
  Evidence: "evidence_upload",
  Milestones: "milestones",
  "Payment Governance": "payment_governance",
  "Mission Control": "mission_control",
  "AI Mission Control": "observer",
  "Prometeo RAG": "prometeo",
  "Smart Intake": "smart_intake",
  "SSE Infrastructure": "sse_layer",
  Finance: "payment_engine",
  "Contractors / CRM": "crm",
  "Trade Guide": "rag_library",
  Marketplace: "marketplace",
  Notifications: "communications",
  "Trust Scores": "trust_signals",
  "SEMSE Agents": "evidence_review",
  "Evidence Agent UI": "vision_analysis",
  "Ecosystem Metrics": "observer",
  "ProTools Engine": "protools_agent",
  "Trust Passport": "trust_passport",
  "DAO Governance": "governance_proposals",
};

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function mergeConsciousnessIntoSnapshot(
  base: DigitalTwinSnapshot,
  source: ConsciousnessDigitalTwinSource | null | undefined,
): DigitalTwinSnapshot {
  const degraded = new Set(base.degradedSources);
  const byModule = source?.maturity?.byModule;
  const observations = new Map<string, ConsciousnessModuleMaturity>();
  const unmapped: string[] = [];

  if (source) {
    if (!Array.isArray(byModule)) {
      degraded.add("consciousness-registry");
    } else {
      for (const item of byModule) {
        const nodeId = MODULE_NAME_TO_NODE_ID[item.module];
        if (!nodeId) {
          unmapped.push(item.module);
          continue;
        }
        if (!validScore(item.score)) {
          degraded.add("consciousness-registry");
          continue;
        }
        if (!observations.has(nodeId)) observations.set(nodeId, item);
      }
    }
  }

  const health = source?.observation?.healthScore;
  if (source && !validScore(health)) degraded.add("consciousness-observation");

  return {
    ...base,
    nodes: base.nodes.map((node) => {
      const observation = observations.get(node.id);
      if (!observation) return { ...node, sources: [...node.sources] };
      return {
        ...node,
        maturity: observation.score,
        maturitySource: "consciousness-registry",
        runtimeHealth: null,
        status: "unobserved",
        observedAt: null,
        sources: node.sources.includes("consciousness-registry")
          ? [...node.sources]
          : [...node.sources, "consciousness-registry"],
      };
    }),
    edges: base.edges.map((edge) => ({ ...edge })),
    flows: base.flows.map((flow) => ({
      ...flow,
      nodeIds: [...flow.nodeIds],
      edgeIds: [...flow.edgeIds],
    })),
    globalHealth: validScore(health) ? health : null,
    generatedAt: typeof source?.generatedAt === "string" ? source.generatedAt : null,
    observedAt: typeof source?.observation?.observedAt === "string" ? source.observation.observedAt : null,
    degradedSources: [...degraded],
    unmappedMaturityModules: unmapped,
  };
}
