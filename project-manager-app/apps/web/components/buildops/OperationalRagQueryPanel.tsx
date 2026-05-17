"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Loader, MessageSquare } from "lucide-react";

type Citation = { type: string; id: string; label: string; excerpt: string };
type RagResult = {
  answer: string;
  citations: Citation[];
  nextBestAction?: string;
  confidence: number;
  insufficientContext?: boolean;
  missingSources?: string[];
  provider: string;
  fallbackUsed: boolean;
};

const SUGGESTED_QUESTIONS = [
  "¿Por qué está bloqueado este proyecto?",
  "¿Qué evidencia falta?",
  "¿Qué change orders afectan el pago?",
  "¿Qué señales críticas hay?",
  "¿Qué debo hacer ahora?",
];

interface Props {
  projectId:   string;
  milestoneId?: string;
}

export function OperationalRagQueryPanel({ projectId, milestoneId }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<RagResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCitations, setShowCitations] = useState(false);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setQuestion(q);
    try {
      const res = await fetch(`/api/semse/buildops/projects/${projectId}/rag-query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, locale: "es", milestoneId: milestoneId ?? undefined }),
      });
      const json = await res.json() as { data?: RagResult; error?: { message?: string } };
      if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
      setResult(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar");
    } finally { setLoading(false); }
  }

  const typeColor: Record<string, string> = {
    payment_governance: "#818cf8", milestone: "#fbbf24", evidence_item: "#86efac",
    audit_log: "#94a3b8", change_order: "#fb923c", operational_signal: "#ef4444",
    buildops_project: "#6366f1", rag_document: "#38bdf8",
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 14, overflow: "hidden" }}>
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MessageSquare size={15} color="#818cf8" />
          <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>Preguntar a Prometeo</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>RAG operacional · procesado localmente</span>
        </div>
        {open ? <ChevronUp size={14} color="var(--muted)" /> : <ChevronDown size={14} color="var(--muted)" />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", display: "grid", gap: 12, borderTop: "1px solid var(--border)" }}>
          {/* Suggested questions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} type="button" disabled={loading} onClick={() => void ask(q)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.03)", color: "var(--muted)", fontSize: 11, cursor: loading ? "not-allowed" : "pointer" }}>
                {q}
              </button>
            ))}
          </div>

          {/* Custom question */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void ask(question)}
              placeholder="Escribe tu pregunta sobre este proyecto..."
              style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: 12, outline: "none" }}
            />
            <button type="button" disabled={loading || !question.trim()} onClick={() => void ask(question)}
              style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: loading ? "rgba(99,102,241,.1)" : "rgba(99,102,241,.2)", color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <BookOpen size={13} />}
            </button>
          </div>

          {error && <div style={{ fontSize: 12, color: "#fca5a5" }}>⚠ {error}</div>}

          {result && (
            <div style={{ display: "grid", gap: 10 }}>
              {/* Answer */}
              <div style={{ padding: "12px 14px", borderRadius: 12, background: result.insufficientContext ? "rgba(251,191,36,.06)" : "rgba(99,102,241,.06)", border: `1px solid ${result.insufficientContext ? "rgba(251,191,36,.3)" : "rgba(99,102,241,.2)"}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: result.insufficientContext ? "#fbbf24" : "#818cf8", marginBottom: 6, textTransform: "uppercase" }}>
                  {result.insufficientContext ? "Contexto insuficiente" : "Prometeo responde"}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{result.answer}</div>
                {result.missingSources && result.missingSources.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#fbbf24" }}>
                    Fuentes faltantes: {result.missingSources.join(", ")}
                  </div>
                )}
              </div>

              {/* Next best action */}
              {result.nextBestAction && (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(134,239,172,.06)", border: "1px solid rgba(134,239,172,.2)", fontSize: 12 }}>
                  <strong style={{ color: "#86efac" }}>Siguiente acción:</strong>{" "}
                  <span style={{ color: "var(--ink)" }}>{result.nextBestAction}</span>
                </div>
              )}

              {/* Citations */}
              {result.citations.length > 0 && (
                <div>
                  <button type="button" onClick={() => setShowCitations((s) => !s)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11 }}>
                    {showCitations ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    Basado en {result.citations.length} fuente{result.citations.length > 1 ? "s" : ""}
                  </button>
                  {showCitations && (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {result.citations.map((c, i) => (
                        <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.02)", border: `1px solid ${typeColor[c.type] ?? "var(--border)"}33`, fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: typeColor[c.type] ?? "var(--muted)" }}>{c.label}</span>
                          {" — "}
                          <span style={{ color: "var(--muted)" }}>{c.excerpt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div style={{ fontSize: 10, color: "var(--muted)", display: "flex", gap: 12 }}>
                <span>Provider: {result.provider}</span>
                <span>Confianza: {Math.round(result.confidence * 100)}%</span>
                {result.fallbackUsed && <span style={{ color: "#fbbf24" }}>fallback</span>}
                <span style={{ color: "#86efac" }}>🔒 local</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
