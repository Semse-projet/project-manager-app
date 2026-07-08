"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight, TrendingUp, TrendingDown, Scale, AlertTriangle } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface ProfitabilityItem {
  targetType: "ANIMAL" | "ANIMAL_GROUP";
  targetId: string;
  label: string;
  species: string;
  purpose: string;
  totalCost: number;
  productionIncome: number;
  currentValue: number | null;
  profit: number | null;
  marginPercent: number | null;
  recommendation: string;
  riskLevel: string;
}
interface ProfitabilitySummary {
  totalItems: number; profitable: number; inLoss: number; missingData: number;
  totalCost: number; totalCurrentValue: number; totalProductionIncome: number;
  totalProjectedProfit: number; sellNow: number; sellSoon: number;
}

const REC_LABEL: Record<string, string> = {
  MAINTAIN: "Mantener", SELL_SOON: "Vender pronto", SELL_NOW: "Vender ahora",
  REVIEW_COSTS: "Revisar costos", LOSS_ALERT: "En pérdida", REVIEW_DATA: "Faltan datos",
};
const REC_BADGE: Record<string, string> = {
  MAINTAIN: "badge badge-green", SELL_SOON: "badge badge-amber", SELL_NOW: "badge badge-amber",
  REVIEW_COSTS: "badge badge-blue", LOSS_ALERT: "badge badge-red", REVIEW_DATA: "badge badge-slate",
};
const SPECIES_LABEL: Record<string, string> = {
  CATTLE: "Bovino", PIG: "Cerdo", GOAT: "Cabra", SHEEP: "Oveja", HORSE: "Caballo", CHICKEN: "Ave", OTHER: "Otro",
};
const PURPOSE_LABEL: Record<string, string> = {
  FATTENING: "Engorde", DAIRY: "Leche", BREEDING: "Reproducción", GENETICS: "Genética",
  LAYING: "Postura", RESALE: "Reventa", WORK: "Trabajo", OTHER: "General",
};

const money = (n: number) => `$${n.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

export default function ProfitabilityPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [items, setItems]     = useState<ProfitabilityItem[]>([]);
  const [summary, setSummary] = useState<ProfitabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/profitability`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setItems((json.data as any)?.items ?? []);
      setSummary((json.data as any)?.summary ?? null);
    } catch (err: any) { setError(err?.message ?? "Error cargando rentabilidad"); }
    finally { setLoading(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Rentabilidad</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Rentabilidad por animal y lote</h1>
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

      {!loading && summary && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Scale size={13} color="var(--muted)" />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Capital vivo</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>{money(summary.totalCurrentValue)}</p>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <TrendingDown size={13} color="var(--muted)" />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Costo acumulado</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>{money(summary.totalCost)}</p>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <TrendingUp size={13} color="var(--muted)" />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Utilidad proyectada</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: summary.totalProjectedProfit >= 0 ? "var(--ok, #16a34a)" : "var(--bad, #dc2626)" }}>
              {money(summary.totalProjectedProfit)}
            </p>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={13} color="var(--muted)" />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Estado</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--ink)" }}>{summary.profitable}</strong> rentables ·{" "}
              <strong style={{ color: "var(--ink)" }}>{summary.inLoss}</strong> en pérdida
              {summary.sellNow + summary.sellSoon > 0 && <> · <strong style={{ color: "var(--ink)" }}>{summary.sellNow + summary.sellSoon}</strong> por vender</>}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 48 }} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Scale size={36} className="empty-icon" />
          <p className="empty-title">Sin animales o lotes activos</p>
          <p className="empty-desc">Registra animales con costo de compra y valor estimado para ver su rentabilidad.</p>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 110px 110px 90px 130px", gap: 0, padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span>Animal / Lote</span><span>Propósito</span>
            <span style={{ textAlign: "right" }}>Costo total</span>
            <span style={{ textAlign: "right" }}>Valor + prod.</span>
            <span style={{ textAlign: "right" }}>Utilidad</span>
            <span style={{ textAlign: "right" }}>Margen</span>
            <span style={{ textAlign: "right" }}>Recomendación</span>
          </div>
          {items.map(item => (
            <div key={`${item.targetType}-${item.targetId}`} className="data-row" style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 110px 110px 90px 130px", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {item.label}
                <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 6 }}>
                  {SPECIES_LABEL[item.species] ?? item.species}{item.targetType === "ANIMAL_GROUP" ? " · lote" : ""}
                </span>
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{PURPOSE_LABEL[item.purpose] ?? item.purpose}</span>
              <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "right" }}>{money(item.totalCost)}</span>
              <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "right" }}>
                {item.currentValue != null ? money(item.currentValue + item.productionIncome) : "—"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: item.profit == null ? "var(--faint)" : item.profit >= 0 ? "var(--ok, #16a34a)" : "var(--bad, #dc2626)" }}>
                {item.profit != null ? money(item.profit) : "—"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: "var(--muted)" }}>
                {item.marginPercent != null ? `${item.marginPercent.toFixed(1)}%` : "—"}
              </span>
              <span className={REC_BADGE[item.recommendation] ?? "badge badge-slate"} style={{ justifySelf: "end" }}>
                {REC_LABEL[item.recommendation] ?? item.recommendation}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
