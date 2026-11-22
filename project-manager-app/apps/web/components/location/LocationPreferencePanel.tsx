"use client";

import { useEffect, useState } from "react";
import { MapPinOff, MapPin, Navigation, ShieldCheck } from "lucide-react";
import {
  SurfaceApiError,
  fetchLocationPreference,
  saveLocationPreference,
  type LocationMode,
  type LocationPreference
} from "../../app/lib/module-surfaces-api";
import { Banner, ConfirmDialog, Loading, Pill, type Tone } from "../module-surface/ui";
import { useLanguage } from "../../lib/language-context";

/**
 * BO-09 location preference (docs/specs/core/geofence-policy.spec.md v0.3).
 * With SEMSE_GEOFENCE_POLICY_ENABLED off the API answers 404 and this panel
 * calls `onUnavailable`, so the caller can keep its legacy control (OPEN-17).
 */

// ES/EN copy. The consent and revocation texts must be readable in the language
// the worker selected, so they are not left as untranslated literals.
const COPY = {
  es: {
    ask: ["Preguntar", "Al llegar a la obra te preguntamos si quieres iniciar el reloj. Es la opción por defecto."],
    auto: ["Iniciar automático", "El reloj puede iniciarse solo al detectar que llegaste a un lugar de trabajo. Requiere tu consentimiento específico."],
    off: ["Desactivado", "SEMSE no usa tu ubicación para el reloj."],
    savedAuto: "Inicio automático activado con tu consentimiento. Puedes revocarlo cuando quieras.",
    savedOff: "Ubicación desactivada para el reloj.",
    savedAsk: "Te preguntaremos antes de iniciar el reloj.",
    saveError: "No se pudo guardar",
    loadError: "No se pudo cargar tu preferencia de ubicación",
    loading: "Cargando preferencia de ubicación…",
    groupLabel: "Uso de la ubicación para el reloj",
    consentActive: "Consentimiento vigente",
    autoWithoutConsent: "AUTO está elegido pero sin consentimiento vigente, así que el sistema se comporta como «Preguntar».",
    privacy: "SEMSE nunca guarda tus coordenadas en estas decisiones: solo el resultado y un rango de precisión. Versión de política",
    consentTitle: "Consentimiento para inicio automático",
    consentConfirm: "Doy mi consentimiento",
    consentBody:
      "Con este modo, cuando la app detecte que llegaste a un lugar de trabajo podrá iniciar tu reloj sin preguntarte. Si se inició por error, puedes detenerlo desde el reloj. El reloj nunca se detiene solo por tu ubicación.",
    consentCheckbox:
      "Acepto que mi ubicación se use para iniciar el reloj automáticamente. Puedo revocarlo en cualquier momento cambiando de modo.",
    leaveTitle: "Salir del inicio automático",
    leaveConfirm: "Cambiar modo",
    leaveBody: "Al salir de «Iniciar automático» se revoca tu consentimiento. Si más adelante quieres volver, te lo pediremos de nuevo."
  },
  en: {
    ask: ["Ask", "When you arrive at the worksite we ask whether you want to start the clock. This is the default."],
    auto: ["Start automatically", "The clock can start on its own when we detect you arrived at a workplace. Requires your specific consent."],
    off: ["Off", "SEMSE does not use your location for the clock."],
    savedAuto: "Automatic start turned on with your consent. You can revoke it at any time.",
    savedOff: "Location turned off for the clock.",
    savedAsk: "We will ask you before starting the clock.",
    saveError: "Could not save",
    loadError: "Could not load your location preference",
    loading: "Loading location preference…",
    groupLabel: "Use of your location for the clock",
    consentActive: "Consent active",
    autoWithoutConsent: "AUTO is selected but there is no active consent, so the system behaves as “Ask”.",
    privacy: "SEMSE never stores your coordinates in these decisions: only the result and an accuracy range. Policy version",
    consentTitle: "Consent for automatic start",
    consentConfirm: "I give my consent",
    consentBody:
      "With this mode, when the app detects you arrived at a workplace it can start your clock without asking. If it started by mistake, you can stop it from the clock. The clock never stops on its own because of your location.",
    consentCheckbox:
      "I agree that my location is used to start the clock automatically. I can revoke this at any time by changing the mode.",
    leaveTitle: "Leave automatic start",
    leaveConfirm: "Change mode",
    leaveBody: "Leaving “Start automatically” revokes your consent. If you want to come back later, we will ask you again."
  }
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];

