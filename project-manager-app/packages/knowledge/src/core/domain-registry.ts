import type { KnowledgeDomainId, KnowledgeDomainSummary } from "@semse/schemas";

export const knowledgeDomainCatalog: KnowledgeDomainSummary[] = [
  {
    id: "semse.anatomy",
    title: "SEMSE Anatomy Knowledge Domain",
    description: "Dominio jerarquico parte-todo para exploracion anatomica, agentes y API reusable.",
    rootId: "body",
    apiBasePath: "/v1/anatomy",
    uiPath: "/anatomy",
    capabilities: ["tree_navigation", "agent_tutor", "relations", "validation"]
  },
  {
    id: "semse.repo",
    title: "SEMSE Repo Knowledge Domain",
    description: "Dominio estructural del ecosistema y monorepo canonico para trazabilidad arquitectonica.",
    rootId: "semse_root",
    apiBasePath: "/v1/repo-knowledge",
    uiPath: "/repo-map",
    capabilities: ["topology", "ownership", "paths", "architecture_map"]
  },
  {
    id: "semse.runtime",
    title: "SEMSE Runtime Knowledge Domain",
    description: "Topologia operativa de servicios reales, dependencias y estado vivo del ecosistema.",
    rootId: "semse_runtime",
    apiBasePath: "/v1/runtime-knowledge",
    uiPath: "/runtime-map",
    capabilities: ["service_topology", "runtime_status", "dependencies", "operational_visibility"]
  }
];

export function listKnowledgeDomains(): KnowledgeDomainSummary[] {
  return knowledgeDomainCatalog;
}

export function getKnowledgeDomainSummary(id: KnowledgeDomainId): KnowledgeDomainSummary | undefined {
  return knowledgeDomainCatalog.find((entry) => entry.id === id);
}

