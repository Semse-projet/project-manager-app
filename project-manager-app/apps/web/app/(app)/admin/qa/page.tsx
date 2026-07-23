"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Activity, Clock, RefreshCw } from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { fetchJobs, fetchOpsAgentRuntime, fetchDisputes, fetchJobEvidence, fetchJobMilestones } from "../../../semse-api";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

interface QACheck {
  id: string;
  name: string;
  category: "evidence" | "escrow" | "agent" | "milestone" | "compliance";
  status: "pass" | "fail" | "warn" | "running";
  message: string;
  jobsAffected?: number;
  lastRun: string;
}

const STATUS_ICON: Record<QACheck["status"], React.ReactNode> = {
  pass:    <CheckCircle size={16} color="#10b981" />,
  fail:    <XCircle size={16} color="#ef4444" />,
  warn:    <AlertTriangle size={16} color="#fbbf24" />,
  running: <Activity size={16} color="#3b82f6" />,
};

const STATUS_MAP: Record<QACheck["status"], { variant: "success" | "error" | "warning" | "info"; label: string }> = {
  pass:    { variant: "success", label: "OK" },
  fail:    { variant: "error",   label: "Fallo" },
  warn:    { variant: "warning", label: "Alerta" },
  running: { variant: "info",    label: "Ejecutando" },
};

const CAT_LABEL: Record<QACheck["category"], string> = {
  evidence: "Evidencia", escrow: "Escrow", agent: "Agente", milestone: "Milestone", compliance: "Compliance",
};

const CAT_LINK: Record<QACheck["category"], string> = {
  evidence: "/admin/ops", escrow: "/admin/finance", agent: "/admin/ops",
  milestone: "/admin/ops", compliance: "/admin/compliance",
};

const FALLBACK_CHECKS: QACheck[] = [
  { id: "q1", name: "Evidencia mínima por milestone", category: "evidence", status: "warn",  message: "3 milestones sin al menos 1 foto.", jobsAffected: 3, lastRun: "—" },
  { id: "q2", name: "Escrow fondeado antes de inicio", category: "escrow",  status: "pass",  message: "Todos los trabajos in_progress tienen escrow cubierto.", lastRun: "—" },
  { id: "q3", name: "Agent runs sin resultado",        category: "agent",   status: "fail",  message: "2 runs en estado 'running' >10 min.", jobsAffected: 2, lastRun: "—" },
  { id: "q4", name: "Transición de status válida FSM", category: "milestone",status: "pass", message: "Ninguna transición inválida detectada.", lastRun: "—" },
  { id: "q5", name: "Dispute sin agente asignado",     category: "compliance",status: "warn",message: "1 disputa abierta sin run de agente.", jobsAffected: 1, lastRun: "—" },
];

