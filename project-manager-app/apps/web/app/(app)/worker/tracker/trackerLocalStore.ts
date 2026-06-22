export type TrackerEventType = "start" | "pause" | "resume" | "stop" | "update_note" | "manual_session";

export type TrackerPendingEvent =
  | {
      id: string;
      type: "start";
      localSessionId: string;
      jobId: string;
      notes?: string;
      localTimestamp: string;
    }
  | {
      id: string;
      type: "pause" | "resume";
      sessionId: string;
      notes?: string;
      localTimestamp: string;
    }
  | {
      id: string;
      type: "stop";
      sessionId: string;
      notes?: string;
      localTimestamp: string;
    }
  | {
      id: string;
      type: "update_note";
      sessionId: string;
      notes: string;
      localTimestamp: string;
    }
  | {
      id: string;
      type: "manual_session";
      jobId: string;
      date: string;
      startTime: string;
      endTime: string;
      notes?: string;
      localTimestamp: string;
    };

export type TrackerLocalSession = {
  id: string;
  backendSessionId?: string;
  jobId: string;
  jobTitle?: string;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  startedAt: string;
  resumedAt?: string;
  pausedAt?: string;
  stoppedAt?: string;
  accumulatedSeconds: number;
  notes?: string;
  updatedAt: string;
};

export type TrackerLocalState = {
  version: 1;
  activeSession: TrackerLocalSession | null;
  pendingEvents: TrackerPendingEvent[];
  lastSyncedAt?: string;
  syncStatus: "synced" | "pending" | "syncing" | "failed";
  lastError?: string;
};

export type TrackerStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const TRACKER_LOCAL_STORE_KEY = "semse.worker.tracker.failsafe.v1";

let fallbackIdCounter = 0;

export function createTrackerLocalState(): TrackerLocalState {
  return {
    version: 1,
    activeSession: null,
    pendingEvents: [],
    syncStatus: "synced",
  };
}

export function createTrackerEventId(now: Date = new Date()): string {
  return `evt_${now.getTime().toString(36)}_${createSecureIdSegment()}`;
}

export function createTrackerLocalSessionId(now: Date = new Date()): string {
  return `local_${now.getTime().toString(36)}_${createSecureIdSegment()}`;
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

export function isTrackerLocalState(value: unknown): value is TrackerLocalState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackerLocalState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.pendingEvents) &&
    (candidate.syncStatus === "synced" ||
      candidate.syncStatus === "pending" ||
      candidate.syncStatus === "syncing" ||
      candidate.syncStatus === "failed")
  );
}

export function readTrackerLocalState(storage: TrackerStorageLike | undefined | null): TrackerLocalState {
  if (!storage) return createTrackerLocalState();

  try {
    const raw = storage.getItem(TRACKER_LOCAL_STORE_KEY);
    if (!raw) return createTrackerLocalState();
    const parsed = JSON.parse(raw) as unknown;
    if (!isTrackerLocalState(parsed)) return createTrackerLocalState();

    return {
      ...parsed,
      lastError: normalizeUnknownText(parsed.lastError),
    };
  } catch {
    return createTrackerLocalState();
  }
}

export function writeTrackerLocalState(storage: TrackerStorageLike | undefined | null, state: TrackerLocalState): void {
  if (!storage) return;
  storage.setItem(TRACKER_LOCAL_STORE_KEY, JSON.stringify(state));
}

export function clearTrackerLocalState(storage: TrackerStorageLike | undefined | null): void {
  if (!storage) return;
  storage.removeItem(TRACKER_LOCAL_STORE_KEY);
}

export function hasTrackerLocalWork(state: TrackerLocalState): boolean {
  return Boolean(state.activeSession) || state.pendingEvents.length > 0;
}

export function enqueueTrackerEvent(state: TrackerLocalState, event: TrackerPendingEvent): TrackerLocalState {
  return {
    ...state,
    pendingEvents: [...state.pendingEvents, event],
    syncStatus: "pending",
    lastError: undefined,
  };
}

