"use client";

// Password strength meter shared by register and reset-password.

import { useLanguage } from "@/lib/language-context";

const LABELS = {
  es: ["Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"],
  en: ["Very weak", "Weak", "Fair", "Strong", "Very strong"],
} as const;

const COLORS = ["var(--error)", "#f97316", "#eab308", "#22c55e", "var(--ok)"];

export function PasswordStrength({ password }: { password: string }) {
  const { language } = useLanguage();
  if (!password) return null;
  const score = [
    password.length >= 15,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  return (
    <div style={{ marginTop: "6px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "3px",
              borderRadius: "2px",
              background: i < score ? COLORS[score] : "var(--border, #1f2d3d)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: "11px", color: score >= 3 ? "#22c55e" : "var(--muted, #94a3b8)" }}>
        {LABELS[language][score]}
      </span>
    </div>
  );
}
