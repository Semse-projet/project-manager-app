"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, DollarSign, ChevronRight, TrendingDown, Download, Printer } from "lucide-react";

interface CostEntry {
  id: string; category: string; amount: number; currency: string;
  description?: string; occurredAt: string; targetType: string;
}

const CAT_LABEL: Record<string, string> = {
  FEED: "Alimentación", VETERINARY: "Veterinaria", LABOR: "Mano de obra",
  EQUIPMENT: "Equipo", TRANSPORT: "Transporte", INFRASTRUCTURE: "Infraestructura",
  SEED: "Semillas", FERTILIZER: "Fertilizante", FUEL: "Combustible", OTHER: "Otro",
};
const CAT_BADGE: Record<string, string> = {
  FEED: "badge badge-green", VETERINARY: "badge badge-blue", LABOR: "badge badge-violet",
  EQUIPMENT: "badge badge-slate", TRANSPORT: "badge badge-teal",
  INFRASTRUCTURE: "badge badge-amber", SEED: "badge badge-green",
  FERTILIZER: "badge badge-green", FUEL: "badge badge-amber", OTHER: "badge badge-slate",
};
const COST_CATS = ["FEED","VETERINARY","LABOR","EQUIPMENT","TRANSPORT","INFRASTRUCTURE","SEED","FERTILIZER","FUEL","OTHER"];

function exportCostCSV(costs: CostEntry[]) {
  if (!costs.length) return;
  const headers = ["Fecha","Categoría","Descripción","Monto","Moneda"];
  const rows = costs.map(c => [
    new Date(c.occurredAt).toLocaleDateString("es-CO"),
    CAT_LABEL[c.category] ?? c.category,
    c.description ?? "",
    Number(c.amount).toFixed(2),
    c.currency,
  ].map(v => `"${v}"`).join(","));
  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `costos-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/feeding`,         label: "Alimentación"    },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`,          label: "Costos"          },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`,          label: "Auditoría"       },
  ];
}

export default function CostsPage() {
  const { farmId }  = useParams<{ farmId: string }>();
  const pathname    = usePathname();
  const [costs, setCosts]           = useState<CostEntry[]>([]);
  const [catSummary, setCatSummary] = useState<{ category: string; total: number }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [busy, setBusy]             = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const [newCat, setNewCat]   = useState("FEED");
  const [newAmt, setNewAmt]   = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [cr, sr] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/costs`),
        fetch(`/api/semse/agro/farms/${farmId}/costs/summary`),
      ]);
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj?.error?.message ?? "Error");
      setCosts((cj.data as any)?.costs ?? []);
      try { const sj = await sr.json(); setCatSummary((sj.data as any)?.summary ?? []); } catch { /* best-effort */ }
    } catch (err: any) { setError(err?.message ?? "Error cargando costos"); }
    finally { setLoading(false); }
  }

  function closeModal() { setShowModal(false); setFormError(null); setBusy(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!newAmt) return;
    setBusy(true); setFormError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/costs`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "FARM", category: newCat, amount: parseFloat(newAmt), description: newDesc || undefined, occurredAt: newDate ? new Date(newDate).toISOString() : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setNewCat("FEED"); setNewAmt(""); setNewDesc(""); setNewDate(new Date().toISOString().split("T")[0]);
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  const total = costs.reduce((s, c) => s + Number(c.amount), 0);
  const summaryData = catSummary.length > 0
    ? catSummary.sort((a, b) => b.total - a.total)
    : costs.reduce<{ category: string; total: number }[]>((acc, c) => {
        const ex = acc.find(x => x.category === c.category);
        if (ex) ex.total += Number(c.amount); else acc.push({ category: c.category, total: Number(c.amount) });
        return acc;
      }, []).sort((a, b) => b.total - a.total);

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Costos</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Registro de costos</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {costs.length > 0 && (
            <>
              <button className="btn-ghost" onClick={() => exportCostCSV(costs)}>
                <Download size={13} /> CSV
              </button>
              <button className="btn-ghost" onClick={() => window.print()}>
                <Printer size={13} /> PDF
              </button>
            </>
          )}
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Registrar costo
          </button>
        </div>
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

      {/* Summary strip */}
      {!loading && costs.length > 0 && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginBottom: 24 }}>
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <DollarSign size={13} color="var(--muted)" />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>
              ${total.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
            </p>
          </div>
          {summaryData.slice(0, 3).map(({ category, total: amt }) => (
            <div key={category} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <TrendingDown size={13} color="var(--muted)" />
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {CAT_LABEL[category] ?? category}
                </span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>
                ${Number(amt).toLocaleString("es-CO", { minimumFractionDigits: 0 })}
              </p>
              <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                {total > 0 ? `${((Number(amt) / total) * 100).toFixed(1)}%` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 48 }} />)}
        </div>
      ) : costs.length === 0 ? (
        <div className="empty-state">
          <DollarSign size={36} className="empty-icon" />
          <p className="empty-title">Sin costos registrados</p>
          <p className="empty-desc">Registra gastos de alimentación, veterinaria, mano de obra y más.</p>
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Registrar primer costo
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 130px 1fr 110px", gap: 0, padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span>Fecha</span><span>Categoría</span><span>Descripción</span><span style={{ textAlign: "right" }}>Monto</span>
          </div>
          {costs.map(c => (
            <div key={c.id} className="data-row" style={{ display: "grid", gridTemplateColumns: "90px 130px 1fr 110px", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {new Date(c.occurredAt).toLocaleDateString("es-CO")}
              </span>
              <span className={CAT_BADGE[c.category] ?? "badge badge-slate"} style={{ justifySelf: "start" }}>
                {CAT_LABEL[c.category] ?? c.category}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.description ?? "—"}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                ${Number(c.amount).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                <span style={{ fontSize: 10, color: "var(--faint)", marginLeft: 3 }}>{c.currency}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Registrar costo</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}

            <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Categoría *</label>
                <select className="fi" value={newCat} onChange={e => setNewCat(e.target.value)}>
                  {COST_CATS.map(c => <option key={c} value={c}>{CAT_LABEL[c] ?? c}</option>)}
                </select>
              </div>
              <div><label className="fl">Monto *</label><input className="fi" type="number" step="0.01" min="0" value={newAmt} onChange={e => setNewAmt(e.target.value)} required autoFocus placeholder="0.00" /></div>
              <div><label className="fl">Descripción</label><input className="fi" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Ej. Compra de vacuna aftosa" /></div>
              <div><label className="fl">Fecha</label><input className="fi" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Registrar costo"}</button>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
