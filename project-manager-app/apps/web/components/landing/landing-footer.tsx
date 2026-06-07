import Link from "next/link";

const FOOTER_COLS = [
  {
    title: "Servicios",
    links: [
      { label: "Construcción y Remodelación", href: "#servicios" },
      { label: "Mantenimiento", href: "#servicios" },
      { label: "Servicios Administrativos", href: "#servicios" },
      { label: "Prometeo IA", href: "#prometeo" },
    ],
  },
  {
    title: "Plataforma",
    links: [
      { label: "Cómo funciona", href: "#como-funciona" },
      { label: "Publicar proyecto", href: "/client/jobs/new" },
      { label: "Unirse como profesional", href: "/login?from=/worker/dashboard" },
      { label: "Panel Admin", href: "/login?from=/admin/dashboard" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre SEMSE Project", href: "#" },
      { label: "Profesionales verificados", href: "#profesionales" },
      { label: "Privacidad", href: "/privacy" },
      { label: "Términos de servicio", href: "/terms" },
      { label: "Eliminación de datos", href: "/data-deletion" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer style={{ background: "#0f172a", borderTop: "1px solid #1e293b" }}>
      {/* Main footer grid */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "56px 40px 40px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 40,
        }}
      >
        {/* Brand */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.02em" }}>SEMSE Project</div>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, letterSpacing: "0.04em" }}>PLATAFORMA OPERATIVA</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, maxWidth: 300, margin: "0 0 20px" }}>
            Ecosistema digital para conectar clientes, profesionales y contratistas en proyectos de construcción, remodelación, mantenimiento y servicios especializados.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/client/jobs/new"
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                background: "#3b82f6",
                textDecoration: "none",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Publicar proyecto →
            </Link>
          </div>
        </div>

        {/* Columns */}
        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", marginBottom: 16 }}>
              {col.title.toUpperCase()}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    style={{ textDecoration: "none", color: "#94a3b8", fontSize: 14, transition: "color 0.15s" }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: "1px solid #1e293b",
          padding: "20px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "#475569" }}>
          © 2026 SEMSE Project · Marketplace operativo con IA, escrow y evidencias verificadas
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: "rgba(16,185,129,.12)",
              color: "#34d399",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ● Sistema activo
          </div>
          <div style={{ fontSize: 12, color: "#475569" }}>Prometeo IA conectado</div>
        </div>
      </div>
    </footer>
  );
}
