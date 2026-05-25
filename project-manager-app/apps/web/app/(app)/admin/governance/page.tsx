"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronUp, Clock,
  RefreshCw, Scale, Shield, ThumbsDown, ThumbsUp, Vote,
} from "lucide-react";
import { GovernanceTierBadge, type GovernanceTier } from "@/components/semse/GovernanceTierBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

type Proposal = {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "closed" | "passed" | "rejected" | "cancelled";
  authorId: string;
  authorReputationScore: number;
  mcaAdvice: string | null;
  mcaRisk: "low" | "medium" | "high";
  closesAt: string;
  createdAt: string;
  _count?: { votes: number };
};

type TallyResult = {
  totalVoters: number;
  forWeight: number;
  againstWeight: number;
  abstainWeight: number;
  totalWeight: number;
  forPercent: number;
  againstPercent: number;
  outcome: "passed" | "rejected" | "tie" | "quorum_not_met";
  quorumMet: boolean;
  proposalId: string;
  status: string;
  title: string;
  closesAt: string;
  mcaAdvice: string | null;
  mcaRisk: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreTier(score: number): GovernanceTier {
  if (score >= 75) return "steward";
  if (score >= 50) return "contributor";
  if (score >= 25) return "participant";
  return "observer";
}

const STATUS_COLORS: Record<string, string> = {
  open:      "#67e8f9",
  closed:    "#94a3b8",
  passed:    "#86efac",
  rejected:  "#fca5a5",
  cancelled: "#475569",
};

const RISK_COLORS: Record<string, string> = {
  low:    "#86efac",
  medium: "#fcd34d",
  high:   "#fca5a5",
};

const CATEGORY_LABELS: Record<string, string> = {
  general:    "General",
  platform:   "Plataforma",
  rules:      "Reglas",
  incentives: "Incentivos",
};

function VotingBar({ forPct, againstPct }: { forPct: number; againstPct: number }) {
  const absPct = 100 - forPct - againstPct;
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", gap: 1 }}>
      <div style={{ flex: forPct, background: "#86efac", transition: "flex .5s" }} />
      <div style={{ flex: absPct, background: "rgba(148,163,184,.3)", transition: "flex .5s" }} />
      <div style={{ flex: againstPct, background: "#fca5a5", transition: "flex .5s" }} />
    </div>
  );
}

function MCAAdviceChip({ risk, advice }: { risk: string; advice: string | null }) {
  const [open, setOpen] = useState(false);
  if (!advice) return null;
  const color = RISK_COLORS[risk] ?? "#94a3b8";
  return (
    <div style={{ borderRadius: 8, background: `${color}0d`, border: `1px solid ${color}25`, overflow: "hidden" }}>
      <button onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <Shield size={10} color={color} />
        <span style={{ fontSize: 9, fontWeight: 800, color, flex: 1 }}>MCA · riesgo {risk}</span>
        {open ? <ChevronUp size={10} color="var(--muted)" /> : <ChevronDown size={10} color="var(--muted)" />}
      </button>
      {open && <div style={{ padding: "0 10px 8px", fontSize: 10, color: "var(--muted)", lineHeight: 1.5 }}>{advice}</div>}
    </div>
  );
}

