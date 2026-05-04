import Link from "next/link";

export function LandingNav() {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 40px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,.88)",
        backdropFilter: "blur(16px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          S
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: "var(--ink)" }}>SEMSE</span>
      </Link>

      <div style={{ display: "flex", gap: 8 }}>
        <Link
          href="/login"
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            textDecoration: "none",
            color: "var(--ink)",
            fontSize: 14,
            fontWeight: 500,
            background: "var(--surface)",
          }}
        >
          Ingresar
        </Link>
        <Link
          href="/client/jobs/new"
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "#3b82f6",
            textDecoration: "none",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Publicar trabajo
        </Link>
      </div>
    </nav>
  );
}
