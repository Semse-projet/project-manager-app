"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Clock, ExternalLink, Fingerprint, Globe, Image, RefreshCw, Shield, User,
} from "lucide-react";
import { AdminPageHeader } from "../../../../../components/admin/AdminPageHeader";
import { TrustPassportCard } from "../../../../../components/semse/TrustPassportCard";
import { GovernanceTierBadge, type GovernanceTier } from "../../../../../components/semse/GovernanceTierBadge";
import { analyzePortfolio } from "../../../../semse-api";

// ── Types ──────────────────────────────────────────────────────────────────────

type DidDoc = {
  "@context": string[];
  id: string;
  verificationMethod: { id: string; type: string; controller: string; publicKeyMultibase: string }[];
  authentication: string[];
  created: string;
};

type CreditsData = {
  totalCredits: number;
  tier: GovernanceTier;
  events: { event: string; credits: number; createdAt: string }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = process.env.NEXT_PUBLIC_SEMSE_TENANT_ID ?? "default";

type PortfolioResult = {
  quality: string; originality: number; aiDetected: boolean;
  blurScore: number; lightnessScore: number; insight?: string | null;
};

function PortfolioAnalyzerWidget() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!url.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await analyzePortfolio(url.trim(), undefined, true);
      setResult(data as unknown as PortfolioResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar");
    } finally {
      setLoading(false);
    }
  }

  const qualityColor = result?.quality === "high" ? "#86efac" : result?.quality === "medium" ? "#fbbf24" : "#f87171";

  return (
    <div style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Image size={14} color="#a78bfa" />
        <span style={{ fontSize: 13, fontWeight: 800 }}>Análisis de Portafolio</span>
        <span style={{ fontSize: 9, color: "var(--muted)", background: "rgba(167,139,250,.1)", padding: "1px 8px", borderRadius: 99, marginLeft: "auto" }}>Vision AI</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "var(--ink)", fontSize: 12 }}
          placeholder="URL de foto de portafolio..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
        />
        <button
          onClick={() => void run()}
          disabled={loading || !url.trim()}
          style={{ padding: "6px 14px", borderRadius: 8, background: "#a78bfa", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "..." : "Analizar"}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: "#fca5a5" }}>{error}</div>}
      {result && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: qualityColor, background: `${qualityColor}15`, padding: "2px 10px", borderRadius: 99, border: `1px solid ${qualityColor}40` }}>
              Calidad: {result.quality}
            </span>
            <span style={{ fontSize: 11, color: result.aiDetected ? "#f87171" : "#86efac", background: result.aiDetected ? "rgba(248,113,113,.1)" : "rgba(134,239,172,.1)", padding: "2px 10px", borderRadius: 99, border: `1px solid ${result.aiDetected ? "rgba(248,113,113,.3)" : "rgba(134,239,172,.3)"}` }}>
              {result.aiDetected ? "⚠ IA Detectada" : "✓ Humano"}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)", background: "rgba(255,255,255,.04)", padding: "2px 10px", borderRadius: 99, border: "1px solid var(--border)" }}>
              Originalidad: {Math.round(result.originality * 100)}%
            </span>
          </div>
          {result.insight && (
            <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", borderLeft: "2px solid #a78bfa40", paddingLeft: 8 }}>
              {result.insight}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: "14px 16px", background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? "var(--ink)" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CitizenProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? "";

  const [didDoc,  setDidDoc]  = useState<DidDoc | null>(null);
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true); setError(null);
    try {
      const [didRes, credRes] = await Promise.all([
        fetch(`/api/semse/did/${encodeURIComponent(userId)}`),
        fetch(`/api/semse/governance/credits/${encodeURIComponent(userId)}?tenantId=${encodeURIComponent(TENANT_ID)}`),
      ]);
      if (didRes.ok) {
        const j = await didRes.json() as { data: DidDoc };
        setDidDoc(j.data ?? null);
      }
      if (credRes.ok) {
        const j = await credRes.json() as { data: CreditsData };
        setCredits(j.data ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [userId]);

  const shortId = userId.slice(0, 8);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>

      <AdminPageHeader
        title="Perfil Ciudadano"
        subtitle={
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>
            {userId}
          </span>
        }
        icon={User}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,.15)"
        backHref="/admin/users"
        backLabel="Volver a Usuarios"
        actions={
          <button onClick={() => void load()} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(99,102,241,.12)", border: "none", cursor: loading ? "wait" : "pointer", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Actualizar
          </button>
        }
      />

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, fontSize: 12, color: "#fca5a5", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* DID + tier quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <StatCard
          label="IDENTIFICADOR"
          value={`did:semse:${shortId}…`}
          sub={didDoc ? "DID activo" : "sin DID"}
          color="#818cf8"
        />
        <StatCard
          label="CRÉDITOS TOTALES"
          value={credits ? credits.totalCredits.toFixed(1) : "—"}
          sub="governance credits (decay 90d)"
          color="#67e8f9"
        />
        <div style={{ padding: "14px 16px", background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em" }}>TIER GOBERNANZA</div>
          {credits
            ? <GovernanceTierBadge tier={credits.tier} credits={credits.totalCredits} size="lg" />
            : <span style={{ fontSize: 13, color: "var(--muted)" }}>—</span>
          }
        </div>
      </div>

      {/* Two-column layout: DID doc + passport card */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* DID document */}
        <div style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Globe size={14} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 800 }}>Identidad Soberana</span>
            <span style={{ fontSize: 9, color: "var(--muted)", background: "rgba(99,102,241,.1)", padding: "1px 8px", borderRadius: 99, marginLeft: "auto" }}>W3C DID Core</span>
          </div>

          {!didDoc && !loading && (
            <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: 20 }}>
              DID no disponible para este usuario
            </div>
          )}

          {didDoc && (
            <div style={{ display: "grid", gap: 0 }}>
              <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 3 }}>DID</div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "#818cf8", wordBreak: "break-all" }}>{didDoc.id}</div>
              </div>
              {didDoc.verificationMethod?.[0] && (
                <>
                  <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 3 }}>TIPO CLAVE</div>
                    <div style={{ fontSize: 11, color: "var(--ink)" }}>{didDoc.verificationMethod[0].type}</div>
                  </div>
                  <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 3 }}>CLAVE PÚBLICA (primeros 32)</div>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: "#67e8f9", wordBreak: "break-all" }}>
                      {didDoc.verificationMethod[0].publicKeyMultibase?.slice(0, 32)}…
                    </div>
                  </div>
                </>
              )}
              <div style={{ padding: "8px 0" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 3 }}>CREADO</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Clock size={10} color="var(--muted)" />
                  <span style={{ fontSize: 11, color: "var(--ink)" }}>{new Date(didDoc.created).toLocaleString("es-MX")}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Portfolio Analyzer */}
        <PortfolioAnalyzerWidget />

        {/* Trust Passport Card */}
        <div style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Shield size={14} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 800 }}>Trust Passport</span>
            <span style={{ fontSize: 9, color: "var(--muted)", background: "rgba(99,102,241,.1)", padding: "1px 8px", borderRadius: 99, marginLeft: "auto" }}>HMAC-SHA256</span>
          </div>
          <TrustPassportCard userId={userId} tenantId={TENANT_ID} />
        </div>
      </div>

      {/* Credits history */}
      {credits && credits.events.length > 0 && (
        <div style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 14 }}>Historial de Créditos</div>
          <div style={{ display: "grid", gap: 0 }}>
            {credits.events.map((ev, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < credits.events.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--ink)" }}>{ev.event}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    {new Date(ev.createdAt).toLocaleString("es-MX")}
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#818cf8" }}>+{ev.credits}cr</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
