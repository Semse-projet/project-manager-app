import {
  repoTreeSchema,
  type RepoNode,
  type RepoRelation,
  type RepoTreeNode
} from "@semse/schemas";
import { createCachedAsyncFactory, KnowledgeDomainBase } from "../../core/knowledge-base.js";
import { loadRepoSeed, type RepoSeed } from "../loaders/repo.loader.js";
import { normalizeRepoLookupTerm } from "../normalizers/repo.normalizer.js";

export class RepoKnowledgeBase extends KnowledgeDomainBase<RepoNode, RepoRelation> {
  constructor(seed: RepoSeed) {
    super(seed, {
      defaultRootId: "semse_root",
      normalizeLookupTerm: normalizeRepoLookupTerm,
      getSearchCandidates: (node) => [node.id, node.name, ...node.aliases, ...node.paths],
      validateTree: (tree) => repoTreeSchema.parse({ root: tree as RepoTreeNode, maxDepth: 6 })
    });
  }
}

export const getRepoKnowledgeBase = createCachedAsyncFactory(async () => new RepoKnowledgeBase(await loadRepoSeed()));
