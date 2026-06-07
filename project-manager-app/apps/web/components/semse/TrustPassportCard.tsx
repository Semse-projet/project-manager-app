"use client";

import { useEffect, useState } from "react";
import { Clock, Fingerprint, Key, Shield, ShieldCheck } from "lucide-react";
import { GovernanceTierBadge, type GovernanceTier } from "./GovernanceTierBadge";

// ── Types ──────────────────────────────────────────────────────────────────────

type PassportClaims = {
  sub: string;
  tenantId: string;
  reputationScore: number;
  trustLevel: "low" | "medium" | "high" | "critical";
  iat: number;
  exp: number;
  cryptoProfile?: "HMAC-SHA256" | "Dilithium3" | "ML-DSA-65";
};

type PassportData = {
  did: string;
  encodedPayload: string;
  signature: string;
  claims: PassportClaims;
  issuedAt: string;
  expiresAt: string;
};

type CreditsData = {
  totalCredits: number;
  tier: GovernanceTier;
  events: { event: string; credits: number; createdAt: string }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRUST_COLORS: Record<string, string> = {
  low: "#86efac", medium: "#fcd34d", high: "#fb923c", critical: "#fca5a5",
};

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: mono ? 10 : 12, fontFamily: mono ? "monospace" : "inherit", color: "var(--ink)", wordBreak: "break-all", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TrustPassportCard({ userId, tenantId }: { userId: string; tenantId: string }) {
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [credits,  setCredits]  = useState<CreditsData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetch(`/api/semse/trust/${encodeURIComponent(userId)}/passport`).then((r) => r.json()),
      fetch(`/api/semse/governance/credits/${encodeURIComponent(userId)}?tenantId=${encodeURIComponent(tenantId)}`).then((r) => r.json()),
    ])
      .then(([passRes, credRes]) => {
        if (cancelled) return;
        if (passRes?.data) setPassport(passRes.data as PassportData);
        if (credRes?.data) setCredits(credRes.data as CreditsData);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar pasaporte");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [userId, tenantId]);

  if (loading) {
    return (
      <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
        Cargando pasaporte…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 11, color: "#fca5a5" }}>
        {error}
      </div>
    );
  }

  if (!passport) return null;

  const { claims } = passport;
  const crypto = claims.cryptoProfile ?? "HMAC-SHA256";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Header row: DID + tier badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 12 }}>
        <ShieldCheck size={18} color="#818cf8" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 2 }}>IDENTIDAD SOBERANA</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#818cf8", wordBreak: "break-all" }}>{passport.did}</div>
        </div>
        {credits && (
          <GovernanceTierBadge tier={credits.tier} credits={credits.totalCredits} size="sm" />
        )}
      </div>

      {/* Claims grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* Trust level */}
        <div style={{ padding: "12px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Shield size={11} color="#818cf8" />
            <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)" }}>TRUST LEVEL</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: TRUST_COLORS[claims.trustLevel] ?? "#94a3b8" }}>
            {claims.trustLevel.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>score {claims.reputationScore}/100</div>
        </div>

        {/* Crypto profile */}
        <div style={{ padding: "12px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Key size={11} color="#818cf8" />
            <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)" }}>CRYPTO</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: crypto === "HMAC-SHA256" ? "#818cf8" : "#86efac", fontFamily: "monospace" }}>
            {crypto}
          </div>
          {crypto !== "HMAC-SHA256" && (
            <div style={{ fontSize: 9, color: "#86efac", marginTop: 3 }}>Post-quantum ready</div>
          )}
        </div>
      </div>

      {/* Validity */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,.02)", borderRadius: 8, border: "1px solid var(--border)" }}>
        <Clock size={11} color="var(--muted)" />
        <span style={{ fontSize: 10, color: "var(--muted)" }}>
          Emitido: <strong style={{ color: "var(--ink)" }}>{new Date(passport.issuedAt).toLocaleString("es-MX")}</strong>
        </span>
        <span style={{ margin: "0 4px", color: "var(--muted)" }}>·</span>
        <span style={{ fontSize: 10, color: "var(--muted)" }}>
          Expira: <strong style={{ color: "var(--ink)" }}>{new Date(passport.expiresAt).toLocaleString("es-MX")}</strong>
        </span>
      </div>

      {/* Signature fingerprint */}
      <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 8, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Fingerprint size={11} color="var(--muted)" />
          <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)" }}>FIRMA (primeros 48 chars)</span>
        </div>
        <span style={{ fontSize: 9, fontFamily: "monospace", color: "#818cf8", wordBreak: "break-all" }}>
          {passport.signature.slice(0, 48)}…
        </span>
      </div>

      {/* Credits history (up to 3) */}
      {credits && credits.events.length > 0 && (
        <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", marginBottom: 8 }}>CRÉDITOS RECIENTES</div>
          {credits.events.slice(0, 3).map((ev, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{ev.event}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#818cf8" }}>+{ev.credits}cr</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
