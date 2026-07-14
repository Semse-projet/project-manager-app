"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, Milk, ChevronRight, TrendingUp, Trash2 } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface ProductionRecord {
  id: string; type: string; targetType: string; targetId?: string | null;
  quantity: number; unit: string; unitPrice?: number | null; totalValue?: number | null;
  occurredAt: string; notes?: string | null;
}
interface ProductionSummary {
  totalValue: number;
  byType: { type: string; quantity: number; totalValue: number; records: number }[];
}
interface TargetOption { id: string; label: string; kind: "ANIMAL" | "ANIMAL_GROUP" }

const TYPE_LABEL: Record<string, string> = {
  MILK: "Leche", EGGS: "Huevos", WEIGHT_GAIN: "Peso ganado", BIRTH: "Cría nacida",
  WOOL: "Lana", HONEY: "Miel", BREEDING_SERVICE: "Servicio de monta", OTHER: "Otro",
};
const TYPE_BADGE: Record<string, string> = {
  MILK: "badge badge-blue", EGGS: "badge badge-amber", WEIGHT_GAIN: "badge badge-green",
  BIRTH: "badge badge-violet", WOOL: "badge badge-slate", HONEY: "badge badge-amber",
  BREEDING_SERVICE: "badge badge-teal", OTHER: "badge badge-slate",
};
const UNIT_LABEL: Record<string, string> = {
  LITER: "litros", UNIT: "unidades", DOZEN: "docenas", LB: "lb", KG: "kg", HEAD: "cabezas", OTHER: "",
};
const PROD_TYPES = ["MILK", "EGGS", "WEIGHT_GAIN", "BIRTH", "WOOL", "HONEY", "BREEDING_SERVICE", "OTHER"];
const PROD_UNITS = ["LITER", "UNIT", "DOZEN", "LB", "KG", "HEAD", "OTHER"];