function modes(c: Copy): { value: LocationMode; label: string; desc: string; icon: typeof MapPin; tone: Tone }[] {
  return [
    { value: "ASK", label: c.ask[0], desc: c.ask[1], icon: MapPin, tone: "brand" },
    { value: "AUTO", label: c.auto[0], desc: c.auto[1], icon: Navigation, tone: "warn" },
    { value: "OFF", label: c.off[0], desc: c.off[1], icon: MapPinOff, tone: "muted" }
  ];
}

export function LocationPreferencePanel({
  onUnavailable,
  onChange
}: {
  onUnavailable?: () => void;
  onChange?: (pref: LocationPreference) => void;
}) {
  const { language } = useLanguage();
  const c: Copy = COPY[language] ?? COPY.es;
  const [pref, setPref] = useState<LocationPreference | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [confirmLeaveAuto, setConfirmLeaveAuto] = useState<LocationMode | null>(null);

  useEffect(() => {
    fetchLocationPreference()
      .then((p) => {
        setPref(p);
        setState("ready");
        onChange?.(p);
      })
      .catch((e: unknown) => {
        if (e instanceof SurfaceApiError && e.status === 404) {
          setState("unavailable");
          onUnavailable?.();
        } else {
          setState("error");
          setError(e instanceof Error ? e.message : c.loadError);
        }
      });
    // Load once on mount; callbacks are notifications, not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(mode: LocationMode, autoStartConsent?: boolean) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const next = await saveLocationPreference({ mode, ...(autoStartConsent !== undefined ? { autoStartConsent } : {}) });
      setPref(next);
      onChange?.(next);
      setSaved(
        mode === "AUTO" ? c.savedAuto : mode === "OFF" ? c.savedOff : c.savedAsk
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : c.saveError);
    } finally {
      setBusy(false);
    }
  }

  function choose(mode: LocationMode) {
    if (!pref || mode === pref.mode) return;
    if (mode === "AUTO" && !pref.autoStartConsent) {
      setConsentChecked(false);
      setAskConsent(true);
      return;
    }
    if (pref.mode === "AUTO" && pref.autoStartConsent) {
      setConfirmLeaveAuto(mode);
      return;
    }
    void save(mode);
  }

  if (state === "loading") return <Loading label={c.loading} />;
  if (state === "unavailable") return null;
  if (state === "error" || !pref) return <Banner tone="error">{error ?? c.loadError}</Banner>;

  const autoWithoutConsent = pref.mode === "AUTO" && !pref.autoStartConsent;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div role="radiogroup" aria-label={c.groupLabel} style={{ display: "grid", gap: 8 }}>
        {modes(c).map((m) => {
          const selected = pref.mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => choose(m.value)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 12,
                cursor: busy ? "wait" : "pointer",
                border: `1px solid ${selected ? `var(--${m.tone === "muted" ? "border-2" : m.tone})` : "var(--border)"}`,
                background: selected ? `color-mix(in srgb, var(--${m.tone}) 10%, transparent)` : "var(--bg)",
                color: "var(--ink)"
              }}
            >
              <m.icon size={18} style={{ color: `var(--${m.tone})`, marginTop: 2, flexShrink: 0 }} aria-hidden />
              <span style={{ flex: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                  {m.label}
                  {selected && m.value === "AUTO" && pref.autoStartConsent ? (
                    <Pill tone="ok" icon={ShieldCheck}>
                      {c.consentActive}
                    </Pill>
                  ) : null}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{m.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {autoWithoutConsent ? (
        <Banner tone="warn">{c.autoWithoutConsent}</Banner>
      ) : null}
      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}
      {saved ? <Banner tone="ok" onDismiss={() => setSaved(null)}>{saved}</Banner> : null}

      <p style={{ margin: 0, fontSize: 11, color: "var(--faint)", lineHeight: 1.5 }}>
        {c.privacy} {pref.policyVersion}.
      </p>

      <ConfirmDialog
        open={askConsent}
        title={c.consentTitle}
        confirmLabel={c.consentConfirm}
        busy={busy}
        confirmDisabled={!consentChecked}
        onCancel={() => setAskConsent(false)}
        onConfirm={() => {
          if (!consentChecked) return;
          setAskConsent(false);
          void save("AUTO", true);
        }}
      >
        <p style={{ margin: "0 0 10px" }}>
          {c.consentBody}
        </p>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--ink)" }}>
          <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} style={{ marginTop: 2 }} />
          {c.consentCheckbox}
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(confirmLeaveAuto)}
        title={c.leaveTitle}
        confirmLabel={c.leaveConfirm}
        busy={busy}
        onCancel={() => setConfirmLeaveAuto(null)}
        onConfirm={() => {
          const next = confirmLeaveAuto;
          setConfirmLeaveAuto(null);
          if (next) void save(next);
        }}
      >
        {c.leaveBody}
      </ConfirmDialog>
    </div>
  );
}
