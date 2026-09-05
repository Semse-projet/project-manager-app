// Cola offline de Agro (F1_RANCHOPS_CORE_SPEC.md §8 — Offline MVP).
//
// Mismo patron que apps/web/app/(app)/worker/tracker/trackerLocalStore.ts: un
// blob JSON en localStorage, no IndexedDB. La spec pide explicitamente "no
// archivos offline pesados" -las 8 acciones son JSON pequeño, nunca fotos ni
// blobs- asi que localStorage alcanza y evita la complejidad async de IndexedDB.

export type AgroSyncAction =
  | "farm_task.create"
  | "farm_task.complete"
  | "farm_task.block"
  | "animal.move"
  | "animal.weigh"
  | "animal_group.move"
  | "inventory_movement.create"
  | "evidence.note.create";

export type AgroPendingEvent = {
  /** clientEventId: la clave de idempotencia real hacia AgroSyncService. */
  id: string;
  farmId: string;
  action: AgroSyncAction;
  payload: Record<string, unknown>;
  occurredAt: string;
  enqueuedAt: string;
};

export type AgroSyncStatus = "synced" | "pending" | "syncing" | "failed";

export type AgroLocalState = {
  version: 1;
  pendingEvents: AgroPendingEvent[];
  lastSyncedAt?: string;
  syncStatus: AgroSyncStatus;
  lastError?: string;
};

export type AgroStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const AGRO_LOCAL_STORE_KEY = "semse.agro.sync.queue.v1";

let fallbackIdCounter = 0;

export function createAgroLocalState(): AgroLocalState {
  return { version: 1, pendingEvents: [], syncStatus: "synced" };
}

export function createAgroEventId(now: Date = new Date()): string {
  return `agro_evt_${now.getTime().toString(36)}_${createSecureIdSegment()}`;
}

function createSecureIdSegment(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().replaceAll("-", "").slice(0, 16);
  }
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  fallbackIdCounter += 1;
  return `fallback_${Date.now().toString(36)}_${fallbackIdCounter.toString(36)}`;
}

function isAgroLocalState(value: unknown): value is AgroLocalState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgroLocalState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.pendingEvents) &&
    (candidate.syncStatus === "synced" ||
      candidate.syncStatus === "pending" ||
      candidate.syncStatus === "syncing" ||
      candidate.syncStatus === "failed")
  );
}

export function readAgroLocalState(storage: AgroStorageLike | undefined | null): AgroLocalState {
  if (!storage) return createAgroLocalState();
  try {
    const raw = storage.getItem(AGRO_LOCAL_STORE_KEY);
    if (!raw) return createAgroLocalState();
    const parsed = JSON.parse(raw) as unknown;
    return isAgroLocalState(parsed) ? parsed : createAgroLocalState();
  } catch {
    return createAgroLocalState();
  }
}

export function writeAgroLocalState(storage: AgroStorageLike | undefined | null, state: AgroLocalState): void {
  if (!storage) return;
  storage.setItem(AGRO_LOCAL_STORE_KEY, JSON.stringify(state));
}

export function clearAgroLocalState(storage: AgroStorageLike | undefined | null): void {
  if (!storage) return;
  storage.removeItem(AGRO_LOCAL_STORE_KEY);
}

export function hasAgroPendingWork(state: AgroLocalState): boolean {
  return state.pendingEvents.length > 0;
}

export function enqueueAgroEvent(
  state: AgroLocalState,
  input: { farmId: string; action: AgroSyncAction; payload: Record<string, unknown>; now?: Date },
): { state: AgroLocalState; event: AgroPendingEvent } {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const event: AgroPendingEvent = {
    id: createAgroEventId(now),
    farmId: input.farmId,
    action: input.action,
    payload: input.payload,
    occurredAt: timestamp,
    enqueuedAt: timestamp,
  };
  return {
    event,
    state: {
      ...state,
      pendingEvents: [...state.pendingEvents, event],
      syncStatus: "pending",
      lastError: undefined,
    },
  };
}

export function markAgroSyncing(state: AgroLocalState): AgroLocalState {
  return { ...state, syncStatus: "syncing", lastError: undefined };
}

export function markAgroSyncFailed(state: AgroLocalState, message: string): AgroLocalState {
  return { ...state, syncStatus: "failed", lastError: message };
}

/**
 * Quita del arreglo los eventos que el servidor ya resolvio (SYNCED o
 * DUPLICATE: ambos significan "no hace falta reenviarlo"). Los FAILED
 * permanentes (validacion, permisos) tambien se quitan -reintentarlos no
 * los arreglaria- pero se reportan en `permanentFailures` para que la UI
 * pueda avisar al usuario en vez de reintentarlos en silencio para siempre.
 */
export function applyAgroSyncResults(
  state: AgroLocalState,
  results: Array<{ clientEventId: string; status: "SYNCED" | "FAILED" | "DUPLICATE"; error?: string }>,
): { state: AgroLocalState; permanentFailures: Array<{ event: AgroPendingEvent; error?: string }> } {
  const byId = new Map(results.map((r) => [r.clientEventId, r]));
  const permanentFailures: Array<{ event: AgroPendingEvent; error?: string }> = [];

  const remaining = state.pendingEvents.filter((event) => {
    const result = byId.get(event.id);
    if (!result) return true; // no vino en la respuesta: se conserva, se reintenta
    if (result.status === "SYNCED" || result.status === "DUPLICATE") return false;
    permanentFailures.push({ event, error: result.error });
    return false;
  });

  const allResolved = remaining.length === 0;
  return {
    permanentFailures,
    state: {
      ...state,
      pendingEvents: remaining,
      syncStatus: allResolved ? "synced" : "pending",
      lastSyncedAt: allResolved ? new Date().toISOString() : state.lastSyncedAt,
      lastError: undefined,
    },
  };
}