function ProposalCard({ proposal, tenantId }: { proposal: Proposal; tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [tally, setTally] = useState<TallyResult | null>(null);
  const [loadingTally, setLoadingTally] = useState(false);
  const [voting, setVoting] = useState(false);
  const [voteChoice, setVoteChoice] = useState<"for" | "against" | "abstain" | null>(null);

  const loadTally = useCallback(async () => {
    setLoadingTally(true);
    try {
      const res = await fetch(`/api/semse/governance/proposals/${proposal.id}/results`);
      const json = await res.json() as { data: TallyResult };
      if (res.ok) setTally(json.data);
    } catch { /* silent */ } finally { setLoadingTally(false); }
  }, [proposal.id]);

  const castVote = useCallback(async (choice: "for" | "against" | "abstain") => {
    if (voting) return;
    setVoting(true);
    setVoteChoice(choice);
    try {
      const res = await fetch(`/api/semse/governance/proposals/${proposal.id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, voterId: "me", choice, units: 1 }),
      });
      if (res.ok) await loadTally();
    } catch { /* silent */ } finally { setVoting(false); }
  }, [proposal.id, tenantId, voting, loadTally]);

  useEffect(() => { if (open) void loadTally(); }, [open, loadTally]);

  const statusColor = STATUS_COLORS[proposal.status] ?? "#94a3b8";
  const isOpen = proposal.status === "open";
  const daysLeft = Math.max(0, Math.ceil((new Date(proposal.closesAt).getTime() - Date.now()) / 86_400_000));

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${statusColor}25`, background: "var(--surface)", overflow: "hidden" }}>
      {/* Header row */}
      <button onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>

        {/* Status pill */}
        <span style={{ fontSize: 9, fontWeight: 900, color: statusColor, background: `${statusColor}15`, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap", textTransform: "uppercase" }}>
          {proposal.status}
        </span>

        {/* Category */}
        <span style={{ fontSize: 10, color: "var(--muted)", background: "rgba(255,255,255,.05)", padding: "2px 8px", borderRadius: 6 }}>
          {CATEGORY_LABELS[proposal.category] ?? proposal.category}
        </span>

        {/* Title */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{proposal.title}</span>

        {/* Author tier */}
        <GovernanceTierBadge tier={scoreTier(Number(proposal.authorReputationScore))} size="sm" />

        {/* Votes count */}
        {proposal._count && (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{proposal._count.votes} votos</span>
        )}

        {/* Time remaining */}
        {isOpen && (
          <span style={{ fontSize: 10, color: daysLeft <= 1 ? "#fca5a5" : "var(--muted)", whiteSpace: "nowrap" }}>
            {daysLeft === 0 ? "cierra hoy" : `${daysLeft}d restantes`}
          </span>
        )}

        {open ? <ChevronUp size={13} color="var(--muted)" /> : <ChevronDown size={13} color="var(--muted)" />}
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: "0 18px 16px", display: "grid", gap: 12 }}>

          {/* Description */}
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{proposal.description}</p>

          {/* MCA Advice */}
          <MCAAdviceChip risk={proposal.mcaRisk} advice={proposal.mcaAdvice} />

          {/* Tally */}
          {loadingTally && <div style={{ fontSize: 11, color: "var(--muted)" }}>Calculando votos…</div>}

          {tally && (
            <div style={{ display: "grid", gap: 8 }}>
              <VotingBar forPct={tally.forPercent} againstPct={tally.againstPercent} />
              <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                <span style={{ color: "#86efac" }}><ThumbsUp size={10} style={{ verticalAlign: "middle", marginRight: 3 }} />{tally.forPercent}% a favor</span>
                <span style={{ color: "#fca5a5" }}><ThumbsDown size={10} style={{ verticalAlign: "middle", marginRight: 3 }} />{tally.againstPercent}% en contra</span>
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                  {tally.totalVoters} votantes · peso {tally.totalWeight.toFixed(1)}
                  {!tally.quorumMet && <span style={{ color: "#fb923c", marginLeft: 6 }}>sin quórum</span>}
                </span>
              </div>
              {tally.outcome !== "quorum_not_met" && tally.totalVoters > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: tally.outcome === "passed" ? "#86efac" : tally.outcome === "rejected" ? "#fca5a5" : "#fcd34d" }}>
                  → Resultado: {tally.outcome === "passed" ? "APROBADA" : tally.outcome === "rejected" ? "RECHAZADA" : "EMPATE"}
                </div>
              )}
            </div>
          )}

          {/* Vote buttons */}
          {isOpen && (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {(["for", "against", "abstain"] as const).map((choice) => (
                <button key={choice} onClick={() => castVote(choice)} disabled={voting}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: voting ? "wait" : "pointer",
                    fontSize: 11, fontWeight: 700,
                    background: voteChoice === choice ? (choice === "for" ? "#86efac20" : choice === "against" ? "#fca5a520" : "rgba(255,255,255,.08)") : "rgba(255,255,255,.04)",
                    color: choice === "for" ? "#86efac" : choice === "against" ? "#fca5a5" : "var(--muted)",
                    border: voteChoice === choice ? `1px solid ${choice === "for" ? "#86efac40" : choice === "against" ? "#fca5a540" : "rgba(255,255,255,.15)"}` : "1px solid transparent",
                  }}>
                  {choice === "for" ? "✓ A favor" : choice === "against" ? "✗ En contra" : "~ Abstención"}
                </button>
              ))}
            </div>
          )}

          {/* Meta */}
          <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--muted)", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <Clock size={9} style={{ verticalAlign: "middle" }} />
            <span>Cierra: {new Date(proposal.closesAt).toLocaleDateString("es-MX")}</span>
            <span>Autor score: {Number(proposal.authorReputationScore).toFixed(1)}/100</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GovernanceFeed ────────────────────────────────────────────────────────────

