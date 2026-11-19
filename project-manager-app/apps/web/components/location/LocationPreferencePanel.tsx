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

/**
 * BO-09 location preference (docs/specs/core/geofence-policy.spec.md v0.3).
 * With SEMSE_GEOFENCE_POLICY_ENABLED off the API answers 404 and this panel
 * calls `onUnavailable`, so the caller can keep its legacy control (OPEN-17).
 */

const MODES: { value: LocationMode; label: string; desc: string; icon: typeof MapPin; tone: Tone }[] = [
  {
    value: "ASK",
    label: "Preguntar",
    desc: "Al llegar a la obra te preguntamos si quieres iniciar el reloj. Es la opción por defecto.",
    icon: MapPin,
    tone: "brand"
  },
  {
    value: "AUTO",
    label: "Iniciar automático",
    desc: "El reloj puede iniciarse solo al detectar que llegaste a un lugar de trabajo. Requiere tu consentimiento específico.",
    icon: Navigation,
    tone: "warn"
  },
  {
    value: "OFF",
    label: "Desactivado",
    desc: "SEMSE no usa tu ubicación para el reloj.",
    icon: MapPinOff,
    tone: "muted"
  }
];

export function LocationPreferencePanel({
  onUnavailable,
  onChange
}: {
  onUnavailable?: () => void;
  onChange?: (pref: LocationPreference) => void;
}) {
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
          setError(e instanceof Error ? e.message : "No se pudo cargar tu preferencia de ubicación");
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
        mode === "AUTO"
          ? "Inicio automático activado con tu consentimiento. Puedes revocarlo cuando quieras."
          : mode === "OFF"
            ? "Ubicación desactivada para el reloj."
            : "Te preguntaremos antes de iniciar el reloj."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
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

  if (state === "loading") return <Loading label="Cargando preferencia de ubicación…" />;
  if (state === "unavailable") return null;
  if (state === "error" || !pref) return <Banner tone="error">{error ?? "No se pudo cargar tu preferencia de ubicación"}</Banner>;

  const autoWithoutConsent = pref.mode === "AUTO" && !pref.autoStartConsent;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div role="radiogroup" aria-label="Uso de la ubicación para el reloj" style={{ display: "grid", gap: 8 }}>
        {MODES.map((m) => {
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
                      Consentimiento vigente
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
        <Banner tone="warn">AUTO está elegido pero sin consentimiento vigente, así que el sistema se comporta como «Preguntar».</Banner>
      ) : null}
      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}
      {saved ? <Banner tone="ok" onDismiss={() => setSaved(null)}>{saved}</Banner> : null}

      <p style={{ margin: 0, fontSize: 11, color: "var(--faint)", lineHeight: 1.5 }}>
        SEMSE nunca guarda tus coordenadas en estas decisiones: solo el resultado y un rango de precisión. Versión de política{" "}
        {pref.policyVersion}.
      </p>

      <ConfirmDialog
        open={askConsent}
        title="Consentimiento para inicio automático"
        confirmLabel="Doy mi consentimiento"
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
          Con este modo, cuando la app detecte que llegaste a un lugar de trabajo podrá iniciar tu reloj sin preguntarte. Si
          se inició por error, puedes detenerlo desde el reloj. El reloj nunca se detiene solo por tu ubicación.
        </p>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--ink)" }}>
          <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} style={{ marginTop: 2 }} />
          Acepto que mi ubicación se use para iniciar el reloj automáticamente. Puedo revocarlo en cualquier momento cambiando de modo.
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(confirmLeaveAuto)}
        title="Salir del inicio automático"
        confirmLabel="Cambiar modo"
        busy={busy}
        onCancel={() => setConfirmLeaveAuto(null)}
        onConfirm={() => {
          const next = confirmLeaveAuto;
          setConfirmLeaveAuto(null);
          if (next) void save(next);
        }}
      >
        Al salir de «Iniciar automático» se revoca tu consentimiento. Si más adelante quieres volver, te lo pediremos de nuevo.
      </ConfirmDialog>
    </div>
  );
}
