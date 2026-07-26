"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import { Shield, AlertTriangle, CheckCircle, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { fetchJobs, fetchDisputes, fetchOrganizations, fetchOrganizationMembers, fetchRatings, fetchTravelAssignments } from "../../../semse-api";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import {
  captureComplianceSource,
  deriveComplianceChecks,
  type ComplianceCategory,
  type ComplianceItem,
  type ComplianceStatus,
} from "../../../../lib/admin/compliance-checks";

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

async function loadComplianceChecks() {
  const [jobs, disputes, orgs, ratings, travels] = await Promise.all([
    captureComplianceSource(fetchJobs(), []),
    captureComplianceSource(fetchDisputes(), [] as Record<string, unknown>[]),
    captureComplianceSource(fetchOrganizations(), [] as Record<string, unknown>[]),
    captureComplianceSource(fetchRatings(), { actorUserId: null, items: [] }),
    captureComplianceSource(
      fetchTravelAssignments({ scope: "all" }),
      [] as Record<string, unknown>[],
    ),
  ]);

  const memberResults = orgs.available
    ? await Promise.all(
        orgs.data.map((org) => captureComplianceSource(
          fetchOrganizationMembers(String(org.id)),
          [] as Record<string, unknown>[],
        )),
      )
    : [];
  const members = {
    available: orgs.available && memberResults.every((result) => result.available),
    data: memberResults.flatMap((result) => result.data),
  };

  return deriveComplianceChecks({
    jobs,
    disputes,
    members,
    ratings,
    travels,
  });
}

export default function AdminCompliancePage() {
  const { t } = useLanguage();
  const [items, setItems]   = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailableSources, setUnavailableSources] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadComplianceChecks();
      setItems(result.items);
      setUnavailableSources(result.unavailableSources);
    } catch {
      setItems([]);
      setUnavailableSources(["todas las fuentes"]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const compliant = items.filter(i => i.status === "compliant").length;
  const issues    = items.filter(i => i.status !== "compliant").length;
  const rate      = items.length > 0 ? Math.round((compliant / items.length) * 100) : 0;
  const rateAvailable = unavailableSources.length === 0;

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto" }}>
      <AdminPageHeader
        title={t("page.compliance")}
        subtitle="Estado regulatorio y legal del ecosistema SEMSE"
        icon={Shield}
        iconColor="#10b981"
        iconBg="rgba(16,185,129,0.12)"
        panel
        actions={
          <>
            <NotificationBanner audience="admin" />
            <button
              onClick={() => void load()}
              disabled={loading}
              style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
              title="Recargar"
            >
              <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </>
        }
      />

      {unavailableSources.length > 0 && (
        <div
          role="alert"
          style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(251,191,36,.35)", background: "rgba(251,191,36,.08)", color: "#fbbf24", fontSize: 12 }}
        >
          Verificación incompleta: no se pudieron consultar {unavailableSources.join(", ")}.
          Los controles dependientes quedan pendientes y no se consideran cumplidos.
        </div>
      )}

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
          <p style={{ fontSize: "22px", fontWeight: 900, color: "var(--ink)" }}>{loading || !rateAvailable ? "—" : `${rate}%`}</p>
          <p style={{ fontSize: "11px", color: "var(--muted)" }}>{rateAvailable ? "Tasa general" : "Tasa no verificable"}</p>
        </div>
      </div>

      {/* Checks */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {loading ? (
          [1,2,3,4,5,6].map(i => <div key={i} style={{ height: "72px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)
        ) : items.map(item => {
          const s = STATUS_MAP[item.status];
          const color = CAT_COLOR[item.category];
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
