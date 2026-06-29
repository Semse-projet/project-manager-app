"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Hammer, ClipboardList, Users, DollarSign, FileText, Camera, TrendingUp, Package, Shield } from "lucide-react";

interface BuildOpsProject {
  id: string;
  title: string;
  status: string;
  riskLevel?: string;
  budget?: number;
  clientName?: string;
}

interface BuildOpsOverview {
  totalProjects?: number;
  activeProjects?: number;
  projectsByStatus?: Record<string, number>;
  projectsByRisk?: Record<string, number>;
  milestonesPendingReview?: number;
}

const RISK_COLOR: Record<string, string> = {
  LOW:      "#6ee7b7",
  MEDIUM:   "#fcd34d",
  HIGH:     "#fca5a5",
  CRITICAL: "#f87171",
};

const STATUS_COLOR: Record<string, string> = {
  PLANNING:    "#94a3b8",
  ACTIVE:      "#6ee7b7",
  ON_HOLD:     "#fcd34d",
  COMPLETED:   "#93c5fd",
  CANCELLED:   "#fca5a5",
};

export default function AdminConstructionPage() {
  const [overview, setOverview] = useState<BuildOpsOverview | null>(null);
  const [projects, setProjects] = useState<BuildOpsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [or, pr] = await Promise.all([
        fetch("/api/semse/buildops/overview"),
        fetch("/api/semse/buildops/projects"),
      ]);
      if (or.ok) {
        const oj = await or.json();
        setOverview((oj.data as any) ?? oj);
      }
      if (pr.ok) {
        const pj = await pr.json();
        const list: BuildOpsProject[] = (pj.data as any)?.projects ?? pj.data ?? [];
        setProjects(list.slice(0, 10));
      }
    } catch (err: any) { setError(err?.message ?? "Error"); }
    finally { setLoading(false); }
  }

  const activeProjects = projects.filter(p => p.status === "ACTIVE");

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
              <span style={{ fontSize: 24 }}>🏗️</span>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.03em" }}>Construction / BuildOps</h1>
              <span className="badge badge-green" style={{ fontSize: 10 }}>Live</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Gestión de proyectos de construcción, milestones, crews y evidencia</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/field-ops" className="btn-accent" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={12} /> Field Ops
            </Link>
          </div>
        </div>
      </div>

      {error && <div className="alert-banner alert-warning" style={{ marginBottom: 20 }}>{error}</div>}

      {/* KPIs */}
      <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 24 }}>
        {loading ? [1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 74, borderRadius: 12 }} />) : [
          { label: "Proyectos",   value: overview?.totalProjects  ?? projects.length, color: "#93c5fd", Icon: Hammer },
          { label: "Activos",     value: overview?.activeProjects ?? activeProjects.length, color: "#6ee7b7", Icon: ClipboardList },
          { label: "Milestones pend.", value: overview?.milestonesPendingReview ?? "—", color: "#fcd34d", Icon: FileText },
          { label: "Riesgo alto", value: overview?.projectsByRisk?.HIGH ?? projects.filter(p => p.riskLevel === "HIGH").length, color: "#fca5a5", Icon: Shield },
        ].map(s => (
          <div key={s.label} style={{
            borderRadius: 12, border: "1px solid var(--border)", borderTop: `3px solid ${s.color}`,
            background: "var(--surface)", padding: "14px 16px",
          }}>
            <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </section>

      {/* Projects list */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Proyectos recientes
        </p>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 70, borderRadius: 12 }} />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <Hammer size={32} className="empty-icon" />
            <p className="empty-title">Sin proyectos</p>
            <p className="empty-desc">Los proyectos de construcción aparecerán aquí desde BuildOps.</p>
            <Link href="/admin/field-ops" className="btn-accent">Ir a Field Ops</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map(p => {
              const sc = STATUS_COLOR[p.status] ?? "#94a3b8";
              const rc = p.riskLevel ? (RISK_COLOR[p.riskLevel] ?? "#94a3b8") : null;
              return (
                <div key={p.id} style={{
                  borderRadius: 12, border: "1px solid var(--border)", borderLeft: `3px solid ${sc}`,
                  background: "var(--surface)", padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{p.title}</p>
                      <span className="badge badge-slate" style={{ fontSize: 10 }}>{p.status}</span>
                      {rc && <span style={{ fontSize: 10, fontWeight: 700, color: rc, textTransform: "uppercase" }}>⚠ {p.riskLevel}</span>}
                    </div>
                    {p.clientName && <p style={{ fontSize: 11, color: "var(--muted)" }}>{p.clientName}</p>}
                  </div>
                  {p.budget != null && (
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fcd34d", flexShrink: 0 }}>
                      ${p.budget.toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sub-modules */}
      <section>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Sub-módulos
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {[
            { href: "/admin/field-ops",     icon: Hammer,       label: "Field Ops",      desc: "Unidades de campo, worklogs y asignaciones" },
            { href: "/admin/worker",         icon: Users,        label: "Workers",         desc: "Perfiles de trabajadores y disponibilidad" },
            { href: "/admin/contractors",    icon: Users,        label: "Contractors",     desc: "Empresas contratistas y su desempeño" },
            { href: "/admin/change-orders",  icon: FileText,     label: "Change Orders",   desc: "Solicitudes de cambio pendientes de aprobación" },
            { href: "/admin/pmo",            icon: ClipboardList,label: "PMO",             desc: "Vista de programa, riesgos y milestones" },
            { href: "/admin/vision",         icon: Camera,       label: "Vision AI",       desc: "Análisis de fotos de obra con OpenCV" },
            { href: "/admin/qa",             icon: Shield,       label: "QA",              desc: "Criterios de calidad y revisión de evidencia" },
          ].map(m => {
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href} className="card-lift" style={{
                borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
                padding: "12px 14px", textDecoration: "none", display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(147,197,253,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={13} color="#93c5fd" />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{m.label}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{m.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Vertical Engine config */}
      <section style={{ marginTop: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Vertical Engine — Config
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {[
            { label: "Templates",      desc: "Plantillas estándar por tipo de obra (residencial, comercial, remodelación)" },
            { label: "Checklists",     desc: "Checklists pre-construcción, obra y entrega final" },
            { label: "Evidence Rules", desc: "Fotos requeridas por milestone — fundación, estructura, acabados" },
            { label: "Finance Rules",  desc: "Alertas de desviación presupuestaria por etapa" },
            { label: "Trust Reqs.",    desc: "Licencias y certificaciones requeridas por contratista" },
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
