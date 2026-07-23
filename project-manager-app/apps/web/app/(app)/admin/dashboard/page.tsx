"use client";

/**
 * Admin Dashboard — Vista principal del operador/administrador
 * Basado en AdminDashboard del SEMSE OS
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Users, AlertTriangle, Briefcase, DollarSign, CheckSquare, TrendingUp, RefreshCw, FileText, Shield, Bot, BarChart2, Settings, Wrench, MessageSquare, LayoutDashboard } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge, useHtmlInCanvasSupport } from "@semse/ui";
import type { JobRecordView } from "@semse/schemas";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { useLanguage } from "../../../../lib/language-context";
import { normalizeErrorMessage } from "../../../semse-api";

type AlertSeverity = "error" | "warning" | "info";

interface OpsAlert {
  id: string;
  type: string;
  text: string;
  time: string;
  severity: AlertSeverity;
}

// Fallback alerts shown when backend is offline
const FALLBACK_ALERTS: OpsAlert[] = [
  { id: "a1", type: "dispute",    text: "Disputa escalada en Job #J-2891 — cliente y pro sin acuerdo",    time: "hace 12 min",  severity: "error" },
  { id: "a2", type: "escrow",     text: "Escrow de $4,500 pendiente de liberación — milestone aprobado",  time: "hace 34 min",  severity: "warning" },
  { id: "a3", type: "user",       text: "Profesional nuevo solicita verificación de identidad",            time: "hace 1 hora",  severity: "info" },
  { id: "a4", type: "compliance", text: "Contrato #C-1092 vence sin milestone completado",                 time: "hace 2 horas", severity: "warning" },
];

export default function AdminDashboardPage() {
  const canvasSupported = useHtmlInCanvasSupport();
  const { t } = useLanguage();
  const [jobs, setJobs]           = useState<JobRecordView[]>([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function loadData(options?: { skipLoading?: boolean }) {
    if (!options?.skipLoading) {
      setLoading(true);
    }
    fetch("/api/semse/jobs")
      .then(r => r.json())
      .then((d: { data?: JobRecordView[]; error?: { message: string } }) => {
        if (d.error) { setApiError(d.error.message); return; }
        setJobs(d.data ?? []);
        setApiError(null);
      })
      .catch(() => setApiError("No se pudo conectar con el servidor"))
      .finally(() => { setLoading(false); setLastRefresh(new Date()); });
  }

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/semse/jobs")
      .then((response) => response.json())
      .then((payload: { data?: JobRecordView[]; error?: unknown }) => {
        if (cancelled) {
          return;
        }
        if (payload.error) {
          setApiError(normalizeErrorMessage(payload.error) ?? "No se pudieron cargar los trabajos.");
          return;
        }
        setJobs(payload.data ?? []);
        setApiError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setApiError("No se pudo conectar con el servidor");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLastRefresh(new Date());
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeJobs    = jobs.filter(j => ["in_progress", "reserved", "accepted", "review"].includes(j.status));
  const disputeJobs   = jobs.filter(j => j.status === "dispute");
  const completedJobs = jobs.filter(j => j.status === "completed");
  const escrowTotal   = activeJobs.reduce((acc, j) => acc + (j.budgetMin ?? 0), 0);

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Migration Alert Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "12px 16px",
          background: "rgba(139, 92, 246, 0.1)",
          border: "1px solid rgba(139, 92, 246, 0.2)",
          borderRadius: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Activity size={16} color="#8b5cf6" />
          <span style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500 }}>
            Un nuevo **Mission Control** ejecutivo y centrado en excepciones está disponible.
          </span>
        </div>
        <Link
          href="/admin/mission-control"
          style={{
            fontSize: "12px",
            color: "#8b5cf6",
            fontWeight: 700,
            textDecoration: "none",
            background: "rgba(139, 92, 246, 0.15)",
            padding: "6px 12px",
            borderRadius: "8px",
          }}
        >
          Probar Mission Control
        </Link>
      </div>

      <AdminPageHeader
        title="Panel de Operaciones"
        subtitle={
          <span>
            Estado del sistema en tiempo real
            {!loading && <span style={{ color: "var(--faint)", marginLeft: "8px" }}>· Actualizado {lastRefresh.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>}
          </span>
        }
        icon={LayoutDashboard}
        iconColor="#6366f1"
        iconBg="rgba(99,102,241,0.15)"
        showBack={false}
        actions={
          <>
            <span
              title={canvasSupported ? "Canvas nativo activo" : "DOM fallback"}
              style={{
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "0.68rem",
                fontWeight: 700,
                background: canvasSupported ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.1)",
                color: canvasSupported ? "#34d399" : "#64748b",
                border: `1px solid ${canvasSupported ? "rgba(52,211,153,0.25)" : "rgba(148,163,184,0.15)"}`,
                cursor: "default",
                alignSelf: "flex-start",
                marginTop: "3px"
              }}
            >
              {canvasSupported ? "canvas" : "DOM"}
            </span>
            <NotificationBanner audience="admin" />
            <button
              onClick={() => {
                void loadData();
              }}
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "12px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refrescar
            </button>
          </>
        }
      />

      {/* Stats from real API */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {[
          { href: "/admin/ops",      label: "Trabajos activos",   value: loading ? "—" : activeJobs.length,    icon: Activity,      color: "blue"   as const },
          { href: "/admin/disputes", label: "En disputa",         value: loading ? "—" : disputeJobs.length,   icon: AlertTriangle, color: "red"    as const },
          { href: "/admin/reports",  label: "Completados",        value: loading ? "—" : completedJobs.length, icon: CheckSquare,   color: "green"  as const },
          { href: "/admin/ops",      label: "Total trabajos",     value: loading ? "—" : jobs.length,          icon: TrendingUp,    color: "violet" as const },
          { href: "/admin/finance",  label: "Presupuesto activo", value: loading ? "—" : escrowTotal > 0 ? `$${escrowTotal.toLocaleString()}` : "—", icon: DollarSign, color: "orange" as const },
          { href: "/admin/ops",      label: "API backend",        value: apiError ? "Offline" : "Online",      icon: Activity,      color: (apiError ? "red" : "green") as "red" | "green" },
        ].map(s => (
          <Link key={s.href + s.label} href={s.href} style={{ textDecoration: "none", display: "block", borderRadius: "16px", transition: "transform .12s, box-shadow .12s" }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,.08)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
            <StatCard label={s.label} value={s.value} icon={s.icon} color={s.color} loading={loading} />
          </Link>
        ))}
      </div>

      {/* Alerts feed — real disputes from API, fallback to demo */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-[16px]" minHeight={100} style={{ marginBottom: "28px" }}>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "14px" }}>
            Alertas del sistema {apiError && <span style={{ fontSize: "11px", color: "var(--faint)", fontWeight: 400 }}>· modo demo</span>}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(disputeJobs.length > 0
              ? disputeJobs.slice(0, 4).map((j): OpsAlert => ({
                  id: j.id,
                  type: "dispute",
                  text: `Disputa activa: ${j.title}`,
                  time: "En curso",
                  severity: "error",
                }))
              : FALLBACK_ALERTS
            ).map(alert => (
              <div
                key={alert.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ paddingTop: "2px" }}>
                  <StatusBadge variant={alert.severity} text={alert.type.toUpperCase()} size="sm" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500 }}>{alert.text}</p>
                  <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "2px" }}>{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </HtmlInCanvasPanel>

      {/* Quick links */}
      <section>
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "14px" }}>Gestión rápida</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
          {[
            { label: t("nav.operations"),   href: "/admin/ops",           icon: Activity,      color: "#3b82f6" },
            { label: t("nav.communications"), href: "/admin/communications", icon: MessageSquare, color: "#14b8a6" },
            { label: t("nav.users"),        href: "/admin/users",         icon: Users,         color: "#8b5cf6" },
            { label: t("nav.disputes"),     href: "/admin/disputes",      icon: AlertTriangle, color: "#ef4444" },
            { label: t("nav.finance"),      href: "/admin/finance",       icon: DollarSign,    color: "#10b981" },
            { label: t("nav.compliance"),   href: "/admin/compliance",    icon: Shield,        color: "#f59e0b" },
            { label: t("nav.autonomy"),     href: "/admin/autonomy",      icon: Bot,           color: "#a855f7" },
            { label: t("nav.llmMetrics"),   href: "/admin/llm-metrics",   icon: Activity,      color: "#6366f1" },
            { label: t("nav.reports"),      href: "/admin/reports",       icon: BarChart2,     color: "#06b6d4" },
            { label: t("nav.fieldOps"),     href: "/admin/field-ops",     icon: Wrench,        color: "#84cc16" },
            { label: t("nav.qaCenter"),     href: "/admin/qa",            icon: CheckSquare,   color: "#f97316" },
            { label: "PMO",                 href: "/admin/pmo",           icon: Briefcase,     color: "#0ea5e9" },
            { label: t("nav.settings"),     href: "/admin/settings",      icon: Settings,      color: "#64748b" },
            { label: t("nav.domainEvents"), href: "/admin/domain-events", icon: FileText,      color: "#ec4899" },
          ].map(action => {
            const Icon = action.icon;
            return (
              <a
                key={action.href}
                href={action.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "var(--ink)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `${action.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: action.color }}>
                  <Icon size={14} />
                </div>
                {action.label}
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
