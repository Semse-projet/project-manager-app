"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wrench, Zap, Droplets, Thermometer, Wind, Shield, Calendar, TrendingUp, Activity, ClipboardList } from "lucide-react";

interface MaintenanceStats {
  openWorkOrders?: number;
  scheduledThisWeek?: number;
  overdueInspections?: number;
  avgResponseHrs?: number;
}

export default function AdminMaintenanceVerticalPage() {
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch("/api/semse/jobs?category=maintenance&limit=1");
        const json = await res.json();
        if (res.ok) {
          const d = (json.data as any) ?? {};
          setStats({
            openWorkOrders:       d.total       ?? 0,
            scheduledThisWeek:    d.scheduled   ?? 0,
            overdueInspections:   d.overdue     ?? 0,
            avgResponseHrs:       d.avgResponse,
          });
        }
      } catch { /* best-effort */ }
      finally { setLoading(false); }
    })();
  }, []);

  const kpis = [
    { label: "Órdenes abiertas",    value: stats?.openWorkOrders     ?? "—", color: "#fbbf24" },
    { label: "Esta semana",         value: stats?.scheduledThisWeek  ?? "—", color: "#93c5fd" },
    { label: "Inspecciones venc.",  value: stats?.overdueInspections ?? "—", color: "#fca5a5" },
    { label: "Resp. prom. (hrs)",   value: stats?.avgResponseHrs != null ? `${stats.avgResponseHrs.toFixed(1)}h` : "—", color: "#6ee7b7" },
  ];

  const SUB_MODULES = [
    { icon: Zap,         label: "Electrical",     desc: "Mantenimiento preventivo y correctivo de instalaciones eléctricas", href: "/tools/electrical" },
    { icon: Droplets,    label: "Plumbing",        desc: "Reparaciones y revisiones de tuberías, grifería y drenajes", href: "/tools/plumbing" },
    { icon: Thermometer, label: "HVAC",            desc: "Mantenimiento de aire acondicionado, calefacción y ventilación", href: "/tools/hvac" },
    { icon: Wind,        label: "Roofing",         desc: "Inspecciones de techo, impermeabilización y reparaciones menores", href: "/tools/roofing" },
    { icon: Shield,      label: "Safety Checks",   desc: "Revisiones periódicas de seguridad: detectores, extintores, salidas", href: "/admin/vision" },
    { icon: Calendar,    label: "Scheduled PMs",   desc: "Mantenimiento preventivo calendarizado con alertas automáticas", href: "/admin/pmo" },
    { icon: Wrench,      label: "Work Orders",     desc: "Órdenes de trabajo correctivo: diagnóstico, partes y mano de obra", href: "/admin/field-ops" },
    { icon: ClipboardList,label: "Inspection Log", desc: "Historial de inspecciones por propiedad, trade y fecha", href: "/admin/field-ops" },
  ];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/verticals" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <ArrowLeft size={12} /> Verticals
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 24 }}>🔧</span>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.03em" }}>Maintenance</h1>
              <span className="badge badge-amber" style={{ fontSize: 10 }}>Beta</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Mantenimiento preventivo y correctivo de propiedades — eléctrico, plomería, HVAC, techos</p>
          </div>
          <Link href="/admin/field-ops" className="btn-accent" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Wrench size={12} /> Work Orders
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
        {loading
          ? [1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 74, borderRadius: 12 }} />)
          : kpis.map(kpi => (
            <div key={kpi.label} style={{
              borderRadius: 12, border: "1px solid var(--border)", borderTop: `3px solid ${kpi.color}`,
              background: "var(--surface)", padding: "14px 16px",
            }}>
              <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {kpi.label}
              </p>
              <p style={{ fontSize: 26, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
            </div>
          ))
        }
      </section>

      {/* Sub-modules */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Especialidades
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {SUB_MODULES.map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.label} href={a.href} className="card-lift" style={{
                borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
                padding: "14px 16px", textDecoration: "none", display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(251,191,36,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color="#fbbf24" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{a.label}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{a.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Workflow */}
      <section style={{
        borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
        padding: "16px 18px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Activity size={13} color="var(--brand)" />
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>Flujo de Mantenimiento</p>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)" }}>Alerta o solicitud</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Diagnóstico técnico</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Orden de trabajo</strong>{" → "}
          <strong style={{ color: "#fbbf24" }}>Técnico asignado</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Ejecución + fotos</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Cierre verificado</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Pago liberado</strong>
        </p>
      </section>

      {/* Config engine */}
      <section>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Vertical Engine — Config
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {[
            { label: "PM Schedules",       desc: "Calendarios de mantenimiento preventivo por tipo de equipo o sistema" },
            { label: "Warranty Tracking",  desc: "Registro de garantías de equipos, partes y trabajos ejecutados" },
            { label: "Parts Catalog",      desc: "Catálogo de repuestos con precios, proveedores y tiempos de entrega" },
            { label: "SLA Rules",          desc: "Tiempos de respuesta por prioridad: crítico (2h), urgente (24h), rutina (72h)" },
            { label: "Property Registry",  desc: "Registro de propiedades con historial completo de mantenimientos" },
          ].map(item => (
            <div key={item.label} style={{
              borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
              padding: "12px 14px", opacity: 0.65,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <TrendingUp size={11} color="var(--faint)" />
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
