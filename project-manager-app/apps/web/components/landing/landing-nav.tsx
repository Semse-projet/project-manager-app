"use client";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Servicios", href: "#servicios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Prometeo IA", href: "#prometeo" },
  { label: "Profesionales", href: "#profesionales" },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 40px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(20px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
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
            letterSpacing: "-0.02em",
          }}
        >
          S
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1.1 }}>
            SEMSE Project
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.04em" }}>
            PLATAFORMA OPERATIVA
          </div>
        </div>
      </Link>

      {/* Nav links — desktop */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }} className="hidden md:flex">
        {NAV_LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              textDecoration: "none",
              color: "#475569",
              fontSize: 14,
              fontWeight: 500,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {l.label}
          </a>
        ))}
      </div>

      {/* CTA buttons */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link
          href="/login"
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            textDecoration: "none",
            color: "#374151",
            fontSize: 14,
            fontWeight: 500,
            background: "#fff",
          }}
        >
          Ingresar
        </Link>
        <Link
          href="/client/jobs/new"
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            textDecoration: "none",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(59,130,246,.3)",
          }}
        >
          Publicar proyecto
        </Link>
      </div>
    </nav>
  );
}
