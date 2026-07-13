import type { ProfessionalCredentialRecord } from "../../semse-api";

const BADGE_META: Record<string, { label: string; color: string; emoji: string }> = {
  top_rated:      { label: "Top Rated",      color: "#fbbf24", emoji: "⭐" },
  zero_disputes:  { label: "Cero Disputas",  color: "#10b981", emoji: "🛡" },
  fast_deliverer: { label: "Entrega Puntual", color: "#818cf8", emoji: "⚡" },
  high_volume:    { label: "Alto Volumen",    color: "#06b6d4", emoji: "📊" },
  verified:       { label: "Verificado",      color: "#34d399", emoji: "✓" },
  elite:          { label: "Elite",           color: "#f59e0b", emoji: "👑" },
};

function TrustMeter({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#fbbf24" : score >= 40 ? "#fb923c" : "#f87171";
  const label = score >= 80 ? "Excelente" : score >= 60 ? "Bueno" : score >= 40 ? "Regular" : "Bajo";
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Trust Score</span>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>
          {score}/100 · {label}
        </span>
      </div>
      <div style={{ height: 8, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${score}%`, background: color,
          borderRadius: 99, transition: "width 1s ease",
          boxShadow: `0 0 12px ${color}66`,
        }} />
      </div>
    </div>
  );
}

async function fetchPublicProfile(slug: string): Promise<ProfessionalCredentialRecord | null> {
  const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
  try {
    const res = await fetch(
      `${apiBase}/v1/intelligence/credentials/public/${encodeURIComponent(slug)}`,
      {
        headers: { "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default" },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ProfessionalCredentialRecord };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await fetchPublicProfile(slug);
  if (!profile) return { title: "Perfil no encontrado · SEMSE" };
  return {
    title: `${profile.displayName} · Profesional verificado · SEMSE`,
    description: `Perfil público de ${profile.displayName}: ${profile.completedProjects} proyectos completados, trust score ${profile.trustScore}/100.`,
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = slug ? await fetchPublicProfile(slug) : null;

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", background: "#020408", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 32 }}>🔍</div>
        <h2 style={{ color: "white", margin: 0, fontSize: 20, fontWeight: 800 }}>Perfil no encontrado</h2>
        <p style={{ color: "#475569", fontSize: 14 }}>Este profesional no tiene un perfil público disponible.</p>
      </div>
    );
  }

  const onTimePct = Math.round(profile.onTimeRate * 100);
  const disputePct = Math.round(profile.disputeRate * 100);

  return (
    <div style={{ minHeight: "100vh", background: "#010204", color: "#cbd5e1", fontFamily: "'Inter', sans-serif" }}>
      {/* Header band */}
      <div style={{
        background: "linear-gradient(135deg, #0d1220 0%, #1e1b4b 100%)",
        borderBottom: "1px solid #1e293b", padding: "48px 24px 40px",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {/* Avatar + Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 900, color: "white",
              boxShadow: "0 8px 32px rgba(99,102,241,.4)",
            }}>
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "white", letterSpacing: -0.5 }}>
                {profile.displayName}
              </h1>
              {profile.verifiedAt && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "4px 12px", background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.25)", borderRadius: 99 }}>
                  <span style={{ color: "#34d399", fontSize: 12 }}>✓</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Profesional verificado por SEMSE
                  </span>
                </div>
              )}
            </div>
          </div>

          <TrustMeter score={profile.trustScore} />

          {/* Badges */}
          {profile.badges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {profile.badges.map(b => {
                const meta = BADGE_META[b] ?? { label: b, color: "#818cf8", emoji: "•" };
                return (
                  <span key={b} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                    background: `${meta.color}15`, border: `1px solid ${meta.color}30`, color: meta.color,
                  }}>
                    {meta.emoji} {meta.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Proyectos completados", value: String(profile.completedProjects), color: "#818cf8" },
            { label: "Proyectos activos", value: String(profile.activeProjects), color: "#22d3ee" },
            { label: "Total gestionado", value: `$${Math.round(profile.totalManaged).toLocaleString()}`, color: "#10b981" },
            { label: "Entrega a tiempo", value: `${onTimePct}%`, color: onTimePct >= 80 ? "#10b981" : "#fbbf24" },
            { label: "Tasa de disputas", value: `${disputePct}%`, color: disputePct === 0 ? "#10b981" : disputePct < 10 ? "#fbbf24" : "#f87171" },
            { label: "Rating promedio", value: profile.avgClientRating > 0 ? `${profile.avgClientRating.toFixed(1)} ★` : "—", color: "#fbbf24" },
          ].map(s => (
            <div key={s.label} style={{
              background: "#05080f", border: "1px solid #0f172a", borderRadius: 16, padding: 18,
            }}>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Specialties */}
        {profile.specialties.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Especialidades
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {profile.specialties.map(s => (
                <span key={s} style={{
                  padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                  background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.2)", color: "#a5b4fc",
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 40, paddingTop: 24, borderTop: "1px solid #0f172a",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <p style={{ fontSize: 12, color: "#334155", margin: 0 }}>
              Perfil verificado por{" "}
              <span style={{ color: "#6366f1", fontWeight: 700 }}>SEMSE OS</span>
            </p>
            {profile.lastActivityAt && (
              <p style={{ fontSize: 11, color: "#1e3a5f", margin: "4px 0 0" }}>
                Última actividad: {new Date(profile.lastActivityAt).toLocaleDateString("es-US", { month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.15em",
          }}>
            semse.io/pro/{profile.publicSlug}
          </div>
        </div>
      </div>
    </div>
  );
}
