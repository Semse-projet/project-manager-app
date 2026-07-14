"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, HandCoins, ChevronRight, TrendingUp } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface SaleRecord {
  id: string; targetType: string; targetId: string; buyerName?: string | null;
  quantity: number; salePrice: number; freightCost?: number | null; commission?: number | null;
  totalCostBasis?: number | null; netProfit?: number | null; marginPercent?: number | null;
  currency: string; occurredAt: string; notes?: string | null;
}
interface SalesSummary { salesCount: number; headsSold: number; totalRevenue: number; totalProfit: number }
interface SellTarget { id: string; label: string; kind: "ANIMAL" | "ANIMAL_GROUP"; count?: number }

const PAY_LABEL: Record<string, string> = {
  CASH: "Efectivo", TRANSFER: "Transferencia", CHECK: "Cheque", CREDIT: "Crédito", OTHER: "Otro",
};
const money = (n: number) => `$${n.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

export default function SalesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [sales, setSales]     = useState<SaleRecord[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [targets, setTargets] = useState<SellTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [sellTarget, setSellTarget] = useState("");
  const [sellQty, setSellQty]       = useState("");
  const [sellPrice, setSellPrice]   = useState("");
  const [sellFreight, setSellFreight] = useState("");
  const [sellCommission, setSellCommission] = useState("");
  const [sellBuyer, setSellBuyer]   = useState("");
  const [sellMethod, setSellMethod] = useState("CASH");
  const [sellDate, setSellDate]     = useState(new Date().toISOString().split("T")[0]);
  const [sellNotes, setSellNotes]   = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [sr, sumR, ar, gr] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/sales`),
        fetch(`/api/semse/agro/farms/${farmId}/sales/summary?days=30`),
        fetch(`/api/semse/agro/farms/${farmId}/animals`),
        fetch(`/api/semse/agro/farms/${farmId}/groups`),
      ]);
      const sj = await sr.json();
      if (!sr.ok) throw new Error(sj?.error?.message ?? "Error");
      setSales((sj.data as any)?.sales ?? []);
      try { const sumJ = await sumR.json(); setSummary((sumJ.data as any)?.summary ?? null); } catch { /* best-effort */ }
      try {
        const aj = await ar.json(); const gj = await gr.json();
        const animals = ((aj.data as any)?.animals ?? [])
          .filter((a: any) => a.status === "ACTIVE")
          .map((a: any) => ({ id: a.id, label: `Animal ${a.tagCode ?? a.id.slice(-6)}`, kind: "ANIMAL" as const }));
        const groups = ((gj.data as any)?.groups ?? [])
          .filter((g: any) => g.status === "ACTIVE" && g.count > 0)
          .map((g: any) => ({ id: g.id, label: `Lote ${g.name} (${g.count})`, kind: "ANIMAL_GROUP" as const, count: g.count }));
        setTargets([...animals, ...groups]);
      } catch { /* best-effort */ }
    } catch (err: any) { setError(err?.message ?? "Error cargando ventas"); }
    finally { setLoading(false); }
  }

  function closeModal() { setShowModal(false); setFormError(null); setBusy(false); }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault(); if (!sellTarget || !sellPrice) return;
    setBusy(true); setFormError(null);
    try {
      const target = targets.find(t => t.id === sellTarget);
      if (!target) throw new Error("Selecciona un animal o lote");
      const path = target.kind === "ANIMAL"
        ? `/api/semse/agro/animals/${target.id}/sell`
        : `/api/semse/agro/animal-groups/${target.id}/sell`;
      const res = await fetch(path, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          salePrice: parseFloat(sellPrice),
          quantity: target.kind === "ANIMAL_GROUP" && sellQty ? parseInt(sellQty, 10) : undefined,
          freightCost: sellFreight ? parseFloat(sellFreight) : undefined,
          commission: sellCommission ? parseFloat(sellCommission) : undefined,
          buyerName: sellBuyer || undefined,
          paymentMethod: sellMethod,
          occurredAt: sellDate ? new Date(sellDate).toISOString() : undefined,
          notes: sellNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setSellTarget(""); setSellQty(""); setSellPrice(""); setSellFreight("");
      setSellCommission(""); setSellBuyer(""); setSellNotes("");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setBusy(false); }
  }

  const selectedTarget = targets.find(t => t.id === sellTarget);
  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Ventas</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Ventas y cierres</h1>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={13} /> Registrar venta
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

      {!loading && summary && summary.salesCount > 0 && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
          {[
            { label: "Ventas 30 días", value: String(summary.salesCount) },
            { label: "Cabezas vendidas", value: String(summary.headsSold) },
            { label: "Ingreso bruto", value: money(summary.totalRevenue) },
            { label: "Utilidad neta", value: money(summary.totalProfit), colored: true },
          ].map(card => (
            <div key={card.label} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <TrendingUp size={13} color="var(--muted)" />
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</span>
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: card.colored ? (summary.totalProfit >= 0 ? "var(--ok, #16a34a)" : "var(--bad, #dc2626)") : "var(--ink)" }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 48 }} />)}
        </div>
      ) : sales.length === 0 ? (
        <div className="empty-state">
          <HandCoins size={36} className="empty-icon" />
          <p className="empty-title">Sin ventas registradas</p>
          <p className="empty-desc">Al vender un animal o lote, el sistema calcula automáticamente la utilidad final contra su costo acumulado.</p>
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Registrar primera venta
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px 110px 110px 110px 90px", gap: 0, padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span>Fecha</span><span>Comprador</span><span style={{ textAlign: "right" }}>Cant.</span>
            <span style={{ textAlign: "right" }}>Venta</span>
            <span style={{ textAlign: "right" }}>Costo base</span>
            <span style={{ textAlign: "right" }}>Utilidad</span>
            <span style={{ textAlign: "right" }}>Margen</span>
          </div>
          {sales.map(s => (
            <div key={s.id} className="data-row" style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px 110px 110px 110px 90px", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(s.occurredAt).toLocaleDateString("es-CO")}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {s.buyerName ?? "—"}
                <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 6 }}>{s.targetType === "ANIMAL_GROUP" ? "lote" : "animal"}</span>
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)", textAlign: "right" }}>{s.quantity}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>{money(Number(s.salePrice))}</span>
              <span style={{ fontSize: 13, color: "var(--muted)", textAlign: "right" }}>
                {s.totalCostBasis != null ? money(Number(s.totalCostBasis)) : "—"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: s.netProfit == null ? "var(--faint)" : Number(s.netProfit) >= 0 ? "var(--ok, #16a34a)" : "var(--bad, #dc2626)" }}>
                {s.netProfit != null ? money(Number(s.netProfit)) : "—"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textAlign: "right" }}>
                {s.marginPercent != null ? `${Number(s.marginPercent).toFixed(1)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Registrar venta</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}

            <form onSubmit={e => void handleSell(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Animal o lote *</label>
                <select className="fi" value={sellTarget} onChange={e => setSellTarget(e.target.value)} required>
                  <option value="">Selecciona…</option>
                  {targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              {selectedTarget?.kind === "ANIMAL_GROUP" && (
                <div>
                  <label className="fl">Cantidad a vender (máx. {selectedTarget.count})</label>
                  <input className="fi" type="number" min="1" max={selectedTarget.count} value={sellQty}
                    onChange={e => setSellQty(e.target.value)} placeholder={`${selectedTarget.count} (todo el lote)`} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="fl">Precio de venta *</label><input className="fi" type="number" step="0.01" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)} required placeholder="0.00" /></div>
                <div><label className="fl">Fecha</label><input className="fi" type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="fl">Flete de salida</label><input className="fi" type="number" step="0.01" min="0" value={sellFreight} onChange={e => setSellFreight(e.target.value)} placeholder="0.00" /></div>
                <div><label className="fl">Comisión</label><input className="fi" type="number" step="0.01" min="0" value={sellCommission} onChange={e => setSellCommission(e.target.value)} placeholder="0.00" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="fl">Comprador</label><input className="fi" value={sellBuyer} onChange={e => setSellBuyer(e.target.value)} placeholder="Nombre" /></div>
                <div>
                  <label className="fl">Método de pago</label>
                  <select className="fi" value={sellMethod} onChange={e => setSellMethod(e.target.value)}>
                    {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="fl">Notas</label><input className="fi" value={sellNotes} onChange={e => setSellNotes(e.target.value)} placeholder="Ej. Venta en subasta local" /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-accent" disabled={busy} style={{ flex: 1 }}>{busy ? "Guardando…" : "Registrar venta"}</button>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
