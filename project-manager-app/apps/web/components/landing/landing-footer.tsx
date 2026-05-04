export function LandingFooter() {
  return (
    <footer
      style={{
        background: "#0f172a",
        padding: "28px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid #1e293b",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          S
        </div>
        <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>SEMSE</span>
      </div>
      <div style={{ fontSize: 13, color: "#64748b" }}>
        © 2026 SEMSE · Marketplace operativo con IA y escrow
      </div>
      <div style={{ display: "flex", gap: 20, color: "#64748b", fontSize: 13 }}>
        <span>Privacidad</span>
        <span>Términos</span>
        <span>Soporte</span>
      </div>
    </footer>
  );
}