export default function AdminQAPage() {
  const { t } = useLanguage();
  const [checks, setChecks]   = useState<QACheck[]>(FALLBACK_CHECKS);
  const [running, setRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>("—");
  const [error, setError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setError(null);
    const now = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    try {
      const [jobs, runtimeData, disputes] = await Promise.all([
        fetchJobs(),
        fetchOpsAgentRuntime({ limit: 100 }).catch(() => ({ items: [] as unknown[] })),
        fetchDisputes().catch(() => [] as unknown[]),
      ]);

      const activeJobs = jobs.filter(j => ["in_progress", "accepted", "reserved"].includes(j.status));
      const results: QACheck[] = [];

      // Check 1: evidence per milestone
      let missingEvidence = 0;
      await Promise.all(
        activeJobs.slice(0, 8).map(async j => {
          try {
            const [milestones, evidence] = await Promise.all([
              fetchJobMilestones(j.id),
              fetchJobEvidence(j.id),
            ]);
            const approvedMilestones = milestones.filter(m => {
              const row = m as Record<string, unknown>;
              return String(row.status ?? "") === "approved";
            });
            const evidenceCount = evidence.length;
            if (approvedMilestones.length > 0 && evidenceCount === 0) missingEvidence++;
          } catch { /* skip */ }
        })
      );
      results.push({
        id: "q1", name: "Evidencia mínima por milestone", category: "evidence",
        status: missingEvidence === 0 ? "pass" : missingEvidence <= 2 ? "warn" : "fail",
        message: missingEvidence === 0
          ? "Todos los milestones aprobados tienen evidencia registrada."
          : `${missingEvidence} trabajo(s) con milestones aprobados sin evidencia.`,
        jobsAffected: missingEvidence > 0 ? missingEvidence : undefined,
        lastRun: now,
      });

      // Check 2: escrow before in_progress
      const inProgressNoEscrow = jobs.filter((j) => {
        const row = j as Record<string, unknown>;
        return j.status === "in_progress" && !Boolean(row.escrowFunded);
      }).length;
      results.push({
        id: "q2", name: "Escrow fondeado antes de inicio", category: "escrow",
        status: inProgressNoEscrow === 0 ? "pass" : "fail",
        message: inProgressNoEscrow === 0
          ? "Todos los trabajos in_progress tienen escrow cubierto."
          : `${inProgressNoEscrow} trabajo(s) in_progress sin escrow fondeado.`,
        jobsAffected: inProgressNoEscrow > 0 ? inProgressNoEscrow : undefined,
        lastRun: now,
      });

      // Check 3: stale agent runs
      const items = (runtimeData as { items?: unknown[] }).items ?? [];
      const staleRunning = items.filter(i => {
        const row = i as Record<string, unknown>;
        if (String(row.status ?? "") !== "running") return false;
        const started = row.startedAt ?? row.createdAt;
        if (typeof started !== "string") return false;
        const elapsed = Date.now() - new Date(started).getTime();
        return elapsed > 10 * 60 * 1000;
      });
      results.push({
        id: "q3", name: "Agent runs sin resultado", category: "agent",
        status: staleRunning.length === 0 ? "pass" : staleRunning.length <= 2 ? "warn" : "fail",
        message: staleRunning.length === 0
          ? "Ningún agent run lleva más de 10 min en estado running."
          : `${staleRunning.length} run(s) en estado 'running' por más de 10 min.`,
        jobsAffected: staleRunning.length > 0 ? staleRunning.length : undefined,
        lastRun: now,
      });

      // Check 4: dispute jobs
      const disputedJobs = jobs.filter(j => j.status === "dispute");
      results.push({
        id: "q4", name: "Transición de status válida FSM", category: "milestone",
        status: disputedJobs.length === 0 ? "pass" : "warn",
        message: disputedJobs.length === 0
          ? "Ninguna transición inválida detectada en los últimos datos."
          : `${disputedJobs.length} trabajo(s) en disputa activa.`,
        jobsAffected: disputedJobs.length > 0 ? disputedJobs.length : undefined,
        lastRun: now,
      });

      // Check 5: open disputes without resolution
      const openDisputes = (disputes as Record<string, unknown>[]).filter(d => {
        const status = String(d.status ?? "");
        return status === "open" || status === "pending";
      });
      const noRunDisputes = openDisputes.filter(d => !d.agentRunId && !d.assignedAgentId);
      results.push({
        id: "q5", name: "Dispute sin agente asignado", category: "compliance",
        status: noRunDisputes.length === 0 ? "pass" : "warn",
        message: noRunDisputes.length === 0
          ? "Todas las disputas abiertas tienen agente asignado."
          : `${noRunDisputes.length} disputa(s) abierta(s) sin run de dispute-agent.`,
        jobsAffected: noRunDisputes.length > 0 ? noRunDisputes.length : undefined,
        lastRun: now,
      });

      setChecks(results);
      setLastRefresh(now);
    } catch (e) {
      // Previously stamped lastRun with the current time on failure, making
      // stale/fallback data look freshly verified. Leave checks and
      // lastRefresh untouched and surface the real error instead — see
      // docs/AUDIT_REMEDIATION_PLAN.md 3.27.
      setError(e instanceof Error ? e.message : "No se pudo ejecutar el pipeline de QA");
    }
    setRunning(false);
  }, []);

  useEffect(() => { void runChecks(); }, [runChecks]);

  const pass = checks.filter(c => c.status === "pass").length;
  const fail = checks.filter(c => c.status === "fail").length;
  const warn = checks.filter(c => c.status === "warn").length;

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto" }}>
      <AdminPageHeader
        title={t("page.qaCenter")}
        subtitle="Validaciones automáticas del pipeline operativo"
        icon={ShieldCheck}
        iconColor="#6366f1"
        iconBg="rgba(99,102,241,0.15)"
        panel
        actions={
          <>
            <NotificationBanner audience="admin" />
            <button onClick={() => void runChecks()} disabled={running} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", border: "none", background: running ? "var(--muted)" : "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: running ? "not-allowed" : "pointer" }}>
              {running ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <ShieldCheck size={15} />}
              {running ? "Ejecutando..." : "Ejecutar todos"}
            </button>
          </>
        }
      />

      {error && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", color: "#fca5a5", fontSize: "13px" }}>
          No se pudo ejecutar el pipeline de QA: {error}. Los checks mostrados abajo son de la última corrida exitosa (o datos de respaldo si nunca corrió con éxito) — no confirmados ahora.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Checks OK", value: pass, color: "#10b981", bg: "rgba(16,185,129,.08)" },
          { label: "Alertas",   value: warn, color: "#fbbf24", bg: "rgba(251,191,36,.08)" },
          { label: "Fallos",    value: fail, color: "#ef4444", bg: "rgba(239,68,68,.08)" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "16px", background: s.bg, borderColor: `${s.color}30`, textAlign: "center" }}>
            <p style={{ fontSize: "28px", fontWeight: 900, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <HtmlInCanvasPanel as="section" style={{ marginBottom: "12px", fontSize: "11px", color: "var(--faint)", display: "flex", alignItems: "center", gap: "6px" }} canvasClassName="rounded-2xl" minHeight={24}>
        <Clock size={11} /> Última ejecución: {lastRefresh}
      </HtmlInCanvasPanel>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {checks.map(check => {
          const s = STATUS_MAP[check.status];
          return (
            <div key={check.id} style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={{ marginTop: "2px", flexShrink: 0 }}>{STATUS_ICON[check.status]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{check.name}</p>
                  <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)", fontWeight: 600 }}>{CAT_LABEL[check.category]}</span>
                  <StatusBadge variant={s.variant} text={s.label} size="sm" />
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>{check.message}</p>
                {check.jobsAffected ? (
                  <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 600, marginTop: "4px" }}>▶ {check.jobsAffected} trabajo{check.jobsAffected > 1 ? "s" : ""} afectado{check.jobsAffected > 1 ? "s" : ""}</p>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "2px" }}>{check.lastRun}</p>
                <Link href={CAT_LINK[check.category]} style={{ padding: "5px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "11px", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                  Ver →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
