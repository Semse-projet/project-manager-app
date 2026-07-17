"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ReputationSignals = {
  decayedRating: number;
  completionRate: number;
  disputeResilienceRate: number;
  verificationSignal: number;
  totalRatings: number;
  totalJobsAsProf: number;
  completedJobs: number;
  disputesAgainst: number;
};

type ReputationScore = {
  userId: string;
  score: number;
  tier: "emerging" | "growing" | "established" | "trusted";
  signals: ReputationSignals;
  decayHalfLifeDays: number;
  algorithmVersion: string;
  computedAt: string;
  user?: { email?: string; name?: string };
};

type RatingRecord = {
  id: string;
  jobId: string;
  score: number;
  comment?: string;
  createdAt: string;
  job: { id: string; title: string };
  fromUser: { id: string; email: string };
  toUser: { id: string; email: string };
};

// ── Constants ──────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  trusted: "#22c55e",
  established: "#3b82f6",
  growing: "#eab308",
  emerging: "#94a3b8",
};

const TIER_BG: Record<string, string> = {
  trusted: "rgba(34,197,94,.12)",
  established: "rgba(59,130,246,.12)",
  growing: "rgba(234,179,8,.12)",
  emerging: "rgba(148,163,184,.1)",
};

const TIER_LABEL: Record<string, string> = {
  trusted: "Trusted",
  established: "Established",
  growing: "Growing",
  emerging: "Emerging",
};

function scoreBar(value: number, color = "#3b82f6") {
  return (
    <div style={{ height: "4px", background: "var(--border, #1f2d3d)", borderRadius: "2px", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: color, borderRadius: "2px", transition: "width 0.3s" }} />
    </div>
  );
}

