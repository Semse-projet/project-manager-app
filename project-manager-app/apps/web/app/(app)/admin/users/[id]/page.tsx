"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ChevronLeft, Clock, ExternalLink, Fingerprint, Globe, RefreshCw, Shield, User,
} from "lucide-react";
import { TrustPassportCard } from "../../../../../components/semse/TrustPassportCard";
import { GovernanceTierBadge, type GovernanceTier } from "../../../../../components/semse/GovernanceTierBadge";

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

      {/* Back link */}
      <Link href="/admin/users"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", textDecoration: "none", marginBottom: 20, fontWeight: 600 }}>
        <ChevronLeft size={14} />
        Volver a Usuarios
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <User size={22} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Perfil Ciudadano</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>
            {userId}
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(99,102,241,.12)", border: "none", cursor: loading ? "wait" : "pointer", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Actualizar
        </button>
      </div>

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
