export const CANONICAL_DOMAIN_IDS = [
  "semse-core",
  "semse-connect",
  "semse-payments",
  "semse-trust",
  "semse-ai",
  "semse-agro",
  "semse-buildops",
  "semse-knowledge",
  "semse-integrations",
] as const;

export type CanonicalDomainId = (typeof CANONICAL_DOMAIN_IDS)[number];
export type DigitalTwinExecutionLayer =
  | "experience-platform"
  | "semse-core"
  | "ecosystem-orchestrator"
  | "domain-capability"
  | "semse-ai"
  | "mission-control";
export type DigitalTwinCriticality = "low" | "medium" | "high" | "critical";
export type DigitalTwinObservationStatus = "observed" | "unobserved" | "degraded";
export type DigitalTwinSource =
  | "static-topology"
  | "consciousness-registry"
  | "consciousness-observation";

export interface DigitalTwinDomain {
  id: CanonicalDomainId;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

export const CANONICAL_DOMAINS: readonly DigitalTwinDomain[] = [
  { id: "semse-core", label: "SEMSE Core", shortLabel: "Core", color: "#2EC4B6", description: "Identidad, organizaciones, permisos, auditoría y observación." },
  { id: "semse-connect", label: "SEMSE Connect", shortLabel: "Connect", color: "#60A5FA", description: "Intake, marketplace, contratos y comunicaciones." },
  { id: "semse-payments", label: "SEMSE Payments", shortLabel: "Payments", color: "#D4A853", description: "Escrow operativo, releases y gobierno financiero." },
  { id: "semse-trust", label: "SEMSE Trust", shortLabel: "Trust", color: "#F472B6", description: "Reputación, verificación, disputas y governance." },
  { id: "semse-ai", label: "SEMSE AI", shortLabel: "AI", color: "#A78BFA", description: "Prometeo, agentes, Vision e inteligencia." },
  { id: "semse-agro", label: "SEMSE Agro", shortLabel: "Agro", color: "#86EFAC", description: "Vertical hermano; sin módulos en la topología histórica." },
  { id: "semse-buildops", label: "SEMSE BuildOps", shortLabel: "BuildOps", color: "#FB923C", description: "Proyectos, hitos, ProTools y operación de campo." },
  { id: "semse-knowledge", label: "SEMSE Knowledge", shortLabel: "Knowledge", color: "#38BDF8", description: "RAG, documentos, embeddings y memoria institucional." },
  { id: "semse-integrations", label: "SEMSE Integrations", shortLabel: "Integrations", color: "#94A3B8", description: "Storage, despliegue, eventos y adaptadores externos." },
] as const;

export interface DigitalTwinNode {
  id: string;
  label: string;
  canonicalDomain: CanonicalDomainId;
  executionLayer: DigitalTwinExecutionLayer;
  criticality: DigitalTwinCriticality;
  maturity: number | null;
  maturitySource: "not-available" | "consciousness-registry";
  runtimeHealth: number | null;
  status: DigitalTwinObservationStatus;
  sources: DigitalTwinSource[];
  observedAt: string | null;
  description: string;
  inputs: string[];
  outputs: string[];
}

export interface DigitalTwinEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  strength: number;
  derived: boolean;
}

export interface DigitalTwinFlow {
  id: "intake_to_contract" | "execution_to_evidence" | "evidence_to_payment";
  label: string;
  description: string;
  nodeIds: string[];
  edgeIds: string[];
}

export interface DigitalTwinSnapshot {
  nodes: DigitalTwinNode[];
  edges: DigitalTwinEdge[];
  flows: DigitalTwinFlow[];
  globalHealth: number | null;
  generatedAt: string | null;
  observedAt: string | null;
  topologySource: "static-definition" | "operational-graph";
  degradedSources: string[];
  unmappedMaturityModules: string[];
}

export interface DigitalTwinPosition {
  x: number;
  y: number;
  z: number;
}

export interface DigitalTwinDomainLayout extends DigitalTwinPosition {
  id: CanonicalDomainId;
}

export const DOMAIN_BY_ID = Object.fromEntries(
  CANONICAL_DOMAINS.map((domain) => [domain.id, domain]),
) as Record<CanonicalDomainId, DigitalTwinDomain>;

export type DigitalTwinPerspective = "architecture" | "flows" | "health";
export type DigitalTwinViewMode = "3d" | "2d" | "list";

export interface DigitalTwinPlayback {
  flowId: string;
  startedAt: number;
  nonce: number;
}
