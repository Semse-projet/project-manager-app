"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Briefcase, CheckSquare, Clock, FileText, Users, Wrench } from "lucide-react";
import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

interface WorkOpsMetrics {
  jobs: { total: number; active: number; pending: number; completed: number };
  bids: { total: number; pending: number };
}

const QUICK_LINKS = [
  { href: "/admin/jobs",          icon: Briefcase,   label: "Jobs",          desc: "Browse y filtrado de todos los jobs del sistema" },
  { href: "/admin/field-ops",     icon: Wrench,      label: "Field Ops",     desc: "Unidades, worklogs y operaciones de campo" },
  { href: "/admin/worker",        icon: Users,       label: "Workers",        desc: "Perfiles, asignaciones y disponibilidad" },
  { href: "/admin/contractors",   icon: Briefcase,   label: "Contractors",    desc: "Empresas contratistas y su historial" },
  { href: "/admin/change-orders", icon: FileText,    label: "Change Orders",  desc: "Solicitudes de cambio pendientes de aprobación" },
  { href: "/admin/labor-engine",  icon: Clock,       label: "Labor Engine",   desc: "Timers del equipo, QualityGuard, costos y SmartMatch" },
  { href: "/admin/pmo",           icon: Activity,    label: "PMO",            desc: "Vista de programa, riesgos y milestones" },
  { href: "/admin/qa",            icon: CheckSquare, label: "QA",             desc: "Revisión de calidad y criterios de aceptación" },
];

export default function WorkOpsHubPage() {
  const mod = getAdminModuleById("workops");
  const [metrics, setMetrics] = useState<WorkOpsMetrics | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [jr, br] = await Promise.all([
          fetch("/api/semse/jobs"),
          fetch("/api/semse/bids"),
        ]);
        const jj = jr.ok ? await jr.json() : null;
        const bj = br.ok ? await br.json() : null;
        const jobs: { status: string }[] = jj?.data ?? [];
        const bids: { status: string }[] = bj?.data ?? [];
        setMetrics({
          jobs: {
            total:     jobs.length,
            active:    jobs.filter(j => j.status === "ACTIVE").length,
            pending:   jobs.filter(j => ["PENDING","OPEN"].includes(j.status)).length,
            completed: jobs.filter(j => j.status === "COMPLETED").length,
          },
          bids: {
            total:   bids.length,
            pending: bids.filter(b => b.status === "PENDING").length,
          },
        });
      } catch { /* best-effort */ }
    })();
  }, []);

  if (!mod) return null;

  const kpis = metrics ? [
    { label: "Jobs activos",    value: metrics.jobs.active,    color: "#6ee7b7", warn: false },
    { label: "Jobs pendientes", value: metrics.jobs.pending,   color: "#fcd34d", warn: metrics.jobs.pending > 0 },
    { label: "Completados",     value: metrics.jobs.completed, color: "#93c5fd", warn: false },
    { label: "Bids pendientes", value: metrics.bids.pending,   color: "#fca5a5", warn: metrics.bids.pending > 0 },
  ] : null;

  return (
    <ModuleShell module={mod} eyebrow="SEMSE WorkOps">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Live KPI strip */}
        <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {kpis ? kpis.map(kpi => (
            <div key={kpi.label} style={{
              borderRadius: 12,
              border: `1px solid ${kpi.warn ? kpi.color + "40" : "var(--border)"}`,
              borderTop: `3px solid ${kpi.color}`,
              background: kpi.warn ? `${kpi.color}08` : "var(--surface)",
              padding: "14px 18px",
            }}>
              <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {kpi.label}
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
            </div>
          )) : [1,2,3,4].map(i => (
            <div key={i} className="skel" style={{ height: 74, borderRadius: 12 }} />
          ))}
        </section>

        {/* Flow pill */}
        <div style={{
          borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <Activity size={14} color="var(--brand)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--ink)" }}>Flujo:</strong>{" "}
            Capturar trabajo → asignar crews → milestones → evidencia → change orders → QA → pago
          </p>
        </div>

        {/* Module grid */}
        <section>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
            Sub-módulos
          </p>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {QUICK_LINKS.map(link => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} style={{
                  borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
                  padding: "14px 16px", textDecoration: "none", display: "flex", gap: 12, alignItems: "flex-start",
                  transition: "border-color 0.15s",
                }} className="card-lift">
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(139,180,248,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color="#8ab4f8" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{link.label}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{link.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Alert if pending bids */}
        {metrics && metrics.bids.pending > 0 && (
          <div className="alert-banner alert-warning" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>
              <strong>{metrics.bids.pending} bid{metrics.bids.pending > 1 ? "s" : ""}</strong>{" "}
              pendiente{metrics.bids.pending > 1 ? "s" : ""} de revisión.{" "}
              <Link href="/admin/field-ops" style={{ color: "inherit", fontWeight: 700 }}>Ver Field Ops →</Link>
            </span>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
