"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import { Shield, AlertTriangle, CheckCircle, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { fetchJobs, fetchDisputes, fetchOrganizations, fetchOrganizationMembers, fetchRatings, fetchTravelAssignments } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type ComplianceStatus = "compliant" | "warning" | "violation" | "pending";
type ComplianceCategory = "legal" | "license" | "insurance" | "escrow" | "data";

interface ComplianceItem {
  id: string;
  title: string;
  category: ComplianceCategory;
  status: ComplianceStatus;
  detail: string;
  deadline?: string;
  affectedCount?: number;
  actionLink: string;
}

const STATUS_MAP: Record<ComplianceStatus, { variant: "success" | "warning" | "error" | "info"; label: string; icon: ReactNode }> = {
  compliant: { variant: "success", label: "Cumple",    icon: <CheckCircle size={15} color="#10b981" /> },
  warning:   { variant: "warning", label: "Alerta",    icon: <AlertTriangle size={15} color="#fbbf24" /> },
  violation: { variant: "error",   label: "Violación", icon: <AlertTriangle size={15} color="#ef4444" /> },
  pending:   { variant: "info",    label: "Pendiente", icon: <Clock size={15} color="#3b82f6" /> },
};

const CAT_LABEL: Record<ComplianceCategory, string> = {
  legal: "Legal", license: "Licencia", insurance: "Seguro", escrow: "Escrow", data: "Datos",
};
const CAT_COLOR: Record<ComplianceCategory, string> = {
  legal: "#8b5cf6", license: "#3b82f6", insurance: "#10b981", escrow: "#f59e0b", data: "#ec4899",
};

async function buildChecks(): Promise<ComplianceItem[]> {
  const [jobs, disputes, orgs, ratings, travels] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchDisputes().catch(() => [] as Record<string, unknown>[]),
    fetchOrganizations().catch(() => [] as Record<string, unknown>[]),
    fetchRatings().catch(() => ({ actorUserId: null, items: [] })),
    fetchTravelAssignments({ scope: "all" }).catch(() => [] as Record<string, unknown>[]),
  ]);

  // Get all members across orgs
  const memberResults = await Promise.all(
    orgs.slice(0, 5).map(o => fetchOrganizationMembers(String(o.id)).catch(() => [] as Record<string, unknown>[])),
  );
  const allMembers = memberResults.flat();
  const workerMembers = allMembers.filter(m => String((m as Record<string, unknown>).role ?? "").toLowerCase() === "worker");

  // Check 1: contracts signed before escrow
  const jobsWithFunding = jobs.filter(j => {
    const r = j as unknown as Record<string, unknown>;
    return String(r.escrowStatus ?? "").toLowerCase() !== "" && String(r.escrowStatus ?? "").toLowerCase() !== "unfunded";
  });
  const jobsWithoutContract = jobsWithFunding.filter(j => {
    const r = j as unknown as Record<string, unknown>;
    return !r.contractId && !r.hasContract;
  });

  // Check 2: open disputes (escrow blocked)
  const openDisputes = (disputes as Record<string, unknown>[]).filter(d => String(d.status ?? "").toUpperCase() === "OPEN");

  // Check 3: unverified workers
  const unverifiedWorkers = workerMembers.filter(m => !(m as Record<string, unknown>).verified);

  // Check 4: low-rated workers (avg < 3)
  const ratingItems = ratings.items;
  const lowRatingCount = ratingItems.filter(r => r.score < 3).length;

  // Check 5: travel settlements pending closure
  const pendingTravelSettlements = travels.filter((travel) => String(travel.status ?? "").toUpperCase() === "PENDING_SETTLEMENT");

  const checks: ComplianceItem[] = [
    {
      id: "c1",
      title: "Contrato firmado antes de escrow",
      category: "legal",
      status: jobsWithoutContract.length === 0 ? "compliant" : jobsWithoutContract.length <= 2 ? "warning" : "violation",
      detail: jobsWithoutContract.length === 0
        ? "Todos los trabajos con fondeo tienen contrato firmado previo."
        : `${jobsWithoutContract.length} trabajo${jobsWithoutContract.length > 1 ? "s" : ""} con fondeo sin contrato firmado.`,
      affectedCount: jobsWithoutContract.length > 0 ? jobsWithoutContract.length : undefined,
      actionLink: "/admin/finance",
    },
    {
      id: "c2",
      title: "Disputas de escrow abiertas",
      category: "escrow",
      status: openDisputes.length === 0 ? "compliant" : openDisputes.length <= 3 ? "warning" : "violation",
      detail: openDisputes.length === 0
        ? "Sin disputas abiertas. Todos los escrows fluyen normalmente."
        : `${openDisputes.length} disputa${openDisputes.length > 1 ? "s" : ""} activa${openDisputes.length > 1 ? "s" : ""} bloqueando fondos.`,
      affectedCount: openDisputes.length > 0 ? openDisputes.length : undefined,
      actionLink: "/admin/disputes",
    },
    {
      id: "c3",
      title: "Trabajadores con identidad verificada",
      category: "license",
      status: unverifiedWorkers.length === 0 ? "compliant" : unverifiedWorkers.length <= 2 ? "warning" : "violation",
      detail: unverifiedWorkers.length === 0
        ? "Todos los trabajadores activos tienen identidad verificada."
        : `${unverifiedWorkers.length} trabajador${unverifiedWorkers.length > 1 ? "es" : ""} sin verificación completa.`,
      affectedCount: unverifiedWorkers.length > 0 ? unverifiedWorkers.length : undefined,
      actionLink: "/admin/users",
    },
    {
      id: "c4",
      title: "Calidad de servicio (reseñas < 3★)",
      category: "insurance",
      status: lowRatingCount === 0 ? "compliant" : lowRatingCount <= 2 ? "warning" : "violation",
      detail: lowRatingCount === 0
        ? "Sin reseñas negativas recientes. Calidad estable."
        : `${lowRatingCount} reseña${lowRatingCount > 1 ? "s" : ""} con puntuación menor a 3 estrellas.`,
      affectedCount: lowRatingCount > 0 ? lowRatingCount : undefined,
      actionLink: "/admin/users",
    },
    {
      id: "c5",
      title: "Liquidaciones de viaje pendientes",
      category: "escrow",
      status: pendingTravelSettlements.length === 0 ? "compliant" : pendingTravelSettlements.length <= 3 ? "warning" : "violation",
      detail: pendingTravelSettlements.length === 0
        ? "No hay viáticos pendientes de cierre."
        : `${pendingTravelSettlements.length} viaje${pendingTravelSettlements.length > 1 ? "s" : ""} con liquidación pendiente.`,
      affectedCount: pendingTravelSettlements.length > 0 ? pendingTravelSettlements.length : undefined,
      actionLink: pendingTravelSettlements.length > 0 ? "/admin/travel?status=pending" : "/admin/travel",
    },
    {
      id: "c6",
      title: "Consentimiento de datos (GDPR/CCPA)",
      category: "data",
      status: "pending",
      detail: "Actualización de política de privacidad pendiente de publicación.",
      deadline: "2026-04-30",
      actionLink: "/admin/settings",
    },
    {
      id: "c7",
      title: "Reporte fiscal trimestral Q1 2026",
      category: "legal",
      status: "pending",
      detail: "Q1 2026 pendiente de generación y envío.",
      deadline: "2026-04-30",
      actionLink: "/admin/reports",
    },
  ];

  return checks;
}

