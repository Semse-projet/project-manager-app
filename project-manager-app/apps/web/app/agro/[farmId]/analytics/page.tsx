"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight, TrendingUp, TrendingDown, DollarSign, Scale, BarChart2, PieChart, Activity } from "lucide-react";

interface CostEntry {
  id: string; category: string; amount: number; currency: string;
  description?: string; occurredAt: string; targetType: string;
}
interface Animal {
  id: string; tagCode?: string; species: string; breed?: string;
  sex: string; status: string; currentWeight?: number;
  birthDate?: string; initialWeight?: number;
}

const CAT_LABEL: Record<string, string> = {
  FEED: "Alimentación", VETERINARY: "Veterinaria", LABOR: "Mano de obra",
  EQUIPMENT: "Equipo", TRANSPORT: "Transporte", INFRASTRUCTURE: "Infraestructura",
  SEED: "Semillas", FERTILIZER: "Fertilizante", FUEL: "Combustible", OTHER: "Otro",
};
const CAT_COLOR: Record<string, string> = {
  FEED: "#6ee7b7", VETERINARY: "#93c5fd", LABOR: "#c4b5fd",
  EQUIPMENT: "#94a3b8", TRANSPORT: "#67e8f9", INFRASTRUCTURE: "#fcd34d",
  SEED: "#6ee7b7", FERTILIZER: "#6ee7b7", FUEL: "#fca5a5", OTHER: "#64748b",
};

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/feeding`,        label: "Alimentación"    },
    { href: `/agro/${farmId}/health`,         label: "Salud"           },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`,          label: "Costos"          },
    { href: `/agro/${farmId}/analytics`,      label: "Analítica"       },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`,          label: "Auditoría"       },
  ];
}

// ── SVG Components ──────────────────────────────────────────────────────────

function BarChart({ data, color = "#6ee7b7" }: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = 36;
  const gap  = 10;
  const h    = 100;
  const totalW = data.length * (barW + gap) - gap;
  return (
    <svg
      viewBox={`0 0 ${totalW} ${h + 28}`}
      style={{ display: "block", width: "100%", maxHeight: 140 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * h, d.value > 0 ? 3 : 0);
        const x    = i * (barW + gap);
        const y    = h - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={h + 14} fontSize={8} textAnchor="middle" fill="#64748b">
              {d.label}
            </text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={Math.max(y - 4, 10)} fontSize={7} textAnchor="middle" fill="#94a3b8">
                ${d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ slices, size = 130 }: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (!total) return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--line)" }} />;
  const r     = size / 2 - 4;
  const inner = r * 0.58;
  const cx    = size / 2, cy = size / 2;
  let angle   = -Math.PI / 2;
  const paths = slices.filter(s => s.value > 0).map(sl => {
    const sweep = (sl.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const end = angle + sweep;
    const x2  = cx + r * Math.cos(end);
    const y2  = cy + r * Math.sin(end);
    const xi1 = cx + inner * Math.cos(end);
    const yi1 = cy + inner * Math.sin(end);
    const xi2 = cx + inner * Math.cos(angle);
    const yi2 = cy + inner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${xi1} ${yi1} A${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2} Z`;
    angle = end;
    return { d, color: sl.color, pct: ((sl.value / total) * 100).toFixed(0) };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)}
      <circle cx={cx} cy={cy} r={inner - 2} fill="var(--surface)" />
    </svg>
  );
}

