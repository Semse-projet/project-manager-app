"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { History, MapPin, MapPinOff, RefreshCw } from "lucide-react";
import { LocationPreferencePanel } from "../../../../components/location/LocationPreferencePanel";
import {
  fetchMyGeofenceEvents,
  type GeofenceDecision,
  type GeofenceEventView
} from "../../../lib/module-surfaces-api";
import { Banner, Button, Empty, Panel, Pill, formatDate, shortId, type Tone } from "../../../../components/module-surface/ui";

// Spec: docs/specs/core/geofence-policy.spec.md v0.3 (BO-09). Self-service: the
// person sets how location is used for the clock and sees every decision the
// system took with their events (AC-11). No coordinates are stored or shown.

const DECISION: Record<GeofenceDecision, { label: string; tone: Tone }> = {
  PROMPT: { label: "Te preguntamos", tone: "brand" },
  AUTO_START_ALLOWED: { label: "Inicio automático permitido", tone: "ok" },
  MANUAL_ONLY: { label: "Solo inicio manual", tone: "warn" },
  LEAVE_PROMPT: { label: "Te preguntamos al salir", tone: "brand" },
  EXCEPTION: { label: "Excepción", tone: "warn" },
  IGNORE: { label: "Ignorado", tone: "muted" }
};

const EVENT_TYPE: Record<string, string> = {
  ARRIVAL: "Llegada",
  LEAVE: "Salida",
  OFF_SITE_AT_SHIFT: "Fuera de obra a la hora del turno"
};

const ACCURACY: Record<string, string> = { GOOD: "Buena (≤ 50 m)", POOR: "Imprecisa", UNKNOWN: "Desconocida" };

export default function WorkerLocationPage() {
  const [available, setAvailable] = useState(true);
  const [events, setEvents] = useState<GeofenceEventView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents((await fetchMyGeofenceEvents()) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar tus eventos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (available) void loadEvents();
  }, [available, loadEvents]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      <header>
        <Link href="/worker/settings" style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          ← Configuración
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "color-mix(in srgb, var(--brand) 14%, transparent)"
            }}
          >
            <MapPin size={20} style={{ color: "var(--brand)" }} aria-hidden />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Ubicación y reloj</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Decide cómo se usa tu ubicación para iniciar el reloj y revisa qué decidió el sistema.
            </p>
          </div>
        </div>
      </header>

      {!available ? (
        <Panel>
          <Empty
            icon={MapPinOff}
            title="Esta función aún no está habilitada"
            description="Mientras tanto, el modo de check-in por ubicación se sigue configurando en Configuración."
            action={
              <Link href="/worker/settings" style={{ color: "var(--brand)", fontSize: 13, fontWeight: 600 }}>
                Ir a Configuración
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <Panel title="Uso de tu ubicación" icon={MapPin}>
            <LocationPreferencePanel onUnavailable={() => setAvailable(false)} onChange={() => void loadEvents()} />
          </Panel>

          <Panel
            title="Mis eventos y decisiones"
            icon={History}
            padded={events.length === 0}
            actions={
              <Button icon={RefreshCw} onClick={() => void loadEvents()} busy={loading}>
                Actualizar
              </Button>
            }
          >
            {error ? (
              <Banner tone="error">{error}</Banner>
            ) : events.length === 0 ? (
              <Empty
                icon={History}
                title="Todavía no hay eventos"
                description="Cuando la app móvil detecte que llegas o sales de una obra, verás aquí cada decisión, con su motivo."
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                      {["Evento", "Decisión", "Motivo", "Precisión", "Cuándo"].map((h) => (
                        <th key={h} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => {
                      const d = DECISION[e.decision] ?? { label: e.decision, tone: "muted" as Tone };
                      return (
                        <tr key={e.eventId} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                          <td style={{ padding: "10px 16px", color: "var(--ink)" }}>
                            <div style={{ fontWeight: 600 }}>{EVENT_TYPE[e.type] ?? e.type}</div>
                            <div style={{ fontSize: 11, color: "var(--faint)" }}>
                              {e.worksiteId ? `Obra ${shortId(e.worksiteId)}` : "Sin obra"} · modo {e.mode} · v{e.policyVersion}
                            </div>
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <Pill tone={d.tone}>{d.label}</Pill>
                          </td>
                          <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{e.reason}</td>
                          <td style={{ padding: "10px 16px", color: "var(--muted)", whiteSpace: "nowrap" }}>{ACCURACY[e.accuracy] ?? e.accuracy}</td>
                          <td style={{ padding: "10px 16px", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDate(e.occurredAt, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
