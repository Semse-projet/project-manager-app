"use client";

import { useEffect, useMemo, useState } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import type { AnatomyNode, AnatomyRelation, AnatomyTreeNode } from "@semse/schemas";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

type TutorResponse = {
  answer: string;
  node: AnatomyNode | null;
  children: AnatomyNode[];
  relations: AnatomyRelation[];
  path: AnatomyNode[];
};

export function AnatomyClient() {
  const [tree, setTree] = useState<AnatomyTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<AnatomyNode | null>(null);
  const [relations, setRelations] = useState<AnatomyRelation[]>([]);
  const [query, setQuery] = useState("mouth");
  const [answer, setAnswer] = useState<string>("");
  const [path, setPath] = useState<AnatomyNode[]>([]);
  const [children, setChildren] = useState<AnatomyNode[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedNodeId = selectedNode?.id;

  useEffect(() => {
    void fetch("/api/semse/anatomy/tree")
      .then((response) => response.json())
      .then((payload) => {
        const root = payload.data as AnatomyTreeNode;
        setTree(root);
        setSelectedNode(root.node);
        setChildren(root.children.map((entry) => entry.node));
      });
  }, []);

  useEffect(() => {
    if (!selectedNodeId) return;

    void Promise.all([
      fetch(`/api/semse/anatomy/node/${selectedNodeId}`).then((response) => response.json()),
      fetch(`/api/semse/anatomy/children/${selectedNodeId}`).then((response) => response.json()),
      fetch(`/api/semse/anatomy/relations/${selectedNodeId}`).then((response) => response.json())
    ]).then(([nodePayload, childrenPayload, relationsPayload]) => {
      setSelectedNode(nodePayload.data as AnatomyNode);
      setChildren((childrenPayload.data as AnatomyNode[]) ?? []);
      setRelations((relationsPayload.data as AnatomyRelation[]) ?? []);
    });
  }, [selectedNodeId]);

  const flattenedTree = useMemo(() => {
    const rows: Array<{ depth: number; node: AnatomyNode }> = [];

    const visit = (entry: AnatomyTreeNode, depth: number) => {
      rows.push({ depth, node: entry.node });
      entry.children.forEach((child) => visit(child, depth + 1));
    };

    if (tree) {
      visit(tree, 0);
    }

    return rows;
  }, [tree]);

  async function handleAsk() {
    setLoading(true);
    try {
      const response = await fetch("/api/semse/anatomy/query", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          search: query,
          includeRelations: true,
          includePath: true,
          maxDepth: 4
        })
      });
      const payload = await response.json();
      const data = payload.data as TutorResponse;
      setAnswer(data.answer);
      setPath(data.path ?? []);
      setRelations(data.relations ?? []);
      if (data.node) {
        setSelectedNode(data.node);
      }
      setChildren(data.children ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={620}>
      <Card className="grid gap-4 h-fit">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">Tree</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Anatomy Knowledge Map</h2>
        </div>
        <div className="grid gap-1 max-h-[70vh] overflow-auto pr-1">
          {flattenedTree.map(({ depth, node }) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNode(node)}
              className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedNode?.id === node.id ? "bg-brand/20 text-ink" : "bg-white/[0.03] text-muted hover:bg-white/[0.06]"
              }`}
              style={{ marginLeft: `${depth * 14}px` }}
            >
              <strong className="block text-sm">{node.name}</strong>
              <span className="text-[11px] uppercase tracking-widest">{node.kind}</span>
            </button>
          ))}
        </div>
      </Card>
      </HtmlInCanvasPanel>

      <div className="grid gap-6">
        <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={170}>
        <Card className="grid gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <Input
                label="Ask Anatomy Tutor"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="What composes the mouth?"
              />
            </div>
            <Button onClick={() => void handleAsk()} loading={loading}>
              Ask
            </Button>
          </div>
          {answer ? <p className="text-sm text-ink">{answer}</p> : null}
          {path.length > 0 ? (
            <p className="text-xs text-muted">
              Path: {path.map((entry) => entry.name).join(" / ")}
            </p>
          ) : null}
        </Card>
        </HtmlInCanvasPanel>

        <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={420}>
        <Card className="grid gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">Node Detail</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{selectedNode?.name ?? "Select a node"}</h2>
          </div>
          {selectedNode ? (
            <>
              <p className="text-sm text-muted">{selectedNode.description}</p>
              <div className="flex flex-wrap gap-2">
                {selectedNode.functions.map((item) => (
                  <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-ink">
                    {item}
                  </span>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Children</h3>
                  <ul className="mt-2 grid gap-2 text-sm text-muted">
                    {children.map((child) => (
                      <li key={child.id}>
                        <button type="button" onClick={() => setSelectedNode(child)} className="hover:text-ink">
                          {child.name} ({child.kind})
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">Relations</h3>
                  <ul className="mt-2 grid gap-2 text-sm text-muted">
                    {relations.map((relation) => (
                      <li key={relation.id}>
                        {relation.sourceId} {relation.type} {relation.targetId}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : null}
        </Card>
        </HtmlInCanvasPanel>
      </div>
    </div>
  );
}
