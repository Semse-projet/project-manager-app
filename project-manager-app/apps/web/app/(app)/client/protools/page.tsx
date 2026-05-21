"use client";

import { useState } from "react";
import {
  AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronUp,
  DollarSign, Send, Wrench, Briefcase, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type EstimateResult = {
  trade: string;
  materials: Array<{ item: string; qty: number; unit: string; unitCost: number; total: number }>;
  laborHours: number;
  totalMaterials: number;
  suggestedBudgetMin?: number;
  suggestedBudgetMax?: number;
  totalLabor: number;
  totalCost: number;
  riskFlags: string[];
  checklist: string[];
  confidence: number;
  agentNote: string;
};

const TRADES = [
  { value: "electrical", label: "Electricidad" },
  { value: "plumbing",   label: "Plomería" },
  { value: "drywall",    label: "Drywall" },
  { value: "painting",   label: "Pintura" },
  { value: "hvac",       label: "HVAC" },
  { value: "roofing",    label: "Techos" },
  { value: "carpentry",  label: "Carpintería" },
  { value: "cleaning",   label: "Limpieza" },
];

export default function ProToolsPage() {
  const [trade,       setTrade]       = useState("electrical");
  const [description, setDescription] = useState("");
  const [area,        setArea]        = useState("100");
  const [rooms,       setRooms]       = useState("2");
  const [result,      setResult]      = useState<EstimateResult | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showChecklist,  setShowChecklist]  = useState(false);
  const [showMaterials,  setShowMaterials]  = useState(false);
  const [publishing,     setPublishing]     = useState(false);
  const [publishedJobId, setPublishedJobId] = useState<string | null>(null);
  const [publishError,   setPublishError]   = useState<string | null>(null);

  const publishJob = async () => {
    if (!result) return;
    setPublishing(true); setPublishError(null);
    try {
      const resp = await fetch("/api/semse/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title:      `${trade.charAt(0).toUpperCase() + trade.slice(1)}: ${description.slice(0, 80)}`,
          scope:      description,
          category:   trade,
          budgetMin:  result.suggestedBudgetMin ?? result.totalCost * 0.8,
          budgetMax:  result.suggestedBudgetMax ?? result.totalCost * 1.2,
          locationType: "on_site",
        }),
      });
      const json = await resp.json() as { data?: { id?: string }; error?: { message?: string } };
      if (resp.ok && json.data?.id) {
        setPublishedJobId(json.data.id);
      } else {
        setPublishError((json.error?.message as string) ?? "No se pudo publicar el trabajo");
      }
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setPublishing(false);
    }
  };

  const runEstimate = async () => {
    if (!description.trim()) { setError("Describe el trabajo"); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const resp = await fetch("/api/semse/agents/protools/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trade, description, area: Number(area), rooms: Number(rooms) }),
      });
      const json = await resp.json() as { data: EstimateResult };
      if (resp.ok && json.data) setResult(json.data);
      else setError("No se pudo generar el estimado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(252,211,77,.15)", display: "grid", placeItems: "center" }}>
          <Brain size={20} color="#fcd34d" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>ProTools — Estimador de Obra</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Materiales · Mano de obra · Riesgos · Checklist SEMSE
          </p>
        </div>
      </div>

      {/* Form */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>TIPO DE TRABAJO</label>
            <select value={trade} onChange={(e) => setTrade(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 13 }}>
              {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>DESCRIPCIÓN DEL TRABAJO *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Ej: Reemplazar panel eléctrico de 100A a 200A, instalar 6 circuitos nuevos para cocina y baños..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÁREA (sqft)</label>
              <input type="number" value={area} onChange={(e) => setArea(e.target.value)} min={1}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>CUARTOS / UNIDADES</label>
              <input type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} min={1}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
          </div>

          {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 8, fontSize: 12, color: "#fca5a5" }}>{error}</div>}

          <button onClick={runEstimate} disabled={loading}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 13, borderRadius: 12, background: "rgba(252,211,77,.15)", border: "1px solid rgba(252,211,77,.3)", cursor: loading ? "wait" : "pointer", fontSize: 14, fontWeight: 800, color: "#fcd34d", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Calculando…" : <><Send size={15} /> Calcular estimado</>}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{ display: "grid", gap: 16 }}>

          {/* Publish from estimate */}
          {!publishedJobId ? (
            <div style={{ padding: "14px 18px", background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.25)", borderRadius: 14, display: "flex", alignItems: "center", gap: 14 }}>
              <Briefcase size={18} color="#818cf8" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 2 }}>¿Listo para contratar?</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Publica este trabajo en el marketplace con el presupuesto estimado</div>
              </div>
              {publishError && <div style={{ fontSize: 11, color: "#fca5a5" }}>{publishError}</div>}
              <button onClick={publishJob} disabled={publishing}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.4)", cursor: publishing ? "wait" : "pointer", fontSize: 12, fontWeight: 800, color: "#818cf8", whiteSpace: "nowrap" }}>
                {publishing ? "Publicando…" : <><Send size={13} /> Publicar trabajo</>}
              </button>
            </div>
          ) : (
            <div style={{ padding: "14px 18px", background: "rgba(134,239,172,.08)", border: "1px solid rgba(134,239,172,.3)", borderRadius: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <CheckCircle2 size={18} color="#86efac" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#86efac" }}>¡Trabajo publicado!</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>ID: {publishedJobId}</div>
              </div>
              <a href="/client/jobs" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#86efac", fontWeight: 700, textDecoration: "none" }}>
                Ver mis trabajos <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Totals */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "Materiales",      value: `$${result.totalMaterials.toLocaleString()}`,  color: "#818cf8" },
              { label: "Mano de obra",    value: `$${result.totalLabor.toLocaleString()}`,       color: "#67e8f9" },
              { label: "TOTAL ESTIMADO",  value: `$${result.totalCost.toLocaleString()}`,        color: "#fcd34d" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "16px", background: "var(--surface)", border: `1px solid ${color}30`, borderRadius: 14, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>HORAS DE TRABAJO</span>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#86efac" }}>{result.laborHours}h</div>
            </div>
            <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>CONFIANZA</span>
              <div style={{ fontSize: 18, fontWeight: 900, color: result.confidence >= 0.8 ? "#86efac" : "#fcd34d" }}>{Math.round(result.confidence * 100)}%</div>
            </div>
          </div>

          {/* Materials */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <button onClick={() => setShowMaterials((p) => !p)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <Wrench size={14} color="#818cf8" />
              <span style={{ fontSize: 14, fontWeight: 800 }}>Lista de materiales ({result.materials.length})</span>
              {showMaterials ? <ChevronUp size={13} color="var(--muted)" style={{ marginLeft: "auto" }} /> : <ChevronDown size={13} color="var(--muted)" style={{ marginLeft: "auto" }} />}
            </button>
            {showMaterials && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "8px 16px", fontSize: 9, fontWeight: 800, color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                  <span>MATERIAL</span><span>CANTIDAD</span><span>P.UNIT</span><span>TOTAL</span>
                </div>
                {result.materials.map((m, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, alignItems: "center" }}>
                    <span style={{ color: "var(--ink)" }}>{m.item}</span>
                    <span style={{ color: "var(--muted)" }}>{m.qty} {m.unit}</span>
                    <span style={{ color: "var(--muted)" }}>${m.unitCost}</span>
                    <span style={{ fontWeight: 700, color: "#818cf8" }}>${m.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk flags */}
          {result.riskFlags.length > 0 && (
            <div style={{ padding: "12px 16px", background: "rgba(234,179,8,.06)", border: "1px solid rgba(234,179,8,.25)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={13} color="#fcd34d" />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fcd34d" }}>Riesgos a verificar</span>
              </div>
              {result.riskFlags.map((f, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--muted)", padding: "3px 0" }}>⚠ {f}</div>
              ))}
            </div>
          )}

          {/* Checklist */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <button onClick={() => setShowChecklist((p) => !p)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <CheckCircle2 size={14} color="#86efac" />
              <span style={{ fontSize: 14, fontWeight: 800 }}>Checklist SEMSE ({result.checklist.length} pasos)</span>
              {showChecklist ? <ChevronUp size={13} color="var(--muted)" style={{ marginLeft: "auto" }} /> : <ChevronDown size={13} color="var(--muted)" style={{ marginLeft: "auto" }} />}
            </button>
            {showChecklist && (
              <div style={{ padding: "0 16px 14px", display: "grid", gap: 8 }}>
                {result.checklist.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", background: "rgba(134,239,172,.05)", borderRadius: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#86efac", minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ fontSize: 12, color: "var(--ink)" }}>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent note */}
          <div style={{ padding: "10px 14px", background: "rgba(252,211,77,.05)", borderRadius: 10, fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
            <DollarSign size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />
            {result.agentNote}
          </div>
        </div>
      )}
    </div>
  );
}
