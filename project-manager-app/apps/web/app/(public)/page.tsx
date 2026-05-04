import Link from "next/link";
import { fetchPublicLandingOverviewServer } from "../../lib/public-landing";
import { LandingIntake } from "../../components/landing/landing-intake";

const FEATURES = [
  {
    icon: "🔒",
    title: "Pagos en Escrow",
    desc: "Tus fondos quedan protegidos hasta aprobar cada entrega. Menos riesgo y menos fricción.",
    color: "#3b82f6",
  },
  {
    icon: "◈",
    title: "Prometeo + Agentes",
    desc: "Presupuesto, riesgo, finanzas y seguimiento operativo con contexto real del proyecto.",
    color: "#8b5cf6",
  },
  {
    icon: "📋",
    title: "Operación en Campo",
    desc: "Evidencia, hitos, avances y control diario conectados al mismo sistema.",
    color: "#10b981",
  },
  {
    icon: "⚖",
    title: "Disputas y Cumplimiento",
    desc: "Workflows asistidos para contratos, desacuerdos y decisiones con trazabilidad.",
    color: "#f59e0b",
  },
  {
    icon: "📊",
    title: "Finanzas Vivas",
    desc: "Facturas, gastos, margen y señales operativas sin salir del flujo del proyecto.",
    color: "#06b6d4",
  },
  {
    icon: "🔍",
    title: "Confianza Verificada",
    desc: "Trust score, historial real y credenciales compartibles para elegir mejor.",
    color: "#ef4444",
  },
];

