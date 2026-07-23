"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Shield, ShieldCheck, Star, TrendingUp, UserPlus,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { TrustPassportCard } from "../../../../components/semse/TrustPassportCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type TrustEntry = {
  scopeType:    string;
  scopeId:      string;
  jobId?:       string;
  projectId?:   string;
  score:        number;
  level:        "low" | "medium" | "high" | "critical";
  flags:        string[];
  primaryReason: string;
  lastUpdatedAt?: string;
};

type TrustOverview = {
  total:    number;
  highRisk: number;
  mediumRisk?: number;
  lowRisk?:    number;
  entries:  TrustEntry[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  low:      "#86efac",
  medium:   "#fcd34d",
  high:     "#fb923c",
  critical: "#fca5a5",
};

const LEVEL_LABELS: Record<string, string> = {
  low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#86efac" : score >= 40 ? "#fcd34d" : "#fca5a5";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.08)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(4, score)}%`, height: "100%", background: color, borderRadius: 99, transition: "width .5s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

// ── TrustEntryRow ─────────────────────────────────────────────────────────────

const TENANT_ID = process.env.NEXT_PUBLIC_SEMSE_TENANT_ID ?? "default";

function TrustEntryRow({ entry }: { entry: TrustEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = entry.scopeType === "user";

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px 1fr auto", gap: 10, padding: "12px 18px", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
            {entry.scopeType}: {entry.scopeId.slice(0, 12)}
          </div>
          {entry.flags.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {entry.flags.slice(0, 3).map((f) => (
                <span key={f} style={{ fontSize: 9, color: "#fca5a5", background: "rgba(239,68,68,.1)", padding: "1px 6px", borderRadius: 99 }}>{f}</span>
              ))}
            </div>
          )}
        </div>
        <ScoreBar score={entry.score} />
        <div>
          <span style={{ fontSize: 10, fontWeight: 800, color: LEVEL_COLORS[entry.level] ?? "#94a3b8", background: `${LEVEL_COLORS[entry.level] ?? "#94a3b8"}20`, padding: "2px 8px", borderRadius: 99 }}>
            {LEVEL_LABELS[entry.level] ?? entry.level}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {entry.primaryReason}
        </div>
        {isUser && (
          <button onClick={() => setExpanded((p) => !p)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, background: expanded ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.04)", border: "1px solid var(--border)", cursor: "pointer", color: expanded ? "#818cf8" : "var(--muted)", fontSize: 10, fontWeight: 700 }}>
            <ShieldCheck size={11} />
            Pasaporte
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>
      {expanded && isUser && (
        <div style={{ padding: "0 18px 16px" }}>
          <TrustPassportCard userId={entry.scopeId} tenantId={TENANT_ID} />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrustPage() {
  const [data,    setData]    = useState<TrustOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [lastAt,  setLastAt]  = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/ops/trust-overview");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: TrustOverview };
      setData(json.data ?? null);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Auto-refresh every 30s — trust scores update when jobs/ratings change
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const entries = data?.entries ?? [];
  const filtered = levelFilter ? entries.filter((e) => e.level === levelFilter) : entries;

  const avgScore = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length)
    : null;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <AdminPageHeader
        title="Trust Scores"
        subtitle={`Reputación y confianza de profesionales y proyectos${lastAt ? ` · ${lastAt} · auto-refresh 30s` : ""}`}
        icon={Shield}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,.15)"
        showBack={false}
        actions={
          <>
            <Link href="/admin/trust/worker-applications"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)", color: "#10b981", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
              <UserPlus size={13} /> Aplicaciones de workers
            </Link>
            <button onClick={load} disabled={loading}
              style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--muted)" }}>
              <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </>
        }
      />

      {/* Stats */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total evaluados", value: String(data.total),    icon: Star,         color: "#818cf8" },
            { label: "Alto riesgo",     value: String(data.highRisk), icon: AlertTriangle, color: "#fca5a5" },
            { label: "Puntaje promedio", value: avgScore ? String(avgScore) : "—", icon: TrendingUp, color: avgScore && avgScore >= 60 ? "#86efac" : "#fcd34d" },
            { label: "Sin riesgo",      value: String(entries.filter((e) => e.level === "low").length), icon: CheckCircle2, color: "#86efac" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon size={13} color={color} />
                <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Level filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[["", "Todos"], ["low", "Bajo"], ["medium", "Medio"], ["high", "Alto"], ["critical", "Crítico"]].map(([val, label]) => (
          <button key={val} onClick={() => setLevelFilter(val as string)}
            style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${levelFilter === val ? "#818cf8" : "var(--border)"}`, background: levelFilter === val ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.03)", color: levelFilter === val ? "#818cf8" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {label} {val && data ? `(${entries.filter((e) => e.level === val).length})` : ""}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>{error}</div>}

      {/* Entries table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px 1fr auto", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
          <span>SCOPE</span><span>SCORE</span><span>NIVEL</span><span>RAZÓN PRINCIPAL</span><span>PASAPORTE</span>
        </div>

        {!data && !loading && (
          <div style={{ padding: "32px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Cargando trust scores…</div>
        )}

        {filtered.length === 0 && data && (
          <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            {levelFilter ? "Sin entradas en este nivel" : "Sin datos de trust disponibles"}
          </div>
        )}

        {filtered.map((e, i) => (
          <TrustEntryRow key={`${e.scopeId}-${i}`} entry={e} />
        ))}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
