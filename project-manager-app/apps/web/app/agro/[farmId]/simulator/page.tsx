"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight, Calculator, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface Simulation {
  totalProjectedCost: number;
  dailyCost: number | null;
  grossIncome: number;
  expectedProfit: number;
  marginPercent: number;
  roiPercent: number | null;
  breakEvenSalePrice: number;
  maxRecommendedPurchasePrice: number;
  recommendation: "BUY" | "NEGOTIATE" | "DONT_BUY";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  rationale: string[];
}

const REC_META = {
  BUY:      { label: "Comprar",    icon: CheckCircle2,  color: "var(--ok, #16a34a)" },
  NEGOTIATE:{ label: "Negociar",   icon: AlertTriangle, color: "var(--warn, #d97706)" },
  DONT_BUY: { label: "No comprar", icon: XCircle,       color: "var(--bad, #dc2626)" },
} as const;

const money = (n: number) => `$${n.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

export default function SimulatorPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [result, setResult] = useState<Simulation | null>(null);

  const [purchasePrice, setPurchasePrice] = useState("");
  const [freight, setFreight]             = useState("");
  const [feed, setFeed]                   = useState("");
  const [medicine, setMedicine]           = useState("");
  const [labor, setLabor]                 = useState("");
  const [other, setOther]                 = useState("");
  const [salePrice, setSalePrice]         = useState("");
  const [prodIncome, setProdIncome]       = useState("");
  const [days, setDays]                   = useState("");
  const [mortality, setMortality]         = useState("");

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault(); if (!purchasePrice || !salePrice) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/semse/agro/simulator/purchase`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purchasePrice: parseFloat(purchasePrice),
          freightCost: freight ? parseFloat(freight) : undefined,
          feedCostProjected: feed ? parseFloat(feed) : undefined,
          medicineCost: medicine ? parseFloat(medicine) : undefined,
          laborCost: labor ? parseFloat(labor) : undefined,
          otherCosts: other ? parseFloat(other) : undefined,
          expectedSalePrice: parseFloat(salePrice),
          expectedProductionIncome: prodIncome ? parseFloat(prodIncome) : undefined,
          holdingDays: days ? parseInt(days, 10) : undefined,
          expectedMortalityPercent: mortality ? parseFloat(mortality) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setResult((json.data as any)?.simulation ?? null);
    } catch (err: any) { setError(err?.message ?? "Error simulando compra"); setResult(null); }
    finally { setBusy(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];
  const rec = result ? REC_META[result.recommendation] : null;
  const RecIcon = rec?.icon ?? Calculator;

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Simulador</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Simulador de compra</h1>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, maxWidth: 640 }}>
        Antes de comprar un animal o lote, proyecta el costo total, la utilidad esperada y el margen.
        El simulador recomienda comprar, negociar o no comprar según las reglas de la finca (margen mínimo 20% para comprar).
      </p>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) 1fr", gap: 20, alignItems: "start" }}>
        <form onSubmit={e => void handleSimulate(e)}
          style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="fl">Precio de compra *</label><input className="fi" type="number" step="0.01" min="0" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required autoFocus placeholder="0.00" /></div>
            <div><label className="fl">Flete</label><input className="fi" type="number" step="0.01" min="0" value={freight} onChange={e => setFreight(e.target.value)} placeholder="0.00" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="fl">Alimento proyectado</label><input className="fi" type="number" step="0.01" min="0" value={feed} onChange={e => setFeed(e.target.value)} placeholder="0.00" /></div>
            <div><label className="fl">Medicina</label><input className="fi" type="number" step="0.01" min="0" value={medicine} onChange={e => setMedicine(e.target.value)} placeholder="0.00" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="fl">Mano de obra</label><input className="fi" type="number" step="0.01" min="0" value={labor} onChange={e => setLabor(e.target.value)} placeholder="0.00" /></div>
            <div><label className="fl">Otros costos</label><input className="fi" type="number" step="0.01" min="0" value={other} onChange={e => setOther(e.target.value)} placeholder="0.00" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="fl">Venta esperada *</label><input className="fi" type="number" step="0.01" min="0" value={salePrice} onChange={e => setSalePrice(e.target.value)} required placeholder="0.00" /></div>
            <div><label className="fl">Ingreso por producción</label><input className="fi" type="number" step="0.01" min="0" value={prodIncome} onChange={e => setProdIncome(e.target.value)} placeholder="0.00" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="fl">Días de tenencia</label><input className="fi" type="number" min="1" value={days} onChange={e => setDays(e.target.value)} placeholder="Ej. 45" /></div>
            <div><label className="fl">Mortalidad esperada %</label><input className="fi" type="number" step="0.1" min="0" max="99" value={mortality} onChange={e => setMortality(e.target.value)} placeholder="0" /></div>
          </div>
          <button type="submit" className="btn-accent" disabled={busy}>
            <Calculator size={13} /> {busy ? "Calculando…" : "Simular compra"}
          </button>
        </form>

        {result && rec ? (
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <RecIcon size={22} color={rec.color} />
              <span style={{ fontSize: 18, fontWeight: 800, color: rec.color, letterSpacing: "-0.02em" }}>{rec.label}</span>
              <span className="badge badge-slate" style={{ marginLeft: "auto" }}>
                Riesgo {result.riskLevel === "LOW" ? "bajo" : result.riskLevel === "MEDIUM" ? "medio" : "alto"}
              </span>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 16 }}>
              {[
                { label: "Costo total proyectado", value: money(result.totalProjectedCost) },
                { label: "Ingreso esperado", value: money(result.grossIncome) },
                { label: "Utilidad esperada", value: money(result.expectedProfit), color: result.expectedProfit >= 0 ? "var(--ok, #16a34a)" : "var(--bad, #dc2626)" },
                { label: "Margen", value: `${result.marginPercent.toFixed(1)}%` },
                ...(result.roiPercent != null ? [{ label: "ROI sobre compra", value: `${result.roiPercent.toFixed(1)}%` }] : []),
                ...(result.dailyCost != null ? [{ label: "Costo diario", value: money(result.dailyCost) }] : []),
                { label: "Punto de equilibrio (venta)", value: money(result.breakEvenSalePrice) },
                { label: "Precio máx. de compra", value: money(result.maxRecommendedPurchasePrice) },
              ].map(card => (
                <div key={card.label} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px" }}>
                  <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{card.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: (card as any).color ?? "var(--ink)" }}>{card.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {result.rationale.map((line, i) => (
                <p key={i} style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, display: "flex", gap: 6 }}>
                  <span style={{ color: "var(--faint)" }}>•</span> {line}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ minHeight: 260 }}>
            <Calculator size={36} className="empty-icon" />
            <p className="empty-title">Proyecta antes de comprar</p>
            <p className="empty-desc">Llena los datos de la compra y el sistema calculará si conviene, a qué precio máximo, y cuál sería tu punto de equilibrio.</p>
          </div>
        )}
      </div>
    </div>
  );
}
