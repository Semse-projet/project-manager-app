"use client";

/**
 * Worker — Mis Trabajos
 * Lista de trabajos activos, completados y oportunidades
 */

import { useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, Search, DollarSign } from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import type { JobRecordView } from "@semse/schemas";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

const WORKER_NEXT_ACTION: Record<string, string> = {
  reserved:    "Acepta el trabajo para confirmar tu lugar.",
  accepted:    "Espera a que el cliente fondee el escrow y luego comienza.",
  in_progress: "Avanza el milestone y sube evidencia cuando termines.",
  review:      "El cliente está revisando tu entrega. Espera aprobación.",
  dispute:     "Hay una disputa activa. Aporta evidencia si la tienes.",
  completed:   "Trabajo cerrado. Puedes pedir calificación al cliente."
};

const STATUS_CONFIG: Record<string, { variant: "success" | "warning" | "info" | "neutral" | "error"; label: string }> = {
  in_progress: { variant: "info",    label: "En progreso" },
  review:      { variant: "warning", label: "En revisión" },
  accepted:    { variant: "success", label: "Aceptado"    },
  reserved:    { variant: "success", label: "Reservado"   },
  completed:   { variant: "neutral", label: "Completado"  },
  dispute:     { variant: "error",   label: "En disputa"  },
  posted:      { variant: "info",    label: "Publicado"   },
  cancelled:   { variant: "neutral", label: "Cancelado"   },
};

const TABS = ["Todos", "Activos", "Completados"] as const;
type Tab = typeof TABS[number];

export default function WorkerJobsPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [jobs, setJobs]       = useState<JobRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tab, setTab]         = useState<Tab>(() => {
    const t = searchParams?.get("tab") as Tab | null;
    return TABS.includes(t as Tab) ? (t as Tab) : "Todos";
  });
  const [query, setQuery]     = useState("");

  useEffect(() => {
    fetch("/api/semse/jobs")
      .then(r => r.json())
      .then((d: { data?: JobRecordView[]; error?: { message: string } }) => {
        if (d.error) { setApiError(d.error.message); return; }
        setJobs(d.data ?? []);
      })
      .catch(() => setApiError("No se pudo conectar con el servidor"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j => {
    const matchTab =
      tab === "Todos"       ? true :
      tab === "Activos"     ? ["in_progress", "accepted", "review", "reserved"].includes(j.status) :
      tab === "Completados" ? j.status === "completed" : true;
    const matchQ = !query || j.title.toLowerCase().includes(query.toLowerCase()) || (j.scope ?? "").toLowerCase().includes(query.toLowerCase());
    return matchTab && matchQ;
  });

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "24px", flexWrap: "wrap" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.myJobs")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Gestiona tus proyectos activos y revisa el historial</p>
        </div>
        <NotificationBanner audience="worker" />
      </HtmlInCanvasPanel>

      {/* Tabs + Search */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }} canvasClassName="rounded-2xl" minHeight={54}>
        <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 14px", borderRadius: "7px", border: "none",
                background: tab === t ? "var(--brand)" : "transparent",
                color: tab === t ? "#fff" : "var(--muted)",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar trabajos..."
            style={{
              paddingLeft: "32px", paddingRight: "12px", height: "34px",
              borderRadius: "8px", border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none",
            }}
          />
        </div>
      </HtmlInCanvasPanel>

      {/* Job List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "72px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : apiError ? (
        <div style={{ padding: "16px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: "10px", color: "#ef4444", fontSize: "13px" }}>
          {apiError}
        </div>
      ) : filtered.length === 0 ? (
        <HtmlInCanvasPanel as="section" style={{ padding: "48px 24px", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }} canvasClassName="rounded-2xl" minHeight={220}>
          <Briefcase size={36} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>No hay trabajos</p>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            {jobs.length === 0 ? "Aún no tienes trabajos asignados." : "Ajusta los filtros o explora oportunidades disponibles."}
          </p>
        </HtmlInCanvasPanel>
      ) : (
        <HtmlInCanvasPanel as="section" style={{ display: "flex", flexDirection: "column", gap: "8px" }} canvasClassName="rounded-2xl" minHeight={380}>
          {filtered.map(job => {
            const sc = STATUS_CONFIG[job.status] ?? { variant: "neutral" as const, label: job.status };
            return (
              <Link
                key={job.id}
                href={`/worker/jobs/${job.id}`}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "16px",
                  padding: "16px 18px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "12px", textDecoration: "none",
                  transition: "border-color 0.15s",
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = "#10b981")}
                onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{job.title}</p>
                    <StatusBadge variant={sc.variant} text={sc.label} dot size="sm" />
                  </div>
                  {job.scope && (
                    <p style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.scope}
                    </p>
                  )}
                  {WORKER_NEXT_ACTION[job.status] ? (
                    <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 600, marginTop: "4px" }}>
                      ▶ {WORKER_NEXT_ACTION[job.status]}
                    </p>
                  ) : null}
                </div>
                {(job.budgetMin ?? job.budgetMax) ? (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: "3px" }}>
                      <DollarSign size={14} style={{ color: "var(--accent)" }} />
                      {(job.budgetMin ?? job.budgetMax ?? 0).toLocaleString()}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>presupuesto</p>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </HtmlInCanvasPanel>
      )}
    </div>
  );
}
