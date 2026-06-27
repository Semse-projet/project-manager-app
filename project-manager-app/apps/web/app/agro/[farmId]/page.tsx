"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  AlertTriangle, Info, AlertCircle, Beef, CheckSquare, Package,
  DollarSign, TrendingUp, Leaf, ChevronRight, ChevronLeft, Cloud,
  Droplets, Wind, Sun, CloudRain, Zap,
} from "lucide-react";

interface Alert {
  type: string; severity: "CRITICAL" | "WARNING" | "INFO";
  entityType: string; entityId: string; message: string;
}
interface DashboardData {
  farm: { id: string; name: string; operationType: string };
  counts: {
    animals: number; animalGroups: number; totalAnimals: number;
    pendingTasks: number; blockedTasks: number; overdueTasks: number;
    completedThisWeek: number; inventoryItems: number; lowStockItems: number;
  };
  monthCostSummary: { total: number; since: string; currency: string };
  alerts: Alert[];
  nextBestActions: { priority: number; action: string; detail: string }[];
}
interface AnimalCard {
  id: string; tagCode?: string; species: string; breed?: string;
  sex: string; status: string; currentWeight?: number;
}
interface Weather {
  temp: number; humidity: number; windspeed: number;
  code: number; precip: number;
}

const ALERT_CFG: Record<string, { cls: string; Icon: typeof AlertTriangle }> = {
  CRITICAL: { cls: "alert-critical", Icon: AlertCircle },
  WARNING:  { cls: "alert-warning",  Icon: AlertTriangle },
  INFO:     { cls: "alert-info",     Icon: Info },
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "badge badge-green", SOLD: "badge badge-slate",
  DEAD: "badge badge-red", LOST: "badge badge-amber", INACTIVE: "badge badge-slate",
};

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`,          label: "Costos"          },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`,          label: "Auditoría"       },
  ];
}

