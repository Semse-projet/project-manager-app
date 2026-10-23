"use client";

// ES/EN switch for the public auth pages (login, register, password reset),
// which live outside the (app) layout and its language selector.

import { useLanguage, type LanguagePreference } from "@/lib/language-context";

const LANGUAGES: { value: LanguagePreference; label: string }[] = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

const GROUP_LABEL = { es: "Idioma", en: "Language" } as const;

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div
      role="group"
      aria-label={GROUP_LABEL[language]}
      style={{ display: "flex", justifyContent: "flex-end", gap: "4px", marginBottom: "12px" }}
    >
      {LANGUAGES.map(({ value, label }) => {
        const active = language === value;
        return (
          <button
            key={value}
            type="button"
            lang={value}
            aria-pressed={active}
            onClick={() => setLanguage(value)}
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              border: `1px solid ${active ? "var(--brand)" : "var(--border, #1f2d3d)"}`,
              background: active ? "var(--brand)" : "transparent",
              color: active ? "#fff" : "var(--muted, #94a3b8)",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
