import {
  anatomyTreeSchema,
  type AnatomyNode,
  type AnatomyRelation,
  type AnatomyTreeNode
} from "@semse/schemas";
import { createCachedAsyncFactory, KnowledgeDomainBase } from "../../core/knowledge-base.js";
import { loadAnatomySeed, type AnatomySeed } from "../loaders/anatomy.loader.js";
import { normalizeAnatomyLookupTerm } from "../normalizers/anatomy.normalizer.js";

export class AnatomyKnowledgeBase extends KnowledgeDomainBase<AnatomyNode, AnatomyRelation> {
  constructor(seed: AnatomySeed) {
    super(seed, {
      defaultRootId: "body",
      normalizeLookupTerm: normalizeAnatomyLookupTerm,
      getSearchCandidates: (node) => [node.id, node.name, ...node.aliases],
      validateTree: (tree) => anatomyTreeSchema.parse({ root: tree as AnatomyTreeNode, maxDepth: 7 })
    });
  }
}

export const getAnatomyKnowledgeBase = createCachedAsyncFactory(
  async () => new AnatomyKnowledgeBase(await loadAnatomySeed())
);