function StatCard({ label, value, icon: Icon, danger }: {
  label: string; value: string | number; icon?: typeof Beef; danger?: boolean;
}) {
  return (
    <div className={danger ? "stat-danger" : ""} style={{
      borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      {Icon && <Icon size={14} color={danger ? "#fca5a5" : "var(--muted)"} />}
      <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p className={danger ? "sv" : ""} style={{ fontSize: 22, fontWeight: 800, color: danger ? "#fca5a5" : "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

function weatherIcon(code: number) {
  if (code === 0)              return <Sun size={22} color="#fcd34d" />;
  if (code <= 3)               return <Cloud size={22} color="#93c5fd" />;
  if (code >= 51 && code <=67) return <CloudRain size={22} color="#93c5fd" />;
  if (code >= 80 && code <=82) return <CloudRain size={22} color="#93c5fd" />;
  if (code >= 95)              return <Zap size={22} color="#fca5a5" />;
  return <Cloud size={22} color="#94a3b8" />;
}
function weatherLabel(code: number) {
  if (code === 0)              return "Despejado";
  if (code <= 3)               return "Parcialmente nublado";
  if (code >= 45 && code <=48) return "Niebla";
  if (code >= 51 && code <=67) return "Lluvia";
  if (code >= 71 && code <=77) return "Nieve";
  if (code >= 80 && code <=82) return "Aguaceros";
  if (code >= 95)              return "Tormenta";
  return "Nublado";
}

function WeatherWidget() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=4.71&longitude=-74.07&current=temperature_2m,relative_humidity_2m,precipitation,windspeed_10m,weathercode&timezone=America%2FBogota"
        );
        const json = await res.json();
        const c    = json.current;
        setWeather({
          temp:      c.temperature_2m,
          humidity:  c.relative_humidity_2m,
          windspeed: c.windspeed_10m,
          code:      c.weathercode,
          precip:    c.precipitation,
        });
      } catch { /* best-effort */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="skel" style={{ height: 90, borderRadius: 12 }} />;
  if (!weather) return null;

  const agroAlert = weather.precip > 5
    ? { cls: "alert-warning", msg: "Lluvia intensa — revisar drenajes y animales al aire libre" }
    : weather.temp > 35
    ? { cls: "alert-warning", msg: "Temperatura alta — asegurar sombra y agua" }
    : weather.temp < 8
    ? { cls: "alert-info",    msg: "Temperatura baja — revisar crías y recién nacidos" }
    : null;

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: agroAlert ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {weatherIcon(weather.code)}
          <div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {weather.temp.toFixed(1)}<span style={{ fontSize: 14, fontWeight: 500, color: "var(--muted)" }}>°C</span>
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{weatherLabel(weather.code)}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <Droplets size={14} color="#93c5fd" style={{ margin: "0 auto 3px" }} />
            <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{weather.humidity}%</p>
            <p style={{ fontSize: 10, color: "var(--faint)" }}>Humedad</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <Wind size={14} color="#94a3b8" style={{ margin: "0 auto 3px" }} />
            <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{weather.windspeed} km/h</p>
            <p style={{ fontSize: 10, color: "var(--faint)" }}>Viento</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <CloudRain size={14} color="#93c5fd" style={{ margin: "0 auto 3px" }} />
            <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{weather.precip} mm</p>
            <p style={{ fontSize: 10, color: "var(--faint)" }}>Precip.</p>
          </div>
        </div>
      </div>
      {agroAlert && (
        <div className={`alert-banner ${agroAlert.cls}`} style={{ fontSize: 11, marginTop: 0 }}>{agroAlert.msg}</div>
      )}
    </div>
  );
}

function AnimalCarousel({ farmId }: { farmId: string }) {
  const [animals, setAnimals] = useState<AnimalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch(`/api/semse/agro/farms/${farmId}/animals`);
        const json = await res.json();
        const list = (json.data as any)?.animals ?? [];
        setAnimals(list.slice(0, 20));
      } catch { /* best-effort */ }
      finally { setLoading(false); }
    })();
  }, [farmId]);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  }

  if (loading) return (
    <div style={{ display: "flex", gap: 10 }}>
      {[1,2,3,4].map(i => <div key={i} className="skel" style={{ width: 160, height: 90, flexShrink: 0, borderRadius: 12 }} />)}
    </div>
  );
  if (animals.length === 0) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          Animales recientes <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", marginLeft: 4 }}>({animals.length})</span>
        </h2>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => scroll("left")}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 8px", color: "var(--muted)", cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => scroll("right")}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 8px", color: "var(--muted)", cursor: "pointer", display: "flex" }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
        {animals.map(animal => (
          <Link key={animal.id} href={`/agro/${farmId}/animals/${animal.id}`}
            style={{
              flexShrink: 0, width: 160, borderRadius: 12,
              border: "1px solid var(--border)", background: "var(--surface)",
              padding: "12px 14px", textDecoration: "none", display: "block",
              transition: "transform 140ms, border-color 140ms",
            }}
            className="card-lift"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(16,185,129,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Beef size={14} color="#6ee7b7" />
              </div>
              <span className={STATUS_BADGE[animal.status] ?? "badge badge-slate"} style={{ fontSize: 10 }}>
                {animal.status}
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {animal.tagCode ? `#${animal.tagCode}` : animal.species}
            </p>
            <p style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {animal.species}{animal.breed ? ` · ${animal.breed}` : ""}
            </p>
            {animal.currentWeight != null && (
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6ee7b7", marginTop: 6 }}>
                {Number(animal.currentWeight).toFixed(1)} kg
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SkeletonDash() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="skel" style={{ height: 28, width: 200 }} />
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {[1,2,3,4,5,6,7].map(i => <div key={i} className="skel" style={{ height: 78 }} />)}
      </div>
    </div>
  );
}

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/dashboard`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setData(json.data as DashboardData);
    } catch (err: any) { setError(err?.message ?? "Error cargando dashboard"); }
    finally { setLoading(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>{data?.farm.name ?? "Finca"}</span>
      </nav>

      {data && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Leaf size={20} color="#6ee7b7" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {data.farm.name}
            </h1>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{data.farm.operationType}</p>
          </div>
        </div>
      )}

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      {loading && <SkeletonDash />}
      {error && <div className="alert-banner alert-critical">{error}</div>}

      {!loading && !error && data && (() => {
        const { counts, monthCostSummary, alerts, nextBestActions } = data;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alerts.map((alert, i) => {
                  const cfg = ALERT_CFG[alert.severity] ?? ALERT_CFG.INFO;
                  const Icon = cfg.Icon;
                  return (
                    <div key={i} className={`alert-banner ${cfg.cls}`} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Icon size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        <strong style={{ textTransform: "capitalize", marginRight: 4 }}>{alert.type.replace(/_/g, " ")}</strong>
                        {alert.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stat grid */}
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))" }}>
              <StatCard label="Animales"           value={counts.totalAnimals}          icon={Beef} />
              <StatCard label="Pend. tareas"       value={counts.pendingTasks}           icon={CheckSquare} />
              <StatCard label="Vencidas"           value={counts.overdueTasks}           icon={AlertTriangle} danger={counts.overdueTasks > 0} />
              <StatCard label="Completadas / sem." value={counts.completedThisWeek}      icon={TrendingUp} />
              <StatCard label="Inventario"         value={counts.inventoryItems}         icon={Package} />
              <StatCard label="Stock bajo"         value={counts.lowStockItems}          icon={Package} danger={counts.lowStockItems > 0} />
              <StatCard
                label="Costo del mes"
                value={`$${monthCostSummary.total.toLocaleString("es-CO", { minimumFractionDigits: 0 })} ${monthCostSummary.currency}`}
                icon={DollarSign}
              />
            </div>

            {/* Weather widget */}
            <WeatherWidget />

            {/* Animal carousel */}
            {farmId && <AnimalCarousel farmId={farmId} />}

            {/* Next best actions */}
            {nextBestActions.length > 0 && (
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "18px 20px" }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 14, letterSpacing: "-0.01em" }}>
                  Próximas acciones recomendadas
                </h2>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {nextBestActions.map((action, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{
                        flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                        background: "var(--accent-dim)", color: "var(--accent)", fontSize: 11, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {action.priority}
                      </span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, marginBottom: 2 }}>
                          {action.action.replace(/_/g, " ")}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--muted)" }}>{action.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
