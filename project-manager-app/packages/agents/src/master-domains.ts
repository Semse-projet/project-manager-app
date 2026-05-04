import {
  getAnatomyKnowledgeBase,
  getKnowledgeDomainSummary,
  getRepoKnowledgeBase,
  getRuntimeKnowledgeBase
} from "@semse/knowledge";
import type {
  AnatomyNode,
  KnowledgeDomainId,
  RepoNode,
  RuntimeNode
} from "@semse/schemas";

type DomainNode = AnatomyNode | RepoNode | RuntimeNode;
type DomainKnowledgeBase = {
  findNodes: (query: string) => DomainNode[];
  getNodeById: (id: string) => DomainNode | undefined;
  getPathToRoot: (id: string) => DomainNode[];
};

export async function runMasterDomainTutorAgent(input: {
  domainId: KnowledgeDomainId;
  query: string;
}): Promise<{
  domainId: KnowledgeDomainId;
  summary: string;
  answer: string;
  node: DomainNode | null;
  path: DomainNode[];
}> {
  const summary = getKnowledgeDomainSummary(input.domainId);
  if (!summary) {
    return {
      domainId: input.domainId,
      summary: "Unknown knowledge domain",
      answer: `No existe el dominio '${input.domainId}'.`,
      node: null,
      path: []
    };
  }

  const knowledgeBase: DomainKnowledgeBase =
    input.domainId === "semse.anatomy"
      ? ((await getAnatomyKnowledgeBase()) as unknown as DomainKnowledgeBase)
      : input.domainId === "semse.repo"
        ? ((await getRepoKnowledgeBase()) as unknown as DomainKnowledgeBase)
        : ((await getRuntimeKnowledgeBase()) as unknown as DomainKnowledgeBase);

  const tokenMatches = input.query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .flatMap((token) => knowledgeBase.findNodes(token));

  const match =
    knowledgeBase.findNodes(input.query).at(0) ??
    tokenMatches.at(0) ??
    knowledgeBase.getNodeById(summary.rootId);

  return {
    domainId: input.domainId,
    summary: `Resolved ${summary.title}`,
    answer: match
      ? `${match.name} es el mejor match dentro de ${summary.title} y pertenece a la ruta ${knowledgeBase
          .getPathToRoot(match.id)
          .map((entry) => entry.name)
          .join(" / ")}.`
      : `No encontré un nodo dentro de ${summary.title} para '${input.query}'.`,
    node: match ?? null,
    path: match ? knowledgeBase.getPathToRoot(match.id) : []
  };
}
