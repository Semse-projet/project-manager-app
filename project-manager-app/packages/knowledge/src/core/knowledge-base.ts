export type KnowledgeNodeBase = {
  id: string;
  parentId?: string | null;
  aliases?: string[];
};

export type KnowledgeRelationBase = {
  id: string;
  sourceId: string;
  targetId: string;
};

export type KnowledgeSeed<TNode, TRelation> = {
  nodes: TNode[];
  relations: TRelation[];
};

export type GenericKnowledgeTreeNode<TNode> = {
  node: TNode;
  children: GenericKnowledgeTreeNode<TNode>[];
};

type KnowledgeBaseOptions<TNode extends KnowledgeNodeBase, TRelation extends KnowledgeRelationBase> = {
  defaultRootId: string;
  normalizeLookupTerm: (term: string) => string;
  getSearchCandidates: (node: TNode) => string[];
  validateTree?: (tree: GenericKnowledgeTreeNode<TNode>) => void;
};

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export class KnowledgeDomainBase<TNode extends KnowledgeNodeBase, TRelation extends KnowledgeRelationBase> {
  private readonly nodesById: Map<string, TNode>;

  constructor(
    private readonly seed: KnowledgeSeed<TNode, TRelation>,
    private readonly options: KnowledgeBaseOptions<TNode, TRelation>
  ) {
    this.nodesById = indexById(seed.nodes);
  }

  getSeed(): KnowledgeSeed<TNode, TRelation> {
    return this.seed;
  }

  getNodeById(id: string): TNode | undefined {
    return this.nodesById.get(id);
  }

  getChildren(id: string): TNode[] {
    return this.seed.nodes.filter((node) => node.parentId === id);
  }

  getRelations(id: string): TRelation[] {
    return this.seed.relations.filter((relation) => relation.sourceId === id || relation.targetId === id);
  }

  getPathToRoot(id: string): TNode[] {
    const path: TNode[] = [];
    let current = this.nodesById.get(id);
    const seen = new Set<string>();

    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      current = current.parentId ? this.nodesById.get(current.parentId) : undefined;
    }

    return path;
  }

  findNodes(term: string): TNode[] {
    const normalized = this.options.normalizeLookupTerm(term);
    return this.seed.nodes.filter((node) =>
      this.options
        .getSearchCandidates(node)
        .map(this.options.normalizeLookupTerm)
        .some((candidate) => candidate.includes(normalized))
    );
  }

  getTree(rootId = this.options.defaultRootId): GenericKnowledgeTreeNode<TNode> {
    const build = (id: string): GenericKnowledgeTreeNode<TNode> => {
      const node = this.getNodeById(id);
      if (!node) {
        throw new Error(`Unknown knowledge node '${id}'`);
      }

      return {
        node,
        children: this.getChildren(id).map((child) => build(child.id))
      };
    };

    return build(rootId);
  }

  validate(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const relation of this.seed.relations) {
      if (!this.nodesById.has(relation.sourceId)) {
        issues.push(`Missing relation source '${relation.sourceId}'`);
      }
      if (!this.nodesById.has(relation.targetId)) {
        issues.push(`Missing relation target '${relation.targetId}'`);
      }
    }

    for (const node of this.seed.nodes) {
      if (node.parentId && !this.nodesById.has(node.parentId)) {
        issues.push(`Missing parent '${node.parentId}' for node '${node.id}'`);
      }
    }

    const tree = this.getTree();
    this.options.validateTree?.(tree);

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

export function createCachedAsyncFactory<T>(factory: () => Promise<T>): () => Promise<T> {
  let cached: T | null = null;

  return async () => {
    if (!cached) {
      cached = await factory();
    }

    return cached;
  };
}

