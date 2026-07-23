"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, Briefcase, CheckCircle2, Clock, Mail, MapPin,
  Phone, RefreshCw, ShieldCheck, UserCheck, UserPlus, Users, XCircle,
} from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkerApplication = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  trade: string;
  yearsExperience: number | null;
  message: string | null;
  proposedRate: string | number | null;
  jobId: string | null;
  status: string;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type ApplicationStats = {
  total: number;
  submitted: number;
  reviewing: number;
  approved: number;
  rejected: number;
};

type VerificationStats = {
  totalWorkers: number;
  verifiedCount: number;
  unverifiedCount: number;
  verificationRate: number;
};

type UnverifiedWorker = {
  id: string;
  email?: string;
  displayName?: string | null;
  profile?: { displayName?: string | null } | null;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "Nueva", color: "#818cf8", bg: "rgba(99,102,241,.12)" },
  reviewing: { label: "En revisión", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  approved: { label: "Aprobada", color: "#10b981", bg: "rgba(16,185,129,.12)" },
  rejected: { label: "Rechazada", color: "#ef4444", bg: "rgba(239,68,68,.12)" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const json = await response.json().catch(() => ({})) as { data?: T; error?: { message?: unknown } };
  if (!response.ok) {
    const message = typeof json.error?.message === "string" ? json.error.message : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return json.data as T;
}

// ── Application row ───────────────────────────────────────────────────────────

function ApplicationRow({ application, onReview, busy }: {
  application: WorkerApplication;
  onReview: (id: string, status: "reviewing" | "approved" | "rejected", notes?: string) => Promise<void>;
  busy: boolean;
}) {
  const [notes, setNotes] = useState("");
  const meta = statusMeta(application.status);
  const resolved = application.status === "approved" || application.status === "rejected";

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 18px", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>{application.fullName}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, background: meta.bg, padding: "2px 8px", borderRadius: 99 }}>
              {meta.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", background: "rgba(148,163,184,.12)", padding: "2px 8px", borderRadius: 99 }}>
              {application.trade}
              {application.yearsExperience != null ? ` · ${application.yearsExperience} años` : ""}
            </span>
            {application.jobId ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Briefcase size={10} /> vacante {application.jobId.slice(0, 10)}…
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>aplicación general</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Mail size={11} /> {application.email}</span>
            {application.phone ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {application.phone}</span> : null}
            {application.city ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {application.city}</span> : null}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {formatDate(application.createdAt)}</span>
            {application.proposedRate != null ? (
              <span style={{ fontWeight: 700, color: "#10b981" }}>Propone: ${Number(application.proposedRate).toLocaleString("en-US")}</span>
            ) : null}
          </div>
        </div>
      </div>

      {application.message ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5, borderLeft: "3px solid var(--border)", paddingLeft: 10 }}>
          {application.message}
        </p>
      ) : null}

      {resolved ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
          Resuelta el {formatDate(application.reviewedAt)}
          {application.reviewedBy ? ` por ${application.reviewedBy}` : ""}
          {application.reviewNotes ? ` — ${application.reviewNotes}` : ""}
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notas de revisión (opcional)..."
            style={{ flex: "1 1 220px", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 12, outline: "none" }}
          />
          {application.status === "submitted" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onReview(application.id, "reviewing", notes.trim() || undefined)}
              style={actionButton("#f59e0b")}
            >
              <Clock size={12} /> En revisión
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (window.confirm(`¿Aprobar la postulación de ${application.email}? Esto la admite al marketplace de profesionales.`)) void onReview(application.id, "approved", notes.trim() || undefined); }}
            style={actionButton("#10b981")}
          >
            <CheckCircle2 size={12} /> Aprobar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (window.confirm(`¿Rechazar la postulación de ${application.email}? Esto la marca como resuelta de forma terminal.`)) void onReview(application.id, "rejected", notes.trim() || undefined); }}
            style={actionButton("#ef4444")}
          >
            <XCircle size={12} /> Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

