"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Layers, TrendingUp, Users, ClipboardList, Package, DollarSign, AlertTriangle, Sprout } from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";

interface Farm {
  id: string;
  name: string;
  location?: string;
  farmType?: string;
  hectares?: number;
  status?: string;
  createdAt?: string;
}

interface FarmDashboard {
  totalAnimals?: number;
  activeAnimals?: number;
  animalGroups?: number;
  pendingTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
  lowStockItems?: number;
  totalCostMonth?: number;
}

interface FarmWithDash extends Farm {
  dash: FarmDashboard | null;
  loading: boolean;
}

export default function AdminAgroPage() {
  const [farms, setFarms] = useState<FarmWithDash[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadFarms(); }, []);

  async function loadFarms() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/semse/agro");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      const list: Farm[] = (json.data as any)?.farms ?? [];
      const rows: FarmWithDash[] = list.map(f => ({ ...f, dash: null, loading: true }));
      setFarms(rows);
      setLoading(false);
      // Load dashboards in parallel
      await Promise.all(rows.map(async (farm, idx) => {
        try {
          const dr   = await fetch(`/api/semse/agro/farms/${farm.id}/dashboard`);
          const dj   = await dr.json();
          const dash = dr.ok ? ((dj.data as any)?.stats ?? dj.data ?? null) : null;
          setFarms(prev => prev.map((p, i) => i === idx ? { ...p, dash, loading: false } : p));
        } catch {
          setFarms(prev => prev.map((p, i) => i === idx ? { ...p, loading: false } : p));
        }
      }));
    } catch (err: any) {
      setError(err?.message ?? "Error cargando fincas");
      setLoading(false);
    }
  }

  // Aggregate totals
  const totals = farms.reduce((acc, f) => {
    if (!f.dash) return acc;
    return {
      animals:    acc.animals    + (f.dash.totalAnimals  ?? 0),
      groups:     acc.groups     + (f.dash.animalGroups  ?? 0),
      tasks:      acc.tasks      + (f.dash.pendingTasks  ?? 0),
      overdue:    acc.overdue    + (f.dash.overdueTasks  ?? 0),
      lowStock:   acc.lowStock   + (f.dash.lowStockItems ?? 0),
    };
  }, { animals: 0, groups: 0, tasks: 0, overdue: 0, lowStock: 0 });

  const hasDash = farms.some(f => f.dash);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <AdminPageHeader
        title="Agro / FarmOps"
        subtitle="Administración centralizada de fincas, ganado, tareas e inventario"
        icon={Sprout}
        iconColor="#4ade80"
        iconBg="rgba(74,222,128,.12)"
        backHref="/admin/verticals"
        backLabel="Verticals"
        actions={
          <Link href="/agro" className="btn-ghost" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <ExternalLink size={12} /> Ir a Agro
          </Link>
        }
      />

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Aggregate KPIs */}
      {hasDash && (
        <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
          {[
            { label: "Fincas",        value: farms.length,    color: "#6ee7b7", Icon: Layers },
            { label: "Animales",      value: totals.animals,  color: "#93c5fd", Icon: Users },
            { label: "Grupos",        value: totals.groups,   color: "#c4b5fd", Icon: Layers },
            { label: "Tareas pend.",  value: totals.tasks,    color: "#fcd34d", Icon: ClipboardList },
            { label: "Vencidas",      value: totals.overdue,  color: totals.overdue > 0 ? "#fca5a5" : "#6ee7b7", Icon: AlertTriangle },
            { label: "Stock bajo",    value: totals.lowStock, color: totals.lowStock > 0 ? "#fcd34d" : "#6ee7b7", Icon: Package },
          ].map(s => (
            <div key={s.label} style={{
              borderRadius: 12, border: "1px solid var(--border)", borderTop: `3px solid ${s.color}`,
              background: "var(--surface)", padding: "14px 16px",
            }}>
              <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </section>
      )}

      {/* Farms list */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
            Fincas ({farms.length})
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 100, borderRadius: 12 }} />)}
          </div>
        ) : farms.length === 0 ? (
          <div className="empty-state">
            <Layers size={36} className="empty-icon" />
            <p className="empty-title">Sin fincas</p>
            <p className="empty-desc">Crea la primera finca desde la app Agro.</p>
            <Link href="/agro" className="btn-accent">Ir a Agro</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {farms.map(farm => {
              const d = farm.dash;
              return (
                <div key={farm.id} style={{
                  borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
                  padding: "16px 18px", display: "flex", gap: 16, alignItems: "flex-start",
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, background: "rgba(110,231,183,.1)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20,
                  }}>
                    🌿
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{farm.name}</p>
                      {farm.farmType && <span className="badge badge-slate" style={{ fontSize: 10 }}>{farm.farmType}</span>}
                      {(farm.status ?? "ACTIVE") === "ACTIVE"
                        ? <span className="badge badge-green" style={{ fontSize: 10 }}>Activa</span>
                        : <span className="badge badge-slate" style={{ fontSize: 10 }}>{farm.status}</span>
                      }
                    </div>
                    {farm.location && <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{farm.location}{farm.hectares ? ` · ${farm.hectares} ha` : ""}</p>}

                    {/* Mini KPIs */}
                    {farm.loading ? (
                      <div className="skel" style={{ height: 28, width: 240, borderRadius: 6 }} />
                    ) : d ? (
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {[
                          { label: "Animales",   value: d.totalAnimals  ?? 0, color: "#93c5fd" },
                          { label: "Grupos",     value: d.animalGroups  ?? 0, color: "#c4b5fd" },
                          { label: "Tareas",     value: d.pendingTasks  ?? 0, color: "#fcd34d" },
                          { label: "Vencidas",   value: d.overdueTasks  ?? 0, color: (d.overdueTasks ?? 0) > 0 ? "#fca5a5" : "#6ee7b7" },
                          { label: "Stock bajo", value: d.lowStockItems ?? 0, color: (d.lowStockItems ?? 0) > 0 ? "#fcd34d" : "#6ee7b7" },
                        ].map(s => (
                          <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</span>
                            <span style={{ fontSize: 10, color: "var(--faint)" }}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: "var(--faint)" }}>Dashboard no disponible</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                    <Link href={`/agro/${farm.id}`} className="btn-accent" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                      <ExternalLink size={11} /> Ver finca
                    </Link>
                    <Link href={`/agro/${farm.id}/animals`} className="btn-ghost" style={{ fontSize: 11 }}>
                      Animales
                    </Link>
                    <Link href={`/agro/${farm.id}/tasks`} className="btn-ghost" style={{ fontSize: 11 }}>
                      Tareas
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Vertical Engine spec */}
      <section style={{ marginTop: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Vertical Engine — Config
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {[
            { label: "Templates",       desc: "Plantillas de tarea y checklist por tipo de finca", status: "planned" },
            { label: "Workflow States", desc: "Estados y transiciones del ciclo operativo Agro",    status: "planned" },
            { label: "Evidence Rules",  desc: "Requisitos de evidencia por etapa del animal",       status: "planned" },
            { label: "Finance Rules",   desc: "Umbrales de costo y alertas presupuestarias",        status: "planned" },
            { label: "Trust Reqs.",     desc: "Credenciales veterinarias y fitosanitarias",         status: "planned" },
            { label: "Reports",         desc: "Reportes periódicos automáticos por finca",          status: "planned" },
          ].map(item => (
            <div key={item.label} style={{
              borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", padding: "12px 14px",
              opacity: 0.7,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <TrendingUp size={12} color="var(--faint)" />
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{item.label}</p>
                <span className="badge badge-slate" style={{ fontSize: 9 }}>planned</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
