"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Volume2 } from "lucide-react";
import type { LibraryItemView } from "@semse/schemas";
import { isSpeechAvailable, speak } from "../../../lib/sense-vision/browser";
import { trackProductEvent } from "../../../lib/product-intelligence";

// Sense Vision / Mi Diccionario — one bilingual "ficha" for a Construction
// Library item: EN/ES names, confidence, pronunciation, usage and a real
// job-site sentence. Spec: docs/specs/vision/sense-vision-field-library.spec.md §2.

export function confidenceTone(confidence: number): { color: string; label: string } {
  if (confidence >= 0.8) return { color: "var(--ok)", label: "Alta" };
  if (confidence >= 0.5) return { color: "var(--warn)", label: "Media" };
  return { color: "var(--error)", label: "Baja" };
}

function ListenButton({ text, lang, label }: { text: string; lang: "en-US" | "es-ES"; label: string }) {
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40 }}
      onClick={() => {
        if (speak(text, lang)) trackProductEvent("vision.pronunciation_played", { lang });
      }}
      aria-label={`${label}: ${text}`}
    >
      <Volume2 size={16} aria-hidden /> {label}
    </button>
  );
}

export function WordCard({
  item,
  confidence,
  compact = false,
  actions,
}: {
  item: LibraryItemView;
  confidence?: number;
  compact?: boolean;
  actions?: ReactNode;
}) {
  // Resolved after mount: speechSynthesis only exists in the browser, and
  // reading it during render would mismatch the server-rendered HTML.
  const [speech, setSpeech] = useState(false);
  useEffect(() => setSpeech(isSpeechAvailable()), []);
  const tone = confidence === undefined ? null : confidenceTone(confidence);
  return (
    <article
      aria-label={`${item.nameEn} — ${item.nameEs}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, 14px)",
        padding: compact ? 14 : 18,
        display: "grid",
        gap: 12,
      }}
    >
      <header style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 lang="en" style={{ margin: 0, fontSize: compact ? 18 : 24, fontWeight: 800, color: "var(--ink)", letterSpacing: 0.2 }}>
            {item.nameEn}
          </h2>
          {tone && confidence !== undefined && (
            <span style={{ fontSize: 13, fontWeight: 700, color: tone.color }} aria-label={`Confianza ${Math.round(confidence * 100)} por ciento`}>
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
        </div>
        <p lang="es" style={{ margin: 0, fontSize: compact ? 15 : 18, color: "var(--muted)", fontWeight: 600 }}>{item.nameEs}</p>
        {item.aliasesEn.length > 0 && !compact && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--faint)" }}>
            También: {[...item.aliasesEn.slice(0, 3), ...item.aliasesEs.slice(0, 2)].join(" · ")}
          </p>
        )}
      </header>

      {speech && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ListenButton text={item.nameEn} lang="en-US" label="Listen" />
          <ListenButton text={item.nameEs} lang="es-ES" label="Escuchar" />
        </div>
      )}

      <section style={{ display: "grid", gap: 4 }}>
        <p lang="es" style={{ margin: 0, fontSize: 14, color: "var(--ink)" }}>{item.usageEs}</p>
        {!compact && <p lang="en" style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{item.usageEn}</p>}
      </section>

      <blockquote
        style={{
          margin: 0,
          padding: "10px 12px",
          borderLeft: "3px solid var(--brand)",
          background: "var(--raised)",
          borderRadius: 8,
          display: "grid",
          gap: 4,
        }}
      >
        <span lang="en" style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>“{item.exampleSentenceEn}”</span>
        <span lang="es" style={{ fontSize: 13, color: "var(--muted)" }}>“{item.exampleSentenceEs}”</span>
      </blockquote>

      {actions && <footer style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</footer>}
    </article>
  );
}