export default function AdminCompliancePage() {
  const { t } = useLanguage();
  const [items, setItems]   = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const checks = await buildChecks();
      setItems(checks);
    } catch { /* keep empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function acknowledge(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: "compliant" as const } : i));
  }

  const compliant = items.filter(i => i.status === "compliant").length;
  const issues    = items.filter(i => i.status !== "compliant").length;
  const rate      = items.length > 0 ? Math.round((compliant / items.length) * 100) : 0;

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "24px", flexWrap: "wrap" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.compliance")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Estado regulatorio y legal del ecosistema SEMSE</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <NotificationBanner audience="admin" />
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
            title="Recargar"
          >
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* Score cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", marginBottom: "20px" }}>
        <div style={{ ...card, padding: "16px", background: "rgba(16,185,129,.07)", borderColor: "rgba(16,185,129,.25)", display: "flex", alignItems: "center", gap: "12px" }}>
          <Shield size={24} color="#10b981" />
          <div>
            <p style={{ fontSize: "24px", fontWeight: 900, color: "#10b981" }}>{loading ? "—" : compliant}</p>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>Controles en cumplimiento</p>
          </div>
        </div>
        <div style={{ ...card, padding: "16px", background: "rgba(251,191,36,.07)", borderColor: "rgba(251,191,36,.25)", display: "flex", alignItems: "center", gap: "12px" }}>
          <AlertTriangle size={24} color="#fbbf24" />
          <div>
            <p style={{ fontSize: "24px", fontWeight: 900, color: "#fbbf24" }}>{loading ? "—" : issues}</p>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>Requieren atención</p>
          </div>
        </div>
        <div style={{ ...card, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", minWidth: "100px" }}>
          <p style={{ fontSize: "22px", fontWeight: 900, color: "var(--ink)" }}>{loading ? "—" : `${rate}%`}</p>
          <p style={{ fontSize: "11px", color: "var(--muted)" }}>Tasa general</p>
        </div>
      </div>

      {/* Checks */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {loading ? (
          [1,2,3,4,5,6].map(i => <div key={i} style={{ height: "72px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)
        ) : items.map(item => {
          const s = STATUS_MAP[item.status];
          const color = CAT_COLOR[item.category];
          const needsAction = item.status !== "compliant";
          return (
            <div key={item.id} style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={{ marginTop: "1px", flexShrink: 0 }}>{s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{item.title}</p>
                  <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", background: `${color}12`, color, fontWeight: 700 }}>{CAT_LABEL[item.category]}</span>
                  <StatusBadge variant={s.variant} text={s.label} size="sm" />
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>{item.detail}</p>
                {(item.affectedCount ?? 0) > 0 && (
                  <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 600, marginTop: "4px" }}>▶ {item.affectedCount} afectado{(item.affectedCount ?? 0) > 1 ? "s" : ""}</p>
                )}
                {item.deadline && (
                  <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={10} /> Vence: {item.deadline}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
                {needsAction && (
                  <button
                    onClick={() => acknowledge(item.id)}
                    style={{ padding: "5px 10px", borderRadius: "7px", border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", color: "#10b981", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                  >
                    ✓ Resolver
                  </button>
                )}
                <Link
                  href={item.actionLink}
                  style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex" }}
                  title="Ver detalle"
                >
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
