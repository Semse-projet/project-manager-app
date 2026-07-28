"use client";

// Motor de sincronizacion de la cola offline de Agro. Se monta UNA sola vez en
// agro/layout.tsx (no por pagina): si cada pagina de Agro (Tareas, Animales,
// Inventario...) montara su propio efecto de auto-sync, N paginas abiertas
// dispararian N POST /sync/events concurrentes del mismo lote. El servidor lo
// tolera (el unique de #442 hace que la carrera resuelva en SYNCED+DUPLICATE,
// nunca en doble aplicacion), pero es trabajo de red desperdiciado. Un solo
// dueño del efecto, expuesto por contexto a quien necesite leer el estado o
// encolar (el banner de layout, y cada pagina que escribe offline-safe).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyAgroSyncResults,
  createAgroLocalState,
  enqueueAgroEvent,
  hasAgroPendingWork,
  markAgroSyncFailed,
  markAgroSyncing,
  readAgroLocalState,
  writeAgroLocalState,
  type AgroLocalState,
  type AgroPendingEvent,
  type AgroSyncAction,
} from "./agroLocalStore";
import { AgroSyncHttpError, shouldPreserveAgroLocalEvent } from "./agroSyncUi";

// Mismo esquema de reintento que apps/web/app/(app)/worker/tracker/page.tsx:
// backoff exponencial con techo, y un limite de intentos automaticos despues
// del cual el usuario tiene que pulsar "Reintentar ahora" — evita el bucle de
// reintento infinito que #432 tuvo que arreglar para el Time Tracker.
const AUTO_SYNC_RETRY_BASE_MS = 5_000;
const AUTO_SYNC_RETRY_MAX_MS = 5 * 60_000;
const AUTO_SYNC_MAX_ATTEMPTS = 6;

function autoSyncRetryDelay(attempts: number) {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(AUTO_SYNC_RETRY_BASE_MS * 2 ** exponent, AUTO_SYNC_RETRY_MAX_MS);
}

type SyncEventResult = { clientEventId: string; status: "SYNCED" | "FAILED" | "DUPLICATE"; error?: string };

async function postSyncBatch(events: AgroPendingEvent[]): Promise<SyncEventResult[]> {
  const res = await fetch("/api/semse/agro/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      events: events.map((e) => ({
        clientEventId: e.id,
        farmId: e.farmId,
        action: e.action,
        payload: e.payload,
        occurredAt: e.occurredAt,
      })),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message ?? `HTTP ${res.status}`;
    throw new AgroSyncHttpError(res.status, message);
  }
  // AgroDashboardController.syncEvents responde ok(requestId, { results }):
  // el array esta anidado bajo data.results, no bajo data directamente.
  return (json?.data?.results as SyncEventResult[]) ?? [];
}

type AgroSyncContextValue = {
  state: AgroLocalState;
  isOnline: boolean;
  autoSyncStopped: boolean;
  enqueue: (input: { farmId: string; action: AgroSyncAction; payload: Record<string, unknown> }) => AgroPendingEvent;
  retryNow: () => void;
  /** Ultimo lote de fallos permanentes (4xx) — para que la UI avise, no para reintentar. */
  permanentFailures: Array<{ event: AgroPendingEvent; error?: string }>;
};

const AgroSyncContext = createContext<AgroSyncContextValue | null>(null);