export default function ProductionPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [records, setRecords]   = useState<ProductionRecord[]>([]);
  const [summary, setSummary]   = useState<ProductionSummary | null>(null);
  const [targets, setTargets]   = useState<TargetOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newType, setNewType]     = useState("MILK");
  const [newTarget, setNewTarget] = useState("FARM");
  const [newQty, setNewQty]       = useState("");
  const [newUnit, setNewUnit]     = useState("LITER");
  const [newPrice, setNewPrice]   = useState("");
  const [newDate, setNewDate]     = useState(new Date().toISOString().split("T")[0]);
  const [newNotes, setNewNotes]   = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [rr, sr, ar, gr] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/production`),
        fetch(`/api/semse/agro/farms/${farmId}/production/summary?days=30`),
        fetch(`/api/semse/agro/farms/${farmId}/animals`),
        fetch(`/api/semse/agro/farms/${farmId}/groups`),
      ]);
      const rj = await rr.json();
      if (!rr.ok) throw new Error(rj?.error?.message ?? "Error");
      setRecords((rj.data as any)?.records ?? []);
      try { const sj = await sr.json(); setSummary((sj.data as any)?.summary ?? null); } catch { /* best-effort */ }
      try {
        const aj = await ar.json(); const gj = await gr.json();
        const animals = ((aj.data as any)?.animals ?? [])
          .filter((a: any) => a.status === "ACTIVE")
          .map((a: any) => ({ id: a.id, label: `Animal ${a.tagCode ?? a.id.slice(-6)}`, kind: "ANIMAL" as const }));
        const groups = ((gj.data as any)?.groups ?? [])
          .filter((g: any) => g.status === "ACTIVE")
          .map((g: any) => ({ id: g.id, label: `Lote ${g.name}`, kind: "ANIMAL_GROUP" as const }));
        setTargets([...animals, ...groups]);
      } catch { /* best-effort */ }
    } catch (err: any) { setError(err?.message ?? "Error cargando producción"); }
    finally { setLoading(false); }
  }

  function closeModal() { setShowModal(false); setFormError(null); setBusy(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newQty) return;
    setBusy(true); setFormError(null);
    try {
      const target = targets.find(t => t.id === newTarget);
      const res = await fetch(`/api/semse/agro/farms/${farmId}/production`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: target ? target.kind : "FARM",
          targetId: target ? target.id : undefined,
          type: newType,
          quantity: parseFloat(newQty),
          unit: newUnit,
          unitPrice: newPrice ? parseFloat(newPrice) : undefined,
          occurredAt: newDate ? new Date(newDate).toISOString() : undefined,
          notes: newNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewQty(""); setNewPrice(""); setNewNotes("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  async function handleDelete(recordId: string) {
    try {
      const res = await fetch(`/api/semse/agro/production/${recordId}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error?.message ?? `HTTP ${res.status}`); }
      void load();
    } catch (err: any) { setError(err?.message ?? "Error eliminando registro"); }
  }

  const targetLabel = (r: ProductionRecord) =>
    r.targetType === "FARM" ? "Finca" : targets.find(t => t.id === r.targetId)?.label ?? r.targetType;

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Producción</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Registro de producción</h1>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={13} /> Registrar producción
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {!loading && summary && summary.byType.length > 0 && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <TrendingUp size={13} color="var(--muted)" />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ingreso 30 días</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>
              ${summary.totalValue.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
            </p>
          </div>
          {summary.byType.slice(0, 3).map(t => (
            <div key={t.type} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Milk size={13} color="var(--muted)" />
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {TYPE_LABEL[t.type] ?? t.type}
                </span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>
                {t.quantity.toLocaleString("es-CO")}
              </p>
              <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                ${t.totalValue.toLocaleString("es-CO", { minimumFractionDigits: 0 })} · {t.records} registro{t.records === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 48 }} />)}
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <Milk size={36} className="empty-icon" />
          <p className="empty-title">Sin producción registrada</p>
          <p className="empty-desc">Registra leche, huevos, crías nacidas y más para medir cuánto genera tu finca.</p>
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Registrar primera producción
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 130px 1fr 120px 110px 36px", gap: 0, padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span>Fecha</span><span>Tipo</span><span>Origen</span><span style={{ textAlign: "right" }}>Cantidad</span><span style={{ textAlign: "right" }}>Valor</span><span />
          </div>
          {records.map(r => (
            <div key={r.id} className="data-row" style={{ display: "grid", gridTemplateColumns: "90px 130px 1fr 120px 110px 36px", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {new Date(r.occurredAt).toLocaleDateString("es-CO")}
              </span>
              <span className={TYPE_BADGE[r.type] ?? "badge badge-slate"} style={{ justifySelf: "start" }}>
                {TYPE_LABEL[r.type] ?? r.type}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{targetLabel(r)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", textAlign: "right" }}>
                {Number(r.quantity).toLocaleString("es-CO")} {UNIT_LABEL[r.unit] ?? r.unit}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                {r.totalValue != null ? `$${Number(r.totalValue).toLocaleString("es-CO", { minimumFractionDigits: 2 })}` : "—"}
              </span>
              <button onClick={() => void handleDelete(r.id)} title="Eliminar"
                style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", justifySelf: "end" }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Registrar producción</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}

            <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Tipo *</label>
                <select className="fi" value={newType} onChange={e => setNewType(e.target.value)}>
                  {PROD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Origen</label>
                <select className="fi" value={newTarget} onChange={e => setNewTarget(e.target.value)}>
                  <option value="FARM">Finca completa</option>
                  {targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="fl">Cantidad *</label><input className="fi" type="number" step="0.01" min="0" value={newQty} onChange={e => setNewQty(e.target.value)} required autoFocus placeholder="0" /></div>
                <div>
                  <label className="fl">Unidad</label>
                  <select className="fi" value={newUnit} onChange={e => setNewUnit(e.target.value)}>
                    {PROD_UNITS.map(u => <option key={u} value={u}>{UNIT_LABEL[u] || u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="fl">Precio unitario</label><input className="fi" type="number" step="0.01" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.00" /></div>
                <div><label className="fl">Fecha</label><input className="fi" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
              </div>
              <div><label className="fl">Notas</label><input className="fi" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Ej. Ordeño de la mañana" /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Registrar producción"}</button>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
