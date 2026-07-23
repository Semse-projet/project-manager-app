"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, CheckSquare, Home, MoveRight, Building2, Star, ClipboardList, TrendingUp, Activity } from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";

interface CleaningStats {
  totalJobs?: number;
  completedToday?: number;
  pending?: number;
  avgRating?: number;
}

export default function AdminCleaningVerticalPage() {
  const [stats, setStats] = useState<CleaningStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch("/api/semse/jobs?category=cleaning&limit=1");
        const json = await res.json();
        if (res.ok) {
          const d = (json.data as any) ?? {};
          setStats({
            totalJobs:      d.total ?? 0,
            completedToday: d.completedToday ?? 0,
            pending:        d.pending ?? 0,
            avgRating:      d.avgRating,
          });
        }
      } catch { /* best-effort */ }
      finally { setLoading(false); }
    })();
  }, []);

  const kpis = [
    { label: "Jobs limpieza",     value: stats?.totalJobs     ?? "—", color: "#67e8f9" },
    { label: "Completados hoy",   value: stats?.completedToday ?? "—", color: "#6ee7b7" },
    { label: "Pendientes",        value: stats?.pending        ?? "—", color: "#fcd34d" },
    { label: "Rating prom.",      value: stats?.avgRating != null ? `${stats.avgRating.toFixed(1)}★` : "—", color: "#c4b5fd" },
  ];

  const SUB_MODULES = [
    { icon: Home,        label: "Residential",      desc: "Limpieza de apartamentos y casas — estándar, profunda y post-mudanza", href: "/admin/field-ops?category=cleaning" },
    { icon: Building2,   label: "Commercial",       desc: "Oficinas, locales comerciales y espacios corporativos", href: "/admin/field-ops?category=cleaning" },
    { icon: MoveRight,   label: "Move-In/Out",      desc: "Limpiezas de transición entre inquilinos y mudanzas", href: "/admin/field-ops?category=cleaning" },
    { icon: Sparkles,    label: "Post-Construction", desc: "Limpieza profunda después de obra — escombros, polvo, acabados", href: "/admin/field-ops?category=cleaning" },
    { icon: CheckSquare, label: "Checklists",        desc: "Plantillas de control de calidad por tipo de limpieza", href: "/admin/qa" },
    { icon: Star,        label: "Quality & Rating",  desc: "Puntuaciones de clientes, fotos de verificación y control de calidad", href: "/admin/reputation" },
    { icon: ClipboardList,label: "WorkOrders",       desc: "Órdenes de trabajo activas, asignación de crews y seguimiento", href: "/admin/field-ops" },
  ];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <AdminPageHeader
        title="Cleaning & Turnovers"
        subtitle="Gestión de limpieza residencial, comercial y cambios de turno de propiedades"
        icon={Sparkles}
        iconColor="#22d3ee"
        iconBg="rgba(34,211,238,.12)"
        backHref="/admin/verticals"
        backLabel="Verticals"
        actions={
          <>
            <span className="badge badge-amber" style={{ fontSize: 10 }}>Beta</span>
            <Link href="/admin/field-ops?category=cleaning" className="btn-accent" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <ClipboardList size={12} /> Ver WorkOrders
            </Link>
          </>
        }
      />

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

      {/* Sub-modules grid */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Módulos
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {SUB_MODULES.map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.label} href={a.href} className="card-lift" style={{
                borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
                padding: "14px 16px", textDecoration: "none", display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(103,232,249,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color="#67e8f9" />
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
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>Flujo de Turnover</p>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)" }}>Cliente solicita</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Smart Intake clasifica</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Job publicado</strong>{" → "}
          <strong style={{ color: "#67e8f9" }}>Crew asignado</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Checklist completado</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Fotos evidencia</strong>{" → "}
          <strong style={{ color: "var(--ink)" }}>Rating cliente</strong>
        </p>
      </section>

      {/* Config engine */}
      <section>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Vertical Engine — Config
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {[
            { label: "Cleaning Checklists",  desc: "Plantillas de verificación por tipo de limpieza: estándar, profunda, post-obra" },
            { label: "Zone Templates",       desc: "Zonas predefinidas: cocina, baños, habitaciones, áreas comunes" },
            { label: "Supply Management",    desc: "Inventario de insumos: productos, cantidades por trabajo, alertas de stock" },
            { label: "Route Optimization",   desc: "Asignación de crews por proximidad geográfica y disponibilidad" },
            { label: "Turnover SLA",         desc: "Acuerdos de nivel de servicio: tiempo de respuesta, penalidades" },
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