const ROLES = [
  {
    id: "client",
    icon: "🏢",
    label: "Soy Cliente",
    desc: "Publicar trabajos, comparar profesionales y controlar el proyecto de punta a punta.",
    href: "/client/jobs/new",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  {
    id: "worker",
    icon: "🔨",
    label: "Soy Profesional",
    desc: "Conseguir trabajos, registrar avances y fortalecer tu reputación verificable.",
    href: "/login?from=/worker/dashboard",
    color: "#10b981",
    bg: "#f0fdf4",
  },
  {
    id: "admin",
    icon: "⚙️",
    label: "Panel Admin",
    desc: "Monitorear PMO, agentes, riesgo y finanzas del ecosistema completo.",
    href: "/login?from=/admin/dashboard",
    color: "#8b5cf6",
    bg: "#faf5ff",
  },
];

function formatRating(value: number) {
  return value > 0 ? `${value.toFixed(1)}/5` : "—";
}

function compactScope(value: string) {
  return value.length > 132 ? `${value.slice(0, 129)}...` : value;
}

function jobStatusLabel(status: string) {
  const map: Record<string, string> = {
    POSTED: "Publicado",
    PUBLISHED: "Publicado",
    IN_PROGRESS: "En ejecución",
    REVIEW: "En revisión",
    COMPLETED: "Completado",
    AWARDED: "Asignado",
  };
  return map[status] ?? status;
}

export default async function LandingPage() {
  const overview = await fetchPublicLandingOverviewServer();
  const stats = [
    { value: overview.stats.activeJobs.toLocaleString("es-MX"), label: "Trabajos activos" },
    { value: overview.stats.verifiedProfessionals.toLocaleString("es-MX"), label: "Profesionales verificados" },
    { value: overview.stats.completedProjects.toLocaleString("es-MX"), label: "Proyectos archivados" },
    { value: formatRating(overview.stats.averageRating), label: "Calificación promedio" },
  ];

  return (
    <main>
      <section style={{ padding: "80px 24px 72px", textAlign: "center", maxWidth: 880, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 14px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            color: "#2563eb",
            marginBottom: 28,
          }}
        >
          Operación real + IA conectada
        </div>
        <h1
          style={{
            fontSize: "clamp(2.6rem, 7vw, 3.25rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            margin: "0 0 20px",
            color: "#0f172a",
          }}
        >
          Publica, ejecuta y cobra
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            en el mismo sistema
          </span>
        </h1>
        <p
          style={{
            fontSize: 19,
            color: "#64748b",
            lineHeight: 1.6,
            margin: "0 0 40px",
            maxWidth: 680,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          SEMSE combina marketplace, escrow, finanzas y copiloto operativo para que un trabajo no se rompa cuando pasa de la venta a la ejecución.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/client/jobs/new"
            style={{
              padding: "14px 32px",
              borderRadius: 10,
              background: "#3b82f6",
              textDecoration: "none",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(59,130,246,.35)",
            }}
          >
            Publicar mi trabajo
          </Link>
          <Link
            href="/login?from=/worker/dashboard"
            style={{
              padding: "14px 32px",
              borderRadius: 10,
              background: "#fff",
              textDecoration: "none",
              color: "#374151",
              fontSize: 16,
              fontWeight: 600,
              border: "1px solid #e2e8f0",
            }}
          >
            Soy profesional
          </Link>
        </div>
      </section>

      <LandingIntake />

      <section
        style={{
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
          padding: "28px 24px",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "72px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 12, color: "#0f172a" }}>
          Entra por tu rol, no por un sistema roto
        </h2>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 44, fontSize: 16 }}>
          Cliente, profesional y operación comparten el mismo contexto en vez de vivir en herramientas separadas.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {ROLES.map((role) => (
            <Link
              key={role.id}
              href={role.href}
              style={{
              display: "block",
              padding: "32px 28px",
                borderRadius: 16,
                background: role.bg,
                border: `1px solid ${role.color}20`,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,.06)",
              }}
            >
              <div style={{ fontSize: 38, marginBottom: 14 }}>{role.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{role.label}</div>
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5, marginBottom: 20 }}>{role.desc}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: role.color }}>Entrar →</div>
            </Link>
          ))}
        </div>
      </section>

      {overview.testimonials.length > 0 && (
        <section
          style={{
            background: "#fff",
            padding: "72px 24px",
            borderTop: "1px solid #e2e8f0",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 12, color: "#0f172a" }}>
              Reseñas reales del sistema
            </h2>
            <p style={{ textAlign: "center", color: "#64748b", marginBottom: 44, fontSize: 16 }}>
              No es copy de marketing. Son valoraciones guardadas en la plataforma sobre trabajos completados.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
              {overview.testimonials.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: "22px 20px",
                    borderRadius: 16,
                    border: "1px solid #e2e8f0",
                    background: "#fafcff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.jobTitle}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#d97706" }}>{item.score}/5</div>
                  </div>
                  <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
                    “{item.comment}”
                  </p>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {item.authorName} evaluó a {item.targetName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {overview.featuredJobs.length > 0 && (
        <section style={{ padding: "72px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 12, color: "#0f172a" }}>
            Trabajo real moviéndose en la plataforma
          </h2>
          <p style={{ textAlign: "center", color: "#64748b", marginBottom: 44, fontSize: 16 }}>
            Actividad viva del sistema para que la entrada pública no se sienta vacía ni ficticia.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
            {overview.featuredJobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                style={{
                  display: "grid",
                  gap: 10,
                  padding: "22px 20px",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{job.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {job.category ?? "General"}{job.location ? ` · ${job.location}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#2563eb", background: "rgba(37,99,235,.1)", padding: "4px 8px", borderRadius: 999 }}>
                    {jobStatusLabel(job.status)}
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{compactScope(job.scope)}</p>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#475569" }}>
                  <span>
                    {job.budgetMin !== null
                      ? `$${job.budgetMin.toLocaleString("es-MX")}${job.budgetMax !== null ? ` - $${job.budgetMax.toLocaleString("es-MX")}` : ""}`
                      : "Presupuesto por definir"}
                  </span>
                  <span>{job.urgency ?? "standard"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section
        style={{
          background: "#fff",
          padding: "72px 24px",
          borderTop: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 12, color: "#0f172a" }}>
            Profesionales verificados del ecosistema
          </h2>
          <p style={{ textAlign: "center", color: "#64748b", marginBottom: 44, fontSize: 16 }}>
            Ranking alimentado por credenciales reales, trust score e historial operativo.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            {overview.topProfessionals.map((pro) => (
              <Link
                key={pro.id}
                href={pro.publicSlug ? `/pro/${pro.publicSlug}` : "/login"}
                style={{
                  display: "grid",
                  gap: 12,
                  padding: "22px 20px",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  background: "#fafcff",
                  textDecoration: "none",
                  color: "#0f172a",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{pro.displayName}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                      {pro.verifiedAt ? "Verificado" : "Perfil activo"} · {pro.completedProjects} proyectos
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(16,185,129,.12)",
                      color: "#059669",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {pro.trustScore} trust
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {pro.specialties.slice(0, 3).map((specialty) => (
                    <span
                      key={specialty}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#475569",
                        background: "#e2e8f0",
                        borderRadius: 999,
                        padding: "4px 8px",
                      }}
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
                  <span>Rating: {formatRating(pro.avgClientRating)}</span>
                  <span>Ver perfil →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#fff",
          padding: "72px 24px",
          borderTop: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 12, color: "#0f172a" }}>
            No es solo un marketplace
          </h2>
          <p style={{ textAlign: "center", color: "#64748b", marginBottom: 52, fontSize: 16 }}>
            Es la capa operativa que conecta contratación, ejecución, evidencia, finanzas y decisión asistida.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                style={{
                  padding: "28px 24px",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    marginBottom: 16,
                    background: `${feature.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                  }}
                >
                  {feature.icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 8 }}>{feature.title}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 24px", maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 14px",
            background: "#faf5ff",
            border: "1px solid #e9d5ff",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            color: "#7c3aed",
            marginBottom: 24,
          }}
        >
          Copiloto operativo visible
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: 16 }}>
          Prometeo aparece donde la operación se complica
        </h2>
        <p style={{ fontSize: 17, color: "#64748b", lineHeight: 1.7, marginBottom: 40 }}>
          Presupuesto, riesgo, facturas, PMO y contexto de proyecto ya viven en el sistema. La landing ahora empieza a reflejar ese motor real en lugar de vender humo estático.
        </p>
        <Link
          href="/agents"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 28px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            textDecoration: "none",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            boxShadow: "0 4px 14px rgba(99,102,241,.35)",
          }}
        >
          Ver agentes →
        </Link>
      </section>

      <section
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          padding: "80px 24px",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>
          Entra al flujo correcto desde el primer clic
        </h2>
        <p style={{ fontSize: 18, color: "#94a3b8", marginBottom: 40, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          Ya no te mandamos a un dashboard genérico. Si vienes a publicar, vuelves al wizard. Si vienes a operar, aterrizas en tu panel.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/login?from=/client/jobs/new"
            style={{
              padding: "15px 36px",
              borderRadius: 10,
              background: "#3b82f6",
              textDecoration: "none",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: "0 4px 20px rgba(59,130,246,.4)",
            }}
          >
            Publicar trabajo
          </Link>
          <Link
            href="/login?from=/worker/dashboard"
            style={{
              padding: "15px 36px",
              borderRadius: 10,
              background: "rgba(255,255,255,.08)",
              textDecoration: "none",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,.15)",
            }}
          >
            Entrar como profesional
          </Link>
        </div>
      </section>
    </main>
  );
}
