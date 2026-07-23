"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Filter, RefreshCw, Tag } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import {
  fetchAgentMemories,
  type AgentMemoryEntry,
  type AgentMemoryKind,
} from "../../../semse-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const KIND_META: Record<AgentMemoryKind | string, { label: string; color: string; bg: string }> = {
  decision:      { label: "Decision",      color: "#c084fc", bg: "rgba(192,132,252,.12)" },
  run_summary:   { label: "Run Summary",   color: "#34d399", bg: "rgba(52,211,153,.12)"  },
  task_state:    { label: "Task State",    color: "#60a5fa", bg: "rgba(96,165,250,.12)"  },
  runtime_fact:  { label: "Runtime Fact",  color: "#f59e0b", bg: "rgba(245,158,11,.12)"  },
  repo_fact:     { label: "Repo Fact",     color: "#818cf8", bg: "rgba(129,140,248,.12)" },
  operator_note: { label: "Operator Note", color: "#f87171", bg: "rgba(248,113,113,.12)" },
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? { label: kind, color: "var(--muted)", bg: "rgba(148,163,184,.08)" };
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ALL_KINDS: AgentMemoryKind[] = [
  "decision", "run_summary", "task_state", "runtime_fact", "repo_fact", "operator_note",
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminMemoryPage() {
  const [entries, setEntries] = useState<AgentMemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterKind, setFilterKind] = useState<string>("");
  const [filterAgentId, setFilterAgentId] = useState<string>("");
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentMemories({
        kind: filterKind || undefined,
        agentId: filterAgentId.trim() || undefined,
        workspaceId: filterWorkspaceId.trim() || undefined,
        limit: 100,
      });
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar memorias.");
    } finally {
      setLoading(false);
    }
  }, [filterKind, filterAgentId, filterWorkspaceId]);

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive unique agentIds (createdBy) from loaded entries for filter suggestions
  const knownAgentIds = Array.from(new Set(entries.map((e) => e.createdBy))).filter(Boolean);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 24 }}>
      <AdminPageHeader
        title="Agent Memory"
        subtitle="Entradas de workspace memory del proyecto activo"
        icon={Brain}
        iconColor="#c084fc"
        iconBg="rgba(192,132,252,.15)"
        showBack={false}
        actions={
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 10, border: "none",
              background: "rgba(129,140,248,.15)", color: "#818cf8",
              fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        }
      />

      {/* Filters */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "16px 20px", display: "grid", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Filter size={14} color="#818cf8" />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: ".08em" }}>
            Filtros
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {/* Kind filter */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>TIPO (KIND)</label>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              style={{
                padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--bg)", color: "var(--ink)", fontSize: 12, outline: "none",
              }}
            >
              <option value="">Todos</option>
              {ALL_KINDS.map((k) => (
                <option key={k} value={k}>{kindMeta(k).label}</option>
              ))}
            </select>
          </div>

          {/* AgentId filter */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>AGENT ID (createdBy)</label>
            <input
              value={filterAgentId}
              onChange={(e) => setFilterAgentId(e.target.value)}
              placeholder="Filtrar por agent ID…"
              list="agent-ids-list"
              style={{
                padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--bg)", color: "var(--ink)", fontSize: 12, outline: "none",
              }}
            />
            <datalist id="agent-ids-list">
              {knownAgentIds.map((id) => <option key={id} value={id} />)}
            </datalist>
          </div>

          {/* WorkspaceId filter */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>WORKSPACE ID</label>
            <input
              value={filterWorkspaceId}
              onChange={(e) => setFilterWorkspaceId(e.target.value)}
              placeholder="workspace ID…"
              style={{
                padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--bg)", color: "var(--ink)", fontSize: 12, outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{
              padding: "8px 16px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff",
              fontWeight: 700, fontSize: 12, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            Aplicar filtros
          </button>
          <button
            onClick={() => { setFilterKind(""); setFilterAgentId(""); setFilterWorkspaceId(""); }}
            style={{
              padding: "8px 14px", borderRadius: 10,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--muted)", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 12, fontSize: 13,
          background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", color: "#ef4444",
        }}>
          {error}
        </div>
      )}

      {/* Summary */}
      {!loading && !error && (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {entries.length} entrada{entries.length !== 1 ? "s" : ""} encontrada{entries.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Entries */}
      {!loading && entries.length === 0 && !error && (
        <div style={{
          padding: "32px", textAlign: "center", fontSize: 13, color: "var(--muted)",
          border: "1px dashed var(--border)", borderRadius: 16,
        }}>
          No hay entradas de memoria. Especifica un workspaceId o ajusta los filtros.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {entries.map((entry) => {
          const meta = kindMeta(entry.kind);
          return (
            <div key={entry.id} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "16px 18px", display: "grid", gap: 10,
            }}>
              {/* Row 1: kind badge + title + date */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 800,
                    background: meta.bg, color: meta.color,
                  }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {entry.title || entry.summary.slice(0, 60)}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatDate(entry.updatedAtIso)}
                </span>
              </div>

              {/* Row 2: summary */}
              {entry.summary ? (
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink)", lineHeight: 1.6 }}>
                  {entry.summary}
                </p>
              ) : null}

              {/* Row 3: metadata */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "var(--muted)" }}>
                <span>
                  <strong style={{ color: "var(--ink)" }}>agentId: </strong>{entry.createdBy || "—"}
                </span>
                <span>
                  <strong style={{ color: "var(--ink)" }}>workspace: </strong>{entry.workspaceId || "—"}
                </span>
                {entry.runId ? (
                  <span><strong style={{ color: "var(--ink)" }}>run: </strong>{entry.runId}</span>
                ) : null}
                {entry.repoId ? (
                  <span><strong style={{ color: "var(--ink)" }}>repo: </strong>{entry.repoId}</span>
                ) : null}
                <span>
                  <strong style={{ color: "var(--ink)" }}>scope: </strong>{entry.scope}
                </span>
              </div>

              {/* Row 4: tags */}
              {entry.tags?.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {entry.tags.map((tag) => (
                    <span key={tag} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                      background: "rgba(99,102,241,.08)", color: "#818cf8",
                    }}>
                      <Tag size={9} />
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