function actionButton(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 12px",
    borderRadius: 8,
    border: `1px solid ${color}40`,
    background: `${color}14`,
    color,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkerApplicationsAdminPage() {
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [verification, setVerification] = useState<VerificationStats | null>(null);
  const [unverified, setUnverified] = useState<UnverifiedWorker[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}&limit=100` : "?limit=100";
      const [apps, appStats, verifStats, unverifiedList] = await Promise.all([
        fetchJson<WorkerApplication[]>(`/api/semse/workers/applications${query}`),
        fetchJson<ApplicationStats>("/api/semse/workers/applications/stats").catch(() => null),
        fetchJson<VerificationStats>("/api/semse/workers/verification/stats").catch(() => null),
        fetchJson<{ count: number; workers: UnverifiedWorker[] }>("/api/semse/workers/unverified")
          .then((data) => data.workers)
          .catch(() => [] as UnverifiedWorker[]),
      ]);
      setApplications(apps);
      setStats(appStats);
      setVerification(verifStats);
      setUnverified(unverifiedList);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las aplicaciones.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = useCallback(async (id: string, status: "reviewing" | "approved" | "rejected", notes?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fetchJson(`/api/semse/workers/applications/${encodeURIComponent(id)}/review`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, ...(notes ? { reviewNotes: notes } : {}) }),
      });
      setNotice(`Aplicación marcada como '${statusMeta(status).label}'.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar la aplicación.");
    } finally {
      setBusy(false);
    }
  }, [load]);

  const handleVerify = useCallback(async (workerId: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fetchJson(`/api/semse/workers/${encodeURIComponent(workerId)}/verify`, { method: "POST" });
      setNotice("Verificación iniciada. El worker recibirá el flujo de firma DID.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar la verificación.");
    } finally {
      setBusy(false);
    }
  }, [load]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <AdminPageHeader
        title="Workers — Aplicaciones y Verificación"
        subtitle="Aplicaciones públicas de /worker/apply y verificación de identidad de la red"
        icon={UserPlus}
        iconColor="#10b981"
        iconBg="rgba(16,185,129,.15)"
        backHref="/admin/trust"
        backLabel="Trust Scores"
        actions={
          <button onClick={() => void load()} disabled={loading}
            style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--muted)" }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Nuevas", value: stats?.submitted ?? "—", icon: UserPlus, color: "#818cf8" },
          { label: "En revisión", value: stats?.reviewing ?? "—", icon: Clock, color: "#f59e0b" },
          { label: "Aprobadas", value: stats?.approved ?? "—", icon: CheckCircle2, color: "#10b981" },
          { label: "Rechazadas", value: stats?.rejected ?? "—", icon: XCircle, color: "#ef4444" },
          { label: "Workers verificados", value: verification ? `${verification.verifiedCount}/${verification.totalWorkers}` : "—", icon: BadgeCheck, color: "#3b82f6" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon size={13} color={color} />
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{String(value)}</div>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[["", "Todas"], ["submitted", "Nuevas"], ["reviewing", "En revisión"], ["approved", "Aprobadas"], ["rejected", "Rechazadas"]].map(([value, label]) => (
          <button key={value} onClick={() => setStatusFilter(value)}
            style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${statusFilter === value ? "#10b981" : "var(--border)"}`, background: statusFilter === value ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.03)", color: statusFilter === value ? "#10b981" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>{error}</div>
      ) : null}
      {notice ? (
        <div style={{ padding: "10px 14px", background: "rgba(16,185,129,.1)", borderRadius: 10, fontSize: 12, color: "#34d399", marginBottom: 14 }}>{notice}</div>
      ) : null}

      {/* Applications list */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 26 }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={14} color="#818cf8" />
          <span style={{ fontSize: 12, fontWeight: 800 }}>Aplicaciones ({applications.length})</span>
        </div>

        {loading && applications.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Cargando aplicaciones…</div>
        ) : applications.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            {statusFilter ? "Sin aplicaciones en este estado." : "Aún no hay aplicaciones de workers."}
          </div>
        ) : (
          applications.map((application) => (
            <ApplicationRow key={application.id} application={application} onReview={handleReview} busy={busy} />
          ))
        )}
      </div>

      {/* Unverified workers */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={14} color="#3b82f6" />
          <span style={{ fontSize: 12, fontWeight: 800 }}>Workers sin verificar ({unverified.length})</span>
          {verification ? (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
              Tasa de verificación: {verification.verificationRate}%
            </span>
          ) : null}
        </div>

        {unverified.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            Todos los workers de la red están verificados.
          </div>
        ) : (
          unverified.map((worker) => {
            const name = worker.profile?.displayName ?? worker.displayName ?? worker.email ?? worker.id;
            return (
              <div key={worker.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>{worker.id}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleVerify(worker.id)}
                  style={actionButton("#3b82f6")}
                >
                  <UserCheck size={12} /> Iniciar verificación
                </button>
              </div>
            );
          })
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
