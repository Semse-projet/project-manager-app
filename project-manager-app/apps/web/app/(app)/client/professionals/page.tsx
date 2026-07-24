"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CheckCircle, ExternalLink, Search, Shield, Star, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HtmlInCanvasPanel } from "@semse/ui";
import type { JobRecordView } from "@semse/schemas";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { CLIENT_ROUTES } from "../../../lib/client-routes";
import { fetchAgentMemories, type AgentMemoryEntry, type ProfessionalCredentialRecord } from "../../../semse-api";

type MatchBreakdown = {
  textSimilarity: number;
  trustSignal: number;
  verificationSignal: number;
  ratingSignal: number;
};

type Candidate = {
  userId: string;
  email: string;
  score: number;
  baseScore?: number;
  percentileRank: number;
  breakdown: MatchBreakdown;
  verificationStatus: string;
  trustScore: number;
  avgRating: number;
  totalRatings: number;
  completedJobs: number;
  isPreferredTarget?: boolean;
  preferenceBoost?: number;
};

type MatchResult = {
  jobId: string;
  jobTitle: string;
  candidatesEvaluated: number;
  candidates: Candidate[];
  preferredTarget?: {
    userId: string;
    displayName: string;
    publicSlug?: string | null;
    source: "job_memory";
  } | null;
  preferredCandidateStatus?: {
    state: "boosted" | "in_results" | "out_of_range" | "insufficient_signal" | "not_available";
    reason: string;
    rank?: number;
    score?: number;
    boostedBy?: number;
  } | null;
  algorithmVersion: string;
  computedAt: string;
};

type PreferredTarget = {
  userId: string;
  name: string;
  slug: string | null;
  source: "query" | "memory" | "backend";
};