function SparkLine({ data, w = 100, h = 36, color = "#6ee7b7" }: {
  data: number[]; w?: number; h?: number; color?: string;
}) {
  if (data.length < 2) return null;
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const pts   = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [, m] = key.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return months[parseInt(m, 10) - 1] ?? m;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [costs, setCosts]     = useState<CostEntry[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const tabs = farmId ? farmTabs(farmId) : [];

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [cr, ar] = await Promise.all([
        fetch(`/api/semse/agro/farms/${farmId}/costs`),
        fetch(`/api/semse/agro/farms/${farmId}/animals`),
      ]);
      const cj = await cr.json();
      const aj = await ar.json();
      setCosts((cj.data as any)?.costs ?? []);
      setAnimals((aj.data as any)?.animals ?? []);
    } catch (err: any) { setError(err?.message ?? "Error"); }
    finally { setLoading(false); }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  // Last 6 months
  const now    = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: monthKey(d), label: monthLabel(monthKey(d)) };
  });

  const costByMonth = months.map(m => ({
    label: m.label,
    value: costs
      .filter(c => monthKey(new Date(c.occurredAt)) === m.key)
      .reduce((s, c) => s + Number(c.amount), 0),
  }));

  const costByCategory = Object.entries(CAT_LABEL).map(([cat, label]) => {
    const total = costs.filter(c => c.category === cat).reduce((s, c) => s + Number(c.amount), 0);
    return { label, value: total, color: CAT_COLOR[cat] ?? "#64748b" };
  }).filter(s => s.value > 0).sort((a, b) => b.value - a.value);

  const totalCost = costs.reduce((s, c) => s + Number(c.amount), 0);

  const activeAnimals = animals.filter(a => a.status === "ACTIVE");
  const withWeight    = activeAnimals.filter(a => a.currentWeight);
  const totalWeight   = withWeight.reduce((s, a) => s + Number(a.currentWeight ?? 0), 0);
  const avgWeight     = withWeight.length ? totalWeight / withWeight.length : 0;
  const maxWeight     = withWeight.length ? Math.max(...withWeight.map(a => Number(a.currentWeight ?? 0))) : 0;
  const costPerAnimal = activeAnimals.length ? totalCost / activeAnimals.length : 0;

  // Weight distribution buckets
  const buckets = [
    { label: "<100", min: 0,   max: 100  },
    { label: "100-200", min: 100, max: 200 },
    { label: "200-350", min: 200, max: 350 },
    { label: "350-500", min: 350, max: 500 },
    { label: ">500",  min: 500, max: Infinity },
  ];
  const weightDist = buckets.map(b => ({
    label: b.label,
    value: withWeight.filter(a => Number(a.currentWeight ?? 0) >= b.min && Number(a.currentWeight ?? 0) < b.max).length,
  }));

  // Species breakdown
  const speciesMap: Record<string, number> = {};
  for (const a of activeAnimals) speciesMap[a.species] = (speciesMap[a.species] ?? 0) + 1;
  const speciesColors = ["#6ee7b7","#93c5fd","#fcd34d","#c4b5fd","#fca5a5","#67e8f9"];
  const speciesSlices = Object.entries(speciesMap).map(([sp, cnt], i) => ({
    label: sp, value: cnt, color: speciesColors[i % speciesColors.length],
  }));

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Analítica</span>
      </nav>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Analítica</h1>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Tendencias, distribuciones y eficiencia financiera</p>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "grid", gap: 16 }}>
          {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 180 }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── KPI strip ── */}
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {[
              { label: "Gasto total",        value: `$${totalCost.toLocaleString("es-CO",{maximumFractionDigits:0})}`,    Icon: DollarSign, color: "#fca5a5" },
              { label: "Costo / animal",      value: `$${costPerAnimal.toLocaleString("es-CO",{maximumFractionDigits:0})}`, Icon: TrendingDown, color: "#fcd34d" },
              { label: "Animales activos",    value: activeAnimals.length,                                                  Icon: Activity,    color: "#6ee7b7" },
              { label: "Peso promedio (kg)",  value: avgWeight.toFixed(1),                                                  Icon: Scale,       color: "#93c5fd" },
              { label: "Peso total (kg)",     value: totalWeight.toLocaleString("es-CO",{maximumFractionDigits:0}),         Icon: TrendingUp,  color: "#c4b5fd" },
              { label: "Peso máx (kg)",       value: maxWeight.toFixed(1),                                                  Icon: BarChart2,   color: "#67e8f9" },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
                <Icon size={13} color={color} style={{ marginBottom: 6 }} />
                <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Monthly cost trend ── */}
          <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <BarChart2 size={14} color="var(--muted)" />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Tendencia de costos — últimos 6 meses</h2>
            </div>
            {totalCost === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>Sin costos registrados aún</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 320 }}>
                  <BarChart data={costByMonth} color="#6ee7b7" />
                </div>
              </div>
            )}
          </div>

          {/* ── Category breakdown + Species ── */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>

            {/* Category donut */}
            <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <PieChart size={14} color="var(--muted)" />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Por categoría</h2>
              </div>
              {costByCategory.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)" }}>Sin datos</p>
              ) : (
                <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <DonutChart slices={costByCategory} size={130} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 120 }}>
                    {costByCategory.slice(0, 6).map(s => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "block", flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", flexShrink: 0 }}>
                          {totalCost > 0 ? `${((s.value / totalCost) * 100).toFixed(0)}%` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Species donut */}
            <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Activity size={14} color="var(--muted)" />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Por especie</h2>
              </div>
              {speciesSlices.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)" }}>Sin animales activos</p>
              ) : (
                <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <DonutChart slices={speciesSlices} size={130} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 100 }}>
                    {speciesSlices.map(s => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "block", flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--muted)", flex: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Weight distribution ── */}
          {withWeight.length > 0 && (
            <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <Scale size={14} color="var(--muted)" />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Distribución de peso (kg) — {withWeight.length} animales</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 280 }}>
                  <BarChart data={weightDist} color="#93c5fd" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Promedio</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{avgWeight.toFixed(1)} kg</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Máximo</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{maxWeight.toFixed(1)} kg</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Total kg</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{totalWeight.toLocaleString("es-CO",{maximumFractionDigits:0})}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Costo/kg</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: totalWeight > 0 ? "var(--ink)" : "var(--faint)" }}>
                    ${totalWeight > 0 ? (totalCost / totalWeight).toFixed(2) : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Sparklines for last 6 months costs ── */}
          {costByMonth.some(m => m.value > 0) && (
            <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Resumen financiero</h2>
                <Link href={`/agro/${farmId}/costs`} style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>Ver detalle →</Link>
              </div>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {costByCategory.slice(0, 4).map(cat => (
                  <div key={cat.label} style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, display: "block" }} />
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{cat.label}</span>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                      ${cat.value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                      {totalCost > 0 ? `${((cat.value / totalCost) * 100).toFixed(1)}% del total` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