export function AgroSyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgroLocalState>(createAgroLocalState);
  const [isOnline, setIsOnline] = useState(true);
  const [autoSyncStopped, setAutoSyncStopped] = useState(false);
  const [permanentFailures, setPermanentFailures] = useState<Array<{ event: AgroPendingEvent; error?: string }>>([]);
  const attemptsRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const persist = useCallback((next: AgroLocalState) => {
    setState(next);
    writeAgroLocalState(typeof window === "undefined" ? null : window.localStorage, next);
  }, []);

  const runSync = useCallback(async () => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    const current = readAgroLocalState(storage);
    if (current.pendingEvents.length === 0) return;

    persist(markAgroSyncing(current));
    // Los IDs que de verdad se mandan en este POST — si algo se encola
    // mientras la llamada esta en vuelo, no debe perderse al aplicar el
    // resultado (ver abajo).
    const sentIds = new Set(current.pendingEvents.map((e) => e.id));
    try {
      const results = await postSyncBatch(current.pendingEvents);
      // Se relee el estado mas reciente en vez de reusar `current`: encolar
      // un evento nuevo (otra pagina, otra pestaña) mientras este POST estaba
      // en vuelo lo habria escrito a localStorage, y persistir sobre el
      // snapshot viejo lo habria borrado sin haberlo enviado nunca.
      // `applyAgroSyncResults` ya conserva intacto cualquier evento sin
      // resultado; filtrar aqui a `sentIds` es solo defensivo.
      const latest = readAgroLocalState(storage);
      const relevantResults = results.filter((r) => sentIds.has(r.clientEventId));
      const { state: resolved, permanentFailures: failures } = applyAgroSyncResults(latest, relevantResults);
      persist(resolved);
      setPermanentFailures(failures);
      attemptsRef.current = 0;
      setAutoSyncStopped(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo sincronizar Agro.";
      const latest = readAgroLocalState(storage);
      persist(markAgroSyncFailed(latest, message));
      if (!shouldPreserveAgroLocalEvent(caught)) setAutoSyncStopped(true);
    }
  }, [persist]);

  const runSyncRef = useRef(runSync);
  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  // Carga inicial + listeners de online/offline, una sola vez.
  useEffect(() => {
    const stored = readAgroLocalState(window.localStorage);
    setState(stored);
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      attemptsRef.current = 0;
      setAutoSyncStopped(false);
      void runSyncRef.current();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Motor de reintento: dispara de inmediato ante trabajo nuevo, y con backoff
  // tras un fallo — mismo shape que el useEffect de auto-sync del tracker.
  useEffect(() => {
    if (!isOnline || state.syncStatus === "syncing") return;
    if (state.pendingEvents.length === 0) {
      attemptsRef.current = 0;
      if (autoSyncStopped) setAutoSyncStopped(false);
      return;
    }

    if (state.syncStatus !== "failed") {
      attemptsRef.current = 0;
      void runSyncRef.current();
      return;
    }

    if (autoSyncStopped) return;
    if (attemptsRef.current >= AUTO_SYNC_MAX_ATTEMPTS) {
      setAutoSyncStopped(true);
      return;
    }

    const timer = window.setTimeout(() => {
      attemptsRef.current += 1;
      void runSyncRef.current();
    }, autoSyncRetryDelay(attemptsRef.current));
    return () => window.clearTimeout(timer);
  }, [autoSyncStopped, isOnline, state.pendingEvents.length, state.syncStatus]);

  const enqueue = useCallback<AgroSyncContextValue["enqueue"]>((input) => {
    const current = readAgroLocalState(typeof window === "undefined" ? null : window.localStorage);
    const { state: next, event } = enqueueAgroEvent(current, input);
    persist(next);
    return event;
  }, [persist]);

  const retryNow = useCallback(() => {
    attemptsRef.current = 0;
    setAutoSyncStopped(false);
    setPermanentFailures([]);
    void runSyncRef.current();
  }, []);

  const value = useMemo<AgroSyncContextValue>(
    () => ({ state, isOnline, autoSyncStopped, enqueue, retryNow, permanentFailures }),
    [state, isOnline, autoSyncStopped, enqueue, retryNow, permanentFailures],
  );

  return <AgroSyncContext.Provider value={value}>{children}</AgroSyncContext.Provider>;
}

/** Debe usarse bajo AgroSyncProvider (montado en agro/layout.tsx). */
export function useAgroSync(): AgroSyncContextValue {
  const ctx = useContext(AgroSyncContext);
  if (!ctx) throw new Error("useAgroSync debe usarse dentro de <AgroSyncProvider>");
  return ctx;
}

export { hasAgroPendingWork };