function starRow(score: number) {
  return (
    <span style={{ color: "#eab308", fontSize: "13px" }}>
      {Array.from({ length: 5 }, (_, i) => (i < score ? "★" : "☆")).join("")}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ── Reputation Card ────────────────────────────────────────────────────────────

function ReputationCard({
  rep,
  selected,
  onClick,
}: {
  rep: ReputationScore;
  selected: boolean;
  onClick: () => void;
}) {
  const color = TIER_COLOR[rep.tier] ?? "#94a3b8";
  const bg = TIER_BG[rep.tier] ?? "transparent";

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(59,130,246,.08)" : "var(--surface, #0c1017)",
        border: `1px solid ${selected ? "#3b82f6" : "var(--border, #1f2d3d)"}`,
        borderRadius: "12px",
        padding: "14px 16px",
        cursor: "pointer",
        marginBottom: "8px",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "50%",
          background: `linear-gradient(135deg, ${color}40, ${color}20)`,
          border: `1px solid ${color}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "14px", fontWeight: 800, color,
        }}>
          {Math.round(rep.score)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #f1f5f9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {rep.user?.email ?? rep.userId.slice(-8)}
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
            <span style={{
              fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              color, background: bg, border: `1px solid ${color}30`,
              borderRadius: "4px", padding: "1px 6px",
            }}>
              {TIER_LABEL[rep.tier]}
            </span>
            <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>
              {rep.signals.totalRatings} rating{rep.signals.totalRatings !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div style={{ fontSize: "22px", fontWeight: 800, color, flexShrink: 0 }}>
          {rep.score.toFixed(1)}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", width: "80px", flexShrink: 0 }}>Ratings</span>
          {scoreBar(rep.signals.decayedRating, "#eab308")}
          <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)", width: "32px", textAlign: "right" }}>
            {Math.round(rep.signals.decayedRating * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", width: "80px", flexShrink: 0 }}>Completion</span>
          {scoreBar(rep.signals.completionRate, "#22c55e")}
          <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)", width: "32px", textAlign: "right" }}>
            {Math.round(rep.signals.completionRate * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", width: "80px", flexShrink: 0 }}>No disputes</span>
          {scoreBar(rep.signals.disputeResilienceRate, "#3b82f6")}
          <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)", width: "32px", textAlign: "right" }}>
            {Math.round(rep.signals.disputeResilienceRate * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ReputationPage() {
  const [reputations, setReputations] = useState<ReputationScore[]>([]);
  const [ratings, setRatings] = useState<RatingRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "tier" | "ratings">("score");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [repRes, ratRes] = await Promise.all([
        fetch("/api/semse/ratings/reputation", { credentials: "include" }),
        fetch("/api/semse/ratings", { credentials: "include" }),
      ]);
      if (repRes.ok) {
        const repData = (await repRes.json()) as { data?: ReputationScore[] };
        setReputations(repData.data ?? []);
      }
      if (ratRes.ok) {
        const ratData = (await ratRes.json()) as { data?: { items?: RatingRecord[] } };
        setRatings(ratData.data?.items ?? []);
      }
    } catch {
      setError("No se pudo cargar la reputación.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const sorted = [...reputations].sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    if (sortBy === "ratings") return b.signals.totalRatings - a.signals.totalRatings;
    const tierOrder = { trusted: 3, established: 2, growing: 1, emerging: 0 };
    return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
  });

  const selectedRep = reputations.find((r) => r.userId === selected);
  const selectedRatings = ratings.filter((r) => r.toUser.id === selected);

  const tierCounts = reputations.reduce<Record<string, number>>((acc, r) => {
    acc[r.tier] = (acc[r.tier] ?? 0) + 1;
    return acc;
  }, {});

  const avgScore = reputations.length > 0
    ? reputations.reduce((s, r) => s + r.score, 0) / reputations.length
    : 0;

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink, #f1f5f9)", margin: 0 }}>
            ⭐ Reputación
          </h1>
          <div style={{ flex: 1 }} />
          <button onClick={() => void fetchData()} style={{
            padding: "6px 12px", borderRadius: "7px",
            border: "1px solid var(--border, #1f2d3d)", background: "transparent",
            color: "var(--muted, #94a3b8)", fontSize: "12px", cursor: "pointer",
          }}>↻ Refresh</button>
        </div>
        <p style={{ fontSize: "12px", color: "var(--faint, #4b6280)", margin: 0 }}>
          Score de reputación multi-señal: ratings (×0.4) + completión (×0.3) + disputas (×0.2) + verificación (×0.1)
        </p>
      </div>

      {/* Platform summary */}
      {!loading && reputations.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
          {[
            { label: "Contratistas", value: reputations.length, color: "#3b82f6", emoji: "👷" },
            { label: "Score promedio", value: avgScore.toFixed(1), color: "#22c55e", emoji: "📊" },
            { label: "Trusted", value: tierCounts.trusted ?? 0, color: TIER_COLOR.trusted, emoji: "🏆" },
            { label: "Established", value: tierCounts.established ?? 0, color: TIER_COLOR.established, emoji: "✅" },
            { label: "Growing", value: tierCounts.growing ?? 0, color: TIER_COLOR.growing, emoji: "📈" },
            { label: "Emerging", value: tierCounts.emerging ?? 0, color: TIER_COLOR.emerging, emoji: "🌱" },
            { label: "Total ratings", value: ratings.length, color: "#eab308", emoji: "⭐" },
          ].map(({ label, value, color, emoji }) => (
            <div key={label} style={{
              background: "var(--surface, #0c1017)",
              border: "1px solid var(--border, #1f2d3d)",
              borderRadius: "10px", padding: "10px 14px",
            }}>
              <div style={{ fontSize: "16px", marginBottom: "2px" }}>{emoji}</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: "10px", color: "var(--faint, #4b6280)", marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* Left — Contractor list */}
        <div>
          {/* Sort controls */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            {(["score", "tier", "ratings"] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
                border: `1px solid ${sortBy === s ? "#3b82f6" : "var(--border, #1f2d3d)"}`,
                background: sortBy === s ? "rgba(59,130,246,.12)" : "transparent",
                color: sortBy === s ? "#93c5fd" : "var(--muted, #94a3b8)",
                cursor: "pointer", fontWeight: sortBy === s ? 700 : 400,
              }}>
                {s === "score" ? "Score" : s === "tier" ? "Tier" : "# Ratings"}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: "var(--muted, #94a3b8)", padding: "32px 0", textAlign: "center" }}>Cargando…</p>
          ) : error ? (
            <p style={{ color: "#ef4444", padding: "16px 0" }}>{error}</p>
          ) : sorted.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px",
              background: "var(--surface, #0c1017)",
              border: "1px solid var(--border, #1f2d3d)", borderRadius: "12px",
            }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>👷</div>
              <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)" }}>
                No hay contratistas con datos de reputación todavía.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "10px", color: "var(--faint, #4b6280)", marginBottom: "8px" }}>
                {sorted.length} contratista{sorted.length !== 1 ? "s" : ""}
              </p>
              {sorted.map((rep) => (
                <ReputationCard
                  key={rep.userId}
                  rep={rep}
                  selected={selected === rep.userId}
                  onClick={() => setSelected(selected === rep.userId ? null : rep.userId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — Detail panel */}
        <div>
          {!selected ? (
            <div style={{
              background: "var(--surface, #0c1017)",
              border: "1px solid var(--border, #1f2d3d)",
              borderRadius: "12px", padding: "32px",
              textAlign: "center", color: "var(--faint, #4b6280)", fontSize: "13px",
            }}>
              Selecciona un contratista para ver el detalle de su reputación y ratings individuales.
            </div>
          ) : selectedRep ? (
            <div>
              {/* Score header */}
              <div style={{
                background: "var(--surface, #0c1017)",
                border: `1px solid ${TIER_COLOR[selectedRep.tier] ?? "#94a3b8"}30`,
                borderLeft: `3px solid ${TIER_COLOR[selectedRep.tier] ?? "#94a3b8"}`,
                borderRadius: "12px", padding: "16px 18px", marginBottom: "12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "4px" }}>
                      {selectedRep.user?.email ?? selectedRep.userId}
                    </div>
                    <span style={{
                      fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                      color: TIER_COLOR[selectedRep.tier], background: TIER_BG[selectedRep.tier],
                      border: `1px solid ${TIER_COLOR[selectedRep.tier]}30`,
                      borderRadius: "5px", padding: "2px 8px",
                    }}>
                      {TIER_LABEL[selectedRep.tier]}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "36px", fontWeight: 900, color: TIER_COLOR[selectedRep.tier], lineHeight: 1 }}>
                      {selectedRep.score.toFixed(1)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>/ 100</div>
                  </div>
                </div>

                {/* Signal breakdown */}
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {[
                    { label: "Rating decaído", value: selectedRep.signals.decayedRating, color: "#eab308", weight: "×0.4" },
                    { label: "Completión", value: selectedRep.signals.completionRate, color: "#22c55e", weight: "×0.3" },
                    { label: "Sin disputas", value: selectedRep.signals.disputeResilienceRate, color: "#3b82f6", weight: "×0.2" },
                    { label: "Verificación", value: selectedRep.signals.verificationSignal, color: "#a78bfa", weight: "×0.1" },
                  ].map(({ label, value, color, weight }) => (
                    <div key={label} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", width: "90px", flexShrink: 0 }}>{label}</span>
                      {scoreBar(value, color)}
                      <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)", width: "30px", textAlign: "right" }}>
                        {Math.round(value * 100)}%
                      </span>
                      <span style={{ fontSize: "9px", color: "var(--faint, #4b6280)", width: "24px", textAlign: "right" }}>
                        {weight}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "16px", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border, #1f2d3d)" }}>
                  {[
                    { label: "Jobs", value: selectedRep.signals.totalJobsAsProf },
                    { label: "Completados", value: selectedRep.signals.completedJobs },
                    { label: "Disputas", value: selectedRep.signals.disputesAgainst },
                    { label: "Ratings", value: selectedRep.signals.totalRatings },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink, #f1f5f9)" }}>{value}</div>
                      <div style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: "10px", color: "var(--faint, #4b6280)", marginTop: "8px" }}>
                  {selectedRep.algorithmVersion} · half-life {selectedRep.decayHalfLifeDays}d · {new Date(selectedRep.computedAt).toLocaleString()}
                </div>
              </div>

              {/* Individual ratings */}
              <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--faint, #4b6280)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                Ratings individuales ({selectedRatings.length})
              </p>
              {selectedRatings.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--faint, #4b6280)" }}>
                  Sin ratings individuales en este tenant.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedRatings.map((r) => (
                    <div key={r.id} style={{
                      background: "var(--surface, #0c1017)",
                      border: "1px solid var(--border, #1f2d3d)",
                      borderRadius: "10px", padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        {starRow(r.score)}
                        <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{timeAgo(r.createdAt)}</span>
                      </div>
                      {r.comment && (
                        <p style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", margin: "4px 0", lineHeight: 1.5 }}>
                          &quot;{r.comment}&quot;
                        </p>
                      )}
                      <div style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>
                        {r.fromUser.email} · {r.job.title}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
