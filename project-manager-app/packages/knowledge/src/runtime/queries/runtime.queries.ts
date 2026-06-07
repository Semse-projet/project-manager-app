import {
  runtimeTreeSchema,
  type RuntimeNode,
  type RuntimeRelation,
  type RuntimeTreeNode
} from "@semse/schemas";
import { createCachedAsyncFactory, KnowledgeDomainBase } from "../../core/knowledge-base.js";
import { loadRuntimeSeed, type RuntimeSeed } from "../loaders/runtime.loader.js";
import { normalizeRuntimeLookupTerm } from "../normalizers/runtime.normalizer.js";

export class RuntimeKnowledgeBase extends KnowledgeDomainBase<RuntimeNode, RuntimeRelation> {
  constructor(seed: RuntimeSeed) {
    super(seed, {
      defaultRootId: "semse_runtime",
      normalizeLookupTerm: normalizeRuntimeLookupTerm,
      getSearchCandidates: (node) => [node.id, node.name, ...node.aliases, ...node.endpoints, ...node.ports.map(String)],
      validateTree: (tree) => runtimeTreeSchema.parse({ root: tree as RuntimeTreeNode, maxDepth: 6 })
    });
  }

  getServiceNodes(): RuntimeNode[] {
    return this.getSeed().nodes.filter((node) => node.kind !== "runtime_root");
  }
}

export const getRuntimeKnowledgeBase = createCachedAsyncFactory(
  async () => new RuntimeKnowledgeBase(await loadRuntimeSeed())
);

