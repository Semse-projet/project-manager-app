"use client";

import { useEffect, useMemo, useState } from "react";
import { HtmlInCanvasPanel, useHtmlInCanvasSupport } from "@semse/ui";
import type { RepoNode, RepoRelation, RepoTreeNode } from "@semse/schemas";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

type RepoQueryResponse = {
  answer: string;
  node: RepoNode | null;
  children: RepoNode[];
  relations: RepoRelation[];
  path: RepoNode[];
};

export function RepoMapClient() {
  const canvasSupported = useHtmlInCanvasSupport();
  const [tree, setTree] = useState<RepoTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<RepoNode | null>(null);
  const [relations, setRelations] = useState<RepoRelation[]>([]);
  const [query, setQuery] = useState("knowledge package");
  const [answer, setAnswer] = useState("");
  const [path, setPath] = useState<RepoNode[]>([]);
  const [children, setChildren] = useState<RepoNode[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedNodeId = selectedNode?.id;

  useEffect(() => {
    void fetch("/api/semse/repo-knowledge/tree")
      .then((response) => response.json())
      .then((payload) => {
        const root = payload.data as RepoTreeNode;
        setTree(root);
        setSelectedNode(root.node);
        setChildren(root.children.map((entry) => entry.node));
      });
  }, []);

  useEffect(() => {
    if (!selectedNodeId) return;

    void Promise.all([
      fetch(`/api/semse/repo-knowledge/node/${selectedNodeId}`).then((response) => response.json()),
      fetch(`/api/semse/repo-knowledge/children/${selectedNodeId}`).then((response) => response.json()),
      fetch(`/api/semse/repo-knowledge/relations/${selectedNodeId}`).then((response) => response.json())
    ]).then(([nodePayload, childrenPayload, relationsPayload]) => {
      setSelectedNode(nodePayload.data as RepoNode);
      setChildren((childrenPayload.data as RepoNode[]) ?? []);
      setRelations((relationsPayload.data as RepoRelation[]) ?? []);
    });
  }, [selectedNodeId]);

  const flattenedTree = useMemo(() => {
    const rows: Array<{ depth: number; node: RepoNode }> = [];

    const visit = (entry: RepoTreeNode, depth: number) => {
      rows.push({ depth, node: entry.node });
      entry.children.forEach((child) => visit(child, depth + 1));
    };

    if (tree) {
      visit(tree, 0);
    }

    return rows;
  }, [tree]);

  async function handleSearch() {
    setLoading(true);
    try {
      const response = await fetch("/api/semse/repo-knowledge/query", {
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
      const data = payload.data as RepoQueryResponse;
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
      <Card className="grid h-fit gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">Tree</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Repo Knowledge Map</h2>
          </div>
          <span
            title={canvasSupported ? "Renderizado en canvas nativo (HTML-in-Canvas activo)" : "Renderizado en DOM (activa chrome://flags/#canvas-draw-element para canvas)"}
            style={{
              flexShrink: 0,
              marginTop: "2px",
              padding: "3px 9px",
              borderRadius: "999px",
              fontSize: "0.7rem",
              fontWeight: 700,
              background: canvasSupported ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.1)",
              color: canvasSupported ? "#34d399" : "#64748b",
              border: `1px solid ${canvasSupported ? "rgba(52,211,153,0.25)" : "rgba(148,163,184,0.15)"}`,
              cursor: "default"
            }}
          >
            {canvasSupported ? "canvas" : "DOM"}
          </span>
        </div>
        <div className="grid max-h-[70vh] gap-1 overflow-auto pr-1">
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
                label="Search Repo Knowledge"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="knowledge package"
              />
            </div>
            <Button onClick={() => void handleSearch()} loading={loading}>
              Search
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

        <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={440}>
        <Card className="grid gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">Node Detail</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{selectedNode?.name ?? "Select a node"}</h2>
          </div>
          {selectedNode ? (
            <>
              <p className="text-sm text-muted">{selectedNode.description}</p>
              <div className="flex flex-wrap gap-2">
                {selectedNode.responsibilities.map((item) => (
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
              <div>
                <h3 className="text-sm font-semibold text-ink">Paths</h3>
                <ul className="mt-2 grid gap-1 text-sm text-muted">
                  {selectedNode.paths.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </Card>
        </HtmlInCanvasPanel>
      </div>
    </div>
  );
}