function GovernanceFeed({ proposals }: { proposals: Proposal[] }) {
  const recent = [...proposals]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, padding: "16px 18px", background: "rgba(255,255,255,.02)", border: "1px solid var(--border)", borderRadius: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 12, letterSpacing: "0.05em" }}>
        ACTIVIDAD RECIENTE
      </div>
      <div style={{ display: "grid", gap: 0 }}>
        {recent.map((p, i) => {
          const statusColor = STATUS_COLORS[p.status] ?? "#94a3b8";
          const tier = scoreTier(Number(p.authorReputationScore));
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: i < recent.length - 1 ? 12 : 0, marginBottom: i < recent.length - 1 ? 12 : 0, borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none" }}>
              {/* Timeline dot */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, marginTop: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor }} />
                {i < recent.length - 1 && <div style={{ width: 1, height: "100%", minHeight: 28, background: "var(--border)", marginTop: 4 }} />}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.title}</span>
                  <GovernanceTierBadge tier={tier} size="sm" />
                  <span style={{ fontSize: 9, fontWeight: 900, color: statusColor, background: `${statusColor}15`, padding: "1px 7px", borderRadius: 99, textTransform: "uppercase" }}>
                    {p.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  {new Date(p.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  {" · "}
                  {CATEGORY_LABELS[p.category] ?? p.category}
                  {p._count?.votes ? ` · ${p._count.votes} votos` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TENANT_ID = process.env.NEXT_PUBLIC_SEMSE_TENANT_ID ?? "default";

export default function GovernancePage() {
  const [proposals, setProposals]   = useState<Proposal[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [lastAt, setLastAt]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = statusFilter ? `?tenantId=${TENANT_ID}&status=${statusFilter}` : `?tenantId=${TENANT_ID}`;
      const res = await fetch(`/api/semse/governance/proposals${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: Proposal[] };
      setProposals(json.data ?? []);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar propuestas");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const openCount   = proposals.filter((p) => p.status === "open").length;
  const passedCount = proposals.filter((p) => p.status === "passed").length;
  const totalVotes  = proposals.reduce((acc, p) => acc + (p._count?.votes ?? 0), 0);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Scale size={20} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>DAO Governance</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Propuestas de la plataforma — votación ponderada por reputación
            {lastAt && <> · actualizado {lastAt}</>}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "none", cursor: loading ? "wait" : "pointer", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Actualizar
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Propuestas",  value: proposals.length, color: "#818cf8" },
          { label: "Abiertas",    value: openCount,         color: "#67e8f9" },
          { label: "Aprobadas",   value: passedCount,       color: "#86efac" },
          { label: "Votos cast",  value: totalVotes,        color: "#fcd34d" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["", "open", "passed", "rejected", "closed"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: statusFilter === s ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.04)",
              color: statusFilter === s ? "#818cf8" : "var(--muted)",
            }}>
            {s === "" ? "Todas" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "14px 18px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Governance Tier legend */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>TIERS:</span>
        {(["observer", "participant", "contributor", "steward"] as GovernanceTier[]).map((t) => (
          <GovernanceTierBadge key={t} tier={t} size="sm" />
        ))}
        <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4 }}>— el peso del voto aumenta con la reputación</span>
      </div>

      {/* Activity feed */}
      {proposals.length > 0 && <GovernanceFeed proposals={proposals} />}

      {/* Proposals list */}
      {proposals.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
          <Vote size={32} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: "var(--muted)" }}>No hay propuestas{statusFilter ? ` con estado "${statusFilter}"` : ""}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, opacity: 0.6 }}>Las propuestas de la comunidad aparecerán aquí</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} tenantId={TENANT_ID} />
        ))}
      </div>

      {/* Alert note */}
      {openCount > 0 && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(103,232,249,.06)", border: "1px solid rgba(103,232,249,.2)", borderRadius: 10 }}>
          <AlertTriangle size={12} color="#67e8f9" />
          <span style={{ fontSize: 11, color: "#67e8f9" }}>
            {openCount} propuesta{openCount > 1 ? "s" : ""} abierta{openCount > 1 ? "s" : ""} esperando participación
          </span>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