function parsePreferredTargetMemory(entry: AgentMemoryEntry): PreferredTarget | null {
  if (!entry.tags.includes("preferred-professional") || !entry.body) {
    return null;
  }

  try {
    const body = JSON.parse(entry.body) as {
      userId?: unknown;
      displayName?: unknown;
      publicSlug?: unknown;
    };
    if (typeof body.userId !== "string" || typeof body.displayName !== "string") {
      return null;
    }

    return {
      userId: body.userId,
      name: body.displayName,
      slug: typeof body.publicSlug === "string" ? body.publicSlug : null,
      source: "memory",
    };
  } catch {
    return null;
  }
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)" }}>
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: `${value * 100}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function CandidateCard({ candidate, preferred }: { candidate: Candidate; preferred?: boolean }) {
  const scorePercent = Math.round(candidate.score * 100);
  const scoreColor = scorePercent >= 70 ? "#10b981" : scorePercent >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{
      padding: "16px 18px", borderRadius: 14, border: "1px solid var(--border)",
      background: preferred ? "rgba(99,102,241,.08)" : "var(--surface)", display: "grid", gap: 12,
      boxShadow: preferred ? "0 8px 24px rgba(99,102,241,.12)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center",
            fontSize: 16, fontWeight: 800, color: "#818cf8",
          }}>
            {candidate.email.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{candidate.email}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              {preferred && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#818cf8", fontWeight: 700 }}>
                  <Shield size={11} /> Objetivo
                </span>
              )}
              {candidate.preferenceBoost ? (
                <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>
                  +{Math.round(candidate.preferenceBoost * 100)} pref
                </span>
              ) : null}
              {candidate.verificationStatus === "verified" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#10b981" }}>
                  <CheckCircle size={11} /> Verificado
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{candidate.verificationStatus}</span>
              )}
              {candidate.avgRating > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#f59e0b" }}>
                  <Star size={10} fill="#f59e0b" />
                  {candidate.avgRating.toFixed(1)} ({candidate.totalRatings})
                </span>
              )}
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{candidate.completedJobs} trabajos</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor }}>{scorePercent}%</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>match · p{candidate.percentileRank}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <ScoreBar value={candidate.breakdown.textSimilarity}    label="Similitud de trabajo" color="#818cf8" />
        <ScoreBar value={candidate.breakdown.trustSignal}       label="Confianza"             color="#10b981" />
        <ScoreBar value={candidate.breakdown.verificationSignal} label="Verificación"         color="#06b6d4" />
        <ScoreBar value={candidate.breakdown.ratingSignal}      label="Calificaciones"        color="#f59e0b" />
      </div>
    </div>
  );
}

export default function ClientProfessionalsPage() {
  const searchParams = useSearchParams();
  const requestedJobId = searchParams?.get("jobId") ?? "";
  const queryPreferredUserId = searchParams?.get("preferredUserId") ?? "";
  const queryPreferredName = searchParams?.get("preferredName") ?? "";
  const queryPreferredSlug = searchParams?.get("preferredSlug") ?? "";
  const source = searchParams?.get("source") ?? "";
  const [preferredTarget, setPreferredTarget] = useState<PreferredTarget | null>(() =>
    queryPreferredUserId
      ? {
          userId: queryPreferredUserId,
          name: queryPreferredName || "Profesional sugerido",
          slug: queryPreferredSlug || null,
          source: "query",
        }
      : null,
  );
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(requestedJobId);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topPros, setTopPros] = useState<ProfessionalCredentialRecord[]>([]);
  const [autoMatchedJobId, setAutoMatchedJobId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/semse/jobs")
      .then((r) => r.json())
      .then((d: { data?: JobRecordView[] }) => setJobs(d.data ?? []))
      .catch(() => undefined);

    fetch("/api/semse/intelligence/credentials/top")
      .then(r => r.json())
      .then((d: { data?: ProfessionalCredentialRecord[] }) => setTopPros(d.data ?? []))
      .catch(() => undefined);
  }, []);

  const preferredMatchedCandidate = useMemo(
    () => preferredTarget ? (result?.candidates.find((candidate) => candidate.userId === preferredTarget.userId) ?? null) : null,
    [preferredTarget, result],
  );

  const runMatch = useCallback(async (jobIdOverride?: string) => {
    const jobId = jobIdOverride ?? selectedJobId;
    if (!jobId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/semse/matching", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, limit: 20, minScore: 0 }),
      });
      const json = await res.json() as { data?: MatchResult; error?: { message: string } };
      if (!res.ok || json.error) throw new Error(json.error?.message ?? `Error ${res.status}`);
      setResult(json.data ?? null);
      if (json.data?.preferredTarget) {
        setPreferredTarget({
          userId: json.data.preferredTarget.userId,
          name: json.data.preferredTarget.displayName,
          slug: json.data.preferredTarget.publicSlug ?? null,
          source: "backend",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar profesionales.");
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  const activeJobs = jobs.filter((j) =>
    ["posted", "reserved", "accepted"].includes(String(j.status ?? ""))
  );

  useEffect(() => {
    if (!requestedJobId || loading || autoMatchedJobId === requestedJobId || jobs.length === 0) return;
    const exists = jobs.some((job) => job.id === requestedJobId);
    if (!exists) return;
    setSelectedJobId(requestedJobId);
    setAutoMatchedJobId(requestedJobId);
    void runMatch(requestedJobId);
  }, [autoMatchedJobId, jobs, loading, requestedJobId, runMatch]);

  useEffect(() => {
    if (!selectedJobId) {
      setPreferredTarget(queryPreferredUserId ? {
        userId: queryPreferredUserId,
        name: queryPreferredName || "Profesional sugerido",
        slug: queryPreferredSlug || null,
        source: "query",
      } : null);
      return;
    }

    if (queryPreferredUserId && selectedJobId === requestedJobId) {
      setPreferredTarget({
        userId: queryPreferredUserId,
        name: queryPreferredName || "Profesional sugerido",
        slug: queryPreferredSlug || null,
        source: "query",
      });
      return;
    }

    let cancelled = false;
    void fetchAgentMemories({ workspaceId: `job:${selectedJobId}`, kind: "decision", limit: 20 })
      .then((entries) => {
        if (cancelled) return;
        const signal = entries.map(parsePreferredTargetMemory).find(Boolean) ?? null;
        setPreferredTarget(signal);
      })
      .catch(() => {
        if (!cancelled) setPreferredTarget(null);
      });

    return () => {
      cancelled = true;
    };
  }, [queryPreferredName, queryPreferredSlug, queryPreferredUserId, requestedJobId, selectedJobId]);

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <ClientPageHeader
        title="Buscar Profesionales"
        subtitle="Algoritmo de matching por compatibilidad con tu trabajo"
        breadcrumbs={[{ label: "Dashboard", href: CLIENT_ROUTES.dashboard }, { label: "Profesionales" }]}
        minHeight={140}
        leading={
          <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(16,185,129,.15)", display: "grid", placeItems: "center" }}>
            <Users size={20} color="#34d399" />
          </div>
        }
        actions={
          <span style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(16,185,129,.12)", color: "#34d399", fontSize: 12, fontWeight: 700 }}>
            puntaje de compatibilidad
          </span>
        }
      />

      {(preferredTarget || source === "landing") && (
        <HtmlInCanvasPanel
          style={{ border: "1px solid rgba(99,102,241,.2)", borderRadius: 18, background: "rgba(99,102,241,.08)", padding: "16px 18px" }}
          minHeight={80}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Continuidad desde landing
            </div>
            <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6 }}>
              {preferredTarget?.name
                ? <>Publicaste el trabajo con <strong>{preferredTarget.name}</strong> como perfil objetivo. El matching se lanza sobre el job nuevo y te muestra si ese profesional entra por mérito real.</>
                : "Publicaste el trabajo desde la landing y ya corrimos el matching inicial sobre el job nuevo."}
            </div>
            {preferredTarget?.slug && (
              <div>
                <Link href={`/pro/${preferredTarget.slug}`} target="_blank" style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textDecoration: "none" }}>
                  Ver perfil público objetivo →
                </Link>
              </div>
            )}
            {(preferredTarget?.source === "memory" || preferredTarget?.source === "backend") && (
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Objetivo recuperado desde memoria operativa del job.
              </div>
            )}
          </div>
        </HtmlInCanvasPanel>
      )}

      {/* Verified Professionals Ranking */}
      {topPros.length > 0 && (
        <HtmlInCanvasPanel
          style={{ border: "1px solid var(--border)", borderRadius: 18, background: "var(--surface)", padding: "20px 22px" }}
          minHeight={80}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Shield size={16} color="#34d399" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
              Profesionales Verificados SEMSE
            </h3>
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
              Ordenados por confiabilidad
            </span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {topPros.slice(0, 5).map((pro, i) => (
              <div key={pro.userId} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
                borderRadius: 12, background: "var(--bg, rgba(255,255,255,.02))",
                border: pro.userId === preferredTarget?.userId ? "1.5px solid rgba(99,102,241,.35)" : "1px solid var(--border)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `hsl(${i * 55 + 230}, 60%, 35%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: "white",
                }}>
                  {pro.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                    {pro.displayName}
                    {pro.verifiedAt && <span style={{ marginLeft: 8, fontSize: 10, color: "#34d399" }}>✓ verificado</span>}
                    {pro.userId === preferredTarget?.userId && <span style={{ marginLeft: 8, fontSize: 10, color: "#818cf8" }}>objetivo</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {pro.completedProjects} proyectos · {Math.round(pro.onTimeRate * 100)}% puntual
                    {pro.specialties.length > 0 && ` · ${pro.specialties.slice(0, 2).join(", ")}`}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: 16, fontWeight: 900,
                    color: pro.trustScore >= 80 ? "#10b981" : pro.trustScore >= 60 ? "#fbbf24" : "#94a3b8",
                  }}>
                    {pro.trustScore}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>trust</div>
                </div>
                {pro.publicSlug && (
                  <Link href={`/pro/${pro.publicSlug}`} target="_blank" style={{ color: "#818cf8", flexShrink: 0 }}>
                    <ExternalLink size={14} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </HtmlInCanvasPanel>
      )}

      <HtmlInCanvasPanel
        style={{ border: "1px solid var(--border)", borderRadius: 18, background: "var(--surface)", padding: "20px 22px" }}
        minHeight={80}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>
              Selecciona un trabajo para encontrar candidatos
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--bg)",
                color: "var(--ink)", fontSize: 13, outline: "none",
              }}
            >
              <option value="">-- Elegir trabajo --</option>
              {activeJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {String(job.title ?? job.id)} · {String(job.status ?? "")}
                </option>
              ))}
              {jobs.filter((j) => !activeJobs.find((a) => a.id === j.id)).map((job) => (
                <option key={job.id} value={job.id}>
                  {String(job.title ?? job.id)} · {String(job.status ?? "")}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void runMatch()}
            disabled={loading || !selectedJobId}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff",
              fontWeight: 700, fontSize: 13, cursor: loading || !selectedJobId ? "not-allowed" : "pointer",
              opacity: loading || !selectedJobId ? 0.5 : 1,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Search size={15} />
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </HtmlInCanvasPanel>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 12, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: "grid", gap: 12 }}>
          {result.preferredCandidateStatus?.state === "boosted" && preferredTarget && preferredMatchedCandidate && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.18)" }}>
              <Shield size={15} color="#818cf8" />
              <span style={{ fontSize: 13, color: "var(--ink)" }}>
                <strong>{preferredTarget.name || preferredMatchedCandidate.email}</strong> subió posiciones por historial real y preferencia explícita. Match final: <strong>{Math.round(preferredMatchedCandidate.score * 100)}%</strong>.
              </span>
            </div>
          )}

          {result.preferredCandidateStatus?.state === "in_results" && preferredTarget && preferredMatchedCandidate && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.18)" }}>
              <Shield size={15} color="#10b981" />
              <span style={{ fontSize: 13, color: "var(--ink)" }}>
                <strong>{preferredTarget.name || preferredMatchedCandidate.email}</strong> entró por mérito propio. El sistema no necesitó empujarlo.
              </span>
            </div>
          )}

          {preferredTarget && !preferredMatchedCandidate && result.preferredCandidateStatus && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.18)" }}>
              <Shield size={15} color="#f59e0b" />
              <span style={{ fontSize: 13, color: "var(--ink)" }}>
                <strong>{preferredTarget.name || "El perfil objetivo"}</strong> no quedó en resultados finales. {result.preferredCandidateStatus.reason}
              </span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.18)" }}>
            <Zap size={15} color="#10b981" />
            <span style={{ fontSize: 13, color: "var(--ink)" }}>
              <strong>{result.candidates.length}</strong> candidatos rankeados de <strong>{result.candidatesEvaluated}</strong> evaluados para <em>{result.jobTitle}</em>
            </span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)" }}>v{result.algorithmVersion}</span>
          </div>

          {result.candidates.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 14, fontSize: 13 }}>
              No hay candidatos disponibles para este trabajo.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {result.candidates.map((candidate, i) => (
                <div key={candidate.userId} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: i === 0 ? "rgba(251,191,36,.2)" : "var(--faint)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 16 }}>
                    {i === 0 ? <Award size={13} color="#fbbf24" /> : <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <CandidateCard candidate={candidate} preferred={candidate.userId === preferredTarget?.userId} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 14, fontSize: 13 }}>
          Selecciona un trabajo y haz clic en Buscar para ver candidatos rankeados por compatibilidad.
        </div>
      )}
    </div>
  );
}
