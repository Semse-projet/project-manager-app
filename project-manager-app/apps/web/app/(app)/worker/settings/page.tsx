"use client";

import { useEffect, useState } from "react";
import { Bot, Check, ChevronDown, Globe, Layers, MessageSquare, Save, Settings, Zap } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  fetchMyProfile,
  updateMyProfile,
  type AssistantLanguage,
  type AssistantTone,
  type AssistantVerbosity,
  type UserProfileView,
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

// ── Option maps ───────────────────────────────────────────────────────────────

const TONE_OPTIONS: { value: AssistantTone; label: string; desc: string }[] = [
  { value: "friendly",   label: "Amistoso",   desc: "Cálido y cercano, sin tecnicismos" },
  { value: "formal",     label: "Formal",     desc: "Profesional y preciso" },
  { value: "technical",  label: "Técnico",    desc: "Detallado y orientado a datos" },
  { value: "executive",  label: "Ejecutivo",  desc: "Conciso y orientado a decisiones" },
];

const LANGUAGE_OPTIONS: { value: AssistantLanguage; label: string; flag: string }[] = [
  { value: "es", label: "Español", flag: "🇲🇽" },
  { value: "en", label: "English", flag: "🇺🇸" },
];

const VERBOSITY_OPTIONS: { value: AssistantVerbosity; label: string; desc: string }[] = [
  { value: "short",    label: "Corto",      desc: "Respuestas concisas, máximo 2 líneas" },
  { value: "balanced", label: "Balanceado", desc: "Respuestas medianas, contexto razonable" },
  { value: "detailed", label: "Detallado",  desc: "Respuestas completas con ejemplos" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".06em" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function OptionCard<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; desc?: string; flag?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "12px 14px", borderRadius: 10, border: "none",
              background: selected ? "rgba(99,102,241,.12)" : "var(--bg)",
              cursor: "pointer",
              outline: selected ? "1.5px solid rgba(99,102,241,.5)" : "1.5px solid var(--border)",
              textAlign: "left",
              transition: "all .15s",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: selected ? "#818cf8" : "var(--ink)" }}>
                {opt.flag ? `${opt.flag} ` : ""}{opt.label}
              </div>
              {opt.desc && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{opt.desc}</div>
              )}
            </div>
            {selected && <Check size={14} color="#818cf8" />}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div
      role="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "14px 16px", borderRadius: 10, cursor: "pointer",
        background: value ? "rgba(99,102,241,.08)" : "var(--bg)",
        outline: value ? "1.5px solid rgba(99,102,241,.35)" : "1.5px solid var(--border)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: 999, flexShrink: 0,
        background: value ? "#6366f1" : "var(--border)",
        display: "flex", alignItems: "center",
        padding: "0 3px", transition: "background .2s",
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          transform: value ? "translateX(16px)" : "translateX(0)",
          transition: "transform .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkerSettingsPage() {
  const [profile, setProfile] = useState<UserProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local draft state
  const [tone,       setTone]       = useState<AssistantTone>("friendly");
  const [language,   setLanguage]   = useState<AssistantLanguage>("es");
  const [verbosity,  setVerbosity]  = useState<AssistantVerbosity>("balanced");
  const [unified,    setUnified]    = useState(false);
  const [expert,     setExpert]     = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchMyProfile()
      .then((p) => {
        setProfile(p);
        setTone(p.assistantTone ?? "friendly");
        setLanguage(p.assistantLanguage ?? "es");
        setVerbosity(p.assistantVerbosity ?? "balanced");
        setUnified(p.unifiedMode ?? false);
        setExpert(p.expertMode ?? false);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar perfil."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateMyProfile({
        assistantTone: tone,
        assistantLanguage: language,
        assistantVerbosity: verbosity,
        unifiedMode: unified,
        expertMode: expert,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  const card: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 16,
    background: "var(--surface)", padding: "20px 22px",
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
        Cargando configuración…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", display: "grid", gap: 16 }}>
      <NotificationBanner audience="worker" />

      {/* Header */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
          <Settings size={20} color="#818cf8" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Configuración del asistente</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Personaliza cómo habla el copiloto IA contigo
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 12, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ padding: "12px 16px", background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.22)", borderRadius: 12, color: "#10b981", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} /> Configuración guardada.
        </div>
      )}

      {/* Tone */}
      <HtmlInCanvasPanel style={card} minHeight={80}>
        <Section icon={<MessageSquare size={14} color="#818cf8" />} title="Tono del asistente">
          <OptionCard<AssistantTone> options={TONE_OPTIONS} value={tone} onChange={setTone} />
        </Section>
      </HtmlInCanvasPanel>

      {/* Language */}
      <HtmlInCanvasPanel style={card} minHeight={60}>
        <Section icon={<Globe size={14} color="#06b6d4" />} title="Idioma de respuesta">
          <OptionCard<AssistantLanguage> options={LANGUAGE_OPTIONS} value={language} onChange={setLanguage} />
        </Section>
      </HtmlInCanvasPanel>

      {/* Verbosity */}
      <HtmlInCanvasPanel style={card} minHeight={80}>
        <Section icon={<ChevronDown size={14} color="#f59e0b" />} title="Nivel de detalle">
          <OptionCard<AssistantVerbosity> options={VERBOSITY_OPTIONS} value={verbosity} onChange={setVerbosity} />
        </Section>
      </HtmlInCanvasPanel>

      {/* Modes */}
      <HtmlInCanvasPanel style={card} minHeight={60}>
        <Section icon={<Layers size={14} color="#10b981" />} title="Modos avanzados">
          <div style={{ display: "grid", gap: 10 }}>
            <Toggle
              label="Modo unificado"
              desc="El asistente responde combinando contexto de todos los proyectos activos, no solo el actual."
              value={unified}
              onChange={setUnified}
            />
            <Toggle
              label="Modo experto"
              desc="Respuestas técnicas con detalles internos: IDs, estados raw, scores de trust, logs de herramientas."
              value={expert}
              onChange={setExpert}
            />
          </div>
        </Section>
      </HtmlInCanvasPanel>

      {/* Preview */}
      <HtmlInCanvasPanel style={{ ...card, background: "rgba(99,102,241,.04)" }} minHeight={60}>
        <Section icon={<Bot size={14} color="#818cf8" />} title="Vista previa">
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
              Así responderá el asistente
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
              {tone === "friendly"  && "¡Hola! Con mucho gusto te ayudo. El escrow está fondeado con $8,500 y tienes 2 hitos pendientes. Te recomiendo revisar la evidencia antes de liberar fondos."}
              {tone === "formal"    && "El escrow registra $8,500 fondeados. Se identifican 2 hitos pendientes de aprobación. Se recomienda validar evidencia antes de proceder con la liberación."}
              {tone === "technical" && "ESCROW_STATUS=FUNDED | balance=8500 | milestones_pending=2 | evidence_count=3 | release_eligible=false (evidence_gap). Action: REQUEST_MISSING_EVIDENCE."}
              {tone === "executive" && "Escrow: $8.5K fondeado. 2 hitos sin cerrar. Próximo paso: aprobar evidencia → liberar fondos."}
              {" "}
              {verbosity === "short"    && "(Respuesta concisa.)"}
              {verbosity === "detailed" && "Aquí tienes el detalle completo con todos los pasos intermedios y justificaciones."}
              {language === "en" && " [This would be in English.]"}
            </p>
            {(unified || expert) && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {unified && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(16,185,129,.12)", color: "#10b981", fontWeight: 700 }}>modo unificado activo</span>}
                {expert  && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(99,102,241,.12)", color: "#818cf8", fontWeight: 700 }}>modo experto activo</span>}
              </div>
            )}
          </div>
        </Section>
      </HtmlInCanvasPanel>

      {/* Save */}
      <button
        onClick={() => void save()}
        disabled={saving || !profile}
        style={{
          padding: "13px 24px", borderRadius: 12, border: "none",
          background: saving ? "var(--border)" : "linear-gradient(135deg,#6366f1,#4f46e5)",
          color: "#fff", fontSize: 14, fontWeight: 800,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <Save size={15} />
        {saving ? "Guardando…" : "Guardar configuración"}
      </button>

      <div style={{ fontSize: 11, color: "var(--faint)", textAlign: "center" }}>
        {profile?.updatedAt
          ? `Última actualización: ${new Date(profile.updatedAt).toLocaleString("es-MX")}`
          : ""}
      </div>
    </div>
  );
}
