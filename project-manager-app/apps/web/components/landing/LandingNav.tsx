"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Sparkles } from "lucide-react";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#servicios", label: "Servicios" },
  { href: "#pagos", label: "Pagos seguros" },
  { href: "#profesionales", label: "Profesionales" },
  { href: "#ia-prometeo", label: "IA Prometeo" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--land-border)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "0 24px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: 16,
            boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
          }}>S</div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", letterSpacing: "-0.02em" }}>SEMSE</span>
            <span style={{ fontWeight: 600, fontSize: 11, color: "#64748b", display: "block", lineHeight: 1, marginTop: 1 }}>project</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }} className="hidden md:flex">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 500,
              color: "#374151", textDecoration: "none", transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="hidden md:flex">
          <Link href="/login" style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 14, fontWeight: 500,
            color: "#374151", textDecoration: "none", border: "1px solid #e2e8f0",
            transition: "all 0.15s",
          }}>
            Ingresar
          </Link>
          <Link href="/client/jobs/new" style={{
            padding: "9px 20px", borderRadius: 9, fontSize: 14, fontWeight: 700,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: "#fff", textDecoration: "none",
            boxShadow: "0 4px 12px rgba(59,130,246,0.35)",
            display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.15s",
          }}>
            <Sparkles size={14} />
            Publicar trabajo
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 8, borderRadius: 8, color: "#374151",
          }}
          className="md:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{
          background: "#fff", borderTop: "1px solid #e2e8f0",
          padding: "16px 24px 24px",
        }} className="md:hidden">
          <nav style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
                padding: "10px 14px", borderRadius: 8, fontSize: 15, fontWeight: 500,
                color: "#374151", textDecoration: "none",
              }}>
                {l.label}
              </a>
            ))}
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/login" onClick={() => setOpen(false)} style={{
              padding: "12px 20px", borderRadius: 9, fontSize: 15, fontWeight: 600,
              color: "#374151", textDecoration: "none", border: "1px solid #e2e8f0",
              textAlign: "center",
            }}>Ingresar</Link>
            <Link href="/client/jobs/new" onClick={() => setOpen(false)} style={{
              padding: "12px 20px", borderRadius: 9, fontSize: 15, fontWeight: 700,
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: "#fff", textDecoration: "none", textAlign: "center",
            }}>Publicar trabajo gratis</Link>
          </div>
        </div>
      )}
    </header>
  );
}