export function markTrackerSyncing(state: TrackerLocalState): TrackerLocalState {
  return {
    ...state,
    syncStatus: "syncing",
    lastError: undefined,
  };
}

export function markTrackerSyncFailed(state: TrackerLocalState, message: string): TrackerLocalState {
  return {
    ...state,
    syncStatus: "failed",
    lastError: message,
  };
}

export function markTrackerSynced(state: TrackerLocalState, syncedAt: string = new Date().toISOString()): TrackerLocalState {
  return {
    ...state,
    pendingEvents: [],
    activeSession: null,
    lastSyncedAt: syncedAt,
    syncStatus: "synced",
    lastError: undefined,
  };
}

export function startTrackerLocalSession(
  state: TrackerLocalState,
  input: {
    jobId: string;
    jobTitle?: string;
    notes?: string;
    now?: Date;
  },
): { state: TrackerLocalState; localSession: TrackerLocalSession; event: TrackerPendingEvent } {
  if (state.activeSession && state.activeSession.status !== "STOPPED") {
    throw new Error("Ya existe una sesión local activa.");
  }

  const now = input.now ?? new Date();
  const localTimestamp = now.toISOString();
  const localSessionId = createTrackerLocalSessionId(now);
  const localSession: TrackerLocalSession = {
    id: localSessionId,
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    status: "RUNNING",
    startedAt: localTimestamp,
    resumedAt: localTimestamp,
    accumulatedSeconds: 0,
    notes: normalizeOptionalText(input.notes),
    updatedAt: localTimestamp,
  };
  const event: TrackerPendingEvent = {
    id: createTrackerEventId(now),
    type: "start",
    localSessionId,
    jobId: input.jobId,
    notes: normalizeOptionalText(input.notes),
    localTimestamp,
  };

  return {
    localSession,
    event,
    state: enqueueTrackerEvent({ ...state, activeSession: localSession }, event),
  };
}

export function updateTrackerLocalSession(
  state: TrackerLocalState,
  event: TrackerPendingEvent,
): TrackerLocalState {
  const active = state.activeSession;
  const now = event.localTimestamp;

  if (!active) {
    return enqueueTrackerEvent(state, event);
  }

  if (event.type === "pause") {
    return enqueueTrackerEvent({
      ...state,
      activeSession: {
        ...active,
        status: "PAUSED",
        pausedAt: now,
        resumedAt: undefined,
        notes: normalizeOptionalText(event.notes) ?? active.notes,
        updatedAt: now,
      },
    }, event);
  }

  if (event.type === "resume") {
    return enqueueTrackerEvent({
      ...state,
      activeSession: {
        ...active,
        status: "RUNNING",
        resumedAt: now,
        notes: normalizeOptionalText(event.notes) ?? active.notes,
        updatedAt: now,
      },
    }, event);
  }

  if (event.type === "stop") {
    return enqueueTrackerEvent({
      ...state,
      activeSession: {
        ...active,
        status: "STOPPED",
        stoppedAt: now,
        resumedAt: undefined,
        notes: normalizeOptionalText(event.notes) ?? active.notes,
        updatedAt: now,
      },
    }, event);
  }

  if (event.type === "update_note") {
    return enqueueTrackerEvent({
      ...state,
      activeSession: {
        ...active,
        notes: event.notes,
        updatedAt: now,
      },
    }, event);
  }

  return enqueueTrackerEvent(state, event);
}

export function normalizeOptionalText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function normalizeUnknownText(value: unknown): string | undefined {
  if (typeof value === "string") return normalizeOptionalText(value);

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeUnknownText(item))
      .filter((item): item is string => Boolean(item));
    return normalized.length > 0 ? normalized.join(" ") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      normalizeUnknownText(record.message) ??
      normalizeUnknownText(record.error) ??
      normalizeUnknownText(record.detail) ??
      normalizeUnknownText(record.details)
    );
  }

  return undefined;
}
