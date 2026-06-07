"use client";

import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useState } from "react";

// ── Types (mirror of BehavioralHealth from behavioral-observer.service.ts) ────

export type BehavioralAlert = {
  level: "critical" | "high" | "medium" | "info";
  area: string;
  signal: string;
  recommendation: string;
};

export type BehavioralHealth = {
  observedAt: string;
  tenantId: string;
  users: {
    totalActive: number;
    verification: { unverified: number; pending: number; verified: number; suspended: number };
    trustRisk: { low: number; medium: number; high: number; critical: number };
    flagged: number;
  };
  reputation: {
    tierDistribution: { emerging: number; growing: number; established: number; trusted: number };
    avgScore: number;
    scoredProfessionals: number;
  };
  governance: {
    openDisputes: number;
    openDisputeRate: number;
    disputeResolutionRate: number;
    recentDisputeSurge: boolean;
  };
  market: {
    activeJobs: number;
    recentJobsPosted: number;
    recentJobsCompleted: number;
    staleJobs: number;
  };
  alerts: BehavioralAlert[];
  behavioralScore: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function alertColor(level: BehavioralAlert["level"]) {
  return level === "critical" ? "#fca5a5" : level === "high" ? "#fb923c" : level === "medium" ? "#fcd34d" : "#94a3b8";
}

function alertBg(level: BehavioralAlert["level"]) {
  return level === "critical" ? "rgba(239,68,68,.10)" : level === "high" ? "rgba(251,146,60,.08)" : level === "medium" ? "rgba(234,179,8,.07)" : "rgba(148,163,184,.07)";
}

function scoreColor(n: number) {
  if (n >= 80) return "#86efac";
  if (n >= 55) return "#fcd34d";
  return "#fca5a5";
}

function TierBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 28px", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width .5s" }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 800, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function BehavioralAlertRow({ alert }: { alert: BehavioralAlert }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: 8, background: alertBg(alert.level), border: `1px solid ${alertColor(alert.level)}28`, overflow: "hidden" }}>
      <button onClick={() => setExpanded((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <AlertTriangle size={11} color={alertColor(alert.level)} />
        <span style={{ fontSize: 10, fontWeight: 800, color: alertColor(alert.level), minWidth: 50 }}>{alert.level.toUpperCase()}</span>
        <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, minWidth: 90 }}>{alert.area}</span>
        <span style={{ fontSize: 11, color: "var(--ink)", flex: 1 }}>{alert.signal}</span>
        {expanded ? <ChevronUp size={10} color="var(--muted)" /> : <ChevronDown size={10} color="var(--muted)" />}
      </button>
      {expanded && (
        <div style={{ padding: "0 12px 10px", fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
          <span style={{ color: "#818cf8", fontWeight: 600 }}>→ </span>{alert.recommendation}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BehavioralHealthSection({ health }: { health: BehavioralHealth }) {
  const { users, reputation, governance, market, alerts, behavioralScore } = health;
  const repTotal = reputation.scoredProfessionals;

  return (
    <div style={{ display: "grid", gap: 12 }}>

      {/* Score + quick stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 10, alignItems: "center" }}>
        {/* Behavioral Score Ring */}
        <div style={{ textAlign: "center" }}>
          <svg width={60} height={60}>
            {(() => {
              const r = 24; const circ = 2 * Math.PI * r;
              const fill = circ - (behavioralScore / 100) * circ;
              return (
                <>
                  <circle cx={30} cy={30} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={5} />
                  <circle cx={30} cy={30} r={r} fill="none" stroke={scoreColor(behavioralScore)} strokeWidth={5}
                    strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
                    transform="rotate(-90 30 30)" style={{ transition: "stroke-dashoffset .6s ease" }} />
                  <text x={30} y={35} textAnchor="middle" fill={scoreColor(behavioralScore)} fontSize={13} fontWeight={800}>{behavioralScore}</text>
                </>
              );
            })()}
          </svg>
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>social score</div>
        </div>

        {[
          { label: "Usuarios activos", value: users.totalActive, sub: `${users.flagged} flagged`, color: users.flagged > 5 ? "#fb923c" : "#86efac" },
          { label: "Disputas abiertas", value: governance.openDisputes, sub: governance.recentDisputeSurge ? "⚠ surge" : `${Math.round(governance.openDisputeRate * 100)}% rate`, color: governance.recentDisputeSurge ? "#fca5a5" : governance.openDisputes > 0 ? "#fcd34d" : "#86efac" },
          { label: "Jobs activos", value: market.activeJobs, sub: `${market.recentJobsCompleted} completados/7d`, color: "#818cf8" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Reputation tier distribution */}
      {repTotal > 0 && (
        <div style={{ padding: "12px 14px", background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Users size={11} color="#818cf8" />
            <span style={{ fontSize: 11, fontWeight: 800 }}>Distribución de reputación</span>
            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>avg {reputation.avgScore}/100 · {repTotal} pros</span>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <TierBar label="emerging"    value={reputation.tierDistribution.emerging}    total={repTotal} color="#94a3b8" />
            <TierBar label="growing"     value={reputation.tierDistribution.growing}     total={repTotal} color="#67e8f9" />
            <TierBar label="established" value={reputation.tierDistribution.established} total={repTotal} color="#818cf8" />
            <TierBar label="trusted"     value={reputation.tierDistribution.trusted}     total={repTotal} color="#86efac" />
          </div>
        </div>
      )}

      {/* Trust risk distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 8 }}>TRUST RISK</div>
          {[
            { label: "critical", value: users.trustRisk.critical, color: "#fca5a5" },
            { label: "high",     value: users.trustRisk.high,     color: "#fb923c" },
            { label: "medium",   value: users.trustRisk.medium,   color: "#fcd34d" },
            { label: "low",      value: users.trustRisk.low,      color: "#86efac" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 8 }}>MERCADO</div>
          {[
            { label: "jobs recientes",   value: market.recentJobsPosted,   icon: TrendingUp,   color: "#818cf8" },
            { label: "completados/7d",   value: market.recentJobsCompleted, icon: TrendingUp,   color: "#86efac" },
            { label: "jobs estancados",  value: market.staleJobs,          icon: TrendingDown,  color: market.staleJobs > 10 ? "#fcd34d" : "var(--muted)" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Icon size={9} color={color} />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>resolución disputas</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: governance.disputeResolutionRate >= 0.7 ? "#86efac" : "#fcd34d" }}>
              {Math.round(governance.disputeResolutionRate * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Behavioral alerts */}
      {alerts.length > 0 && (
        <div style={{ display: "grid", gap: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={10} color="#fcd34d" />
            ALERTAS SOCIALES ({alerts.length})
          </div>
          {alerts.map((a, i) => <BehavioralAlertRow key={i} alert={a} />)}
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(134,239,172,.05)", border: "1px solid rgba(134,239,172,.2)", borderRadius: 10 }}>
          <span style={{ fontSize: 11, color: "#86efac", fontWeight: 600 }}>✓ Plataforma socialmente estable</span>
        </div>
      )}
    </div>
  );
}
