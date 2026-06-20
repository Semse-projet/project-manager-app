import assert from "node:assert/strict";
import test from "node:test";

import {
  TRACKER_LOCAL_STORE_KEY,
  createTrackerEventId,
  createTrackerLocalState,
  enqueueTrackerEvent,
  markTrackerSyncFailed,
  markTrackerSynced,
  readTrackerLocalState,
  startTrackerLocalSession,
  updateTrackerLocalSession,
  writeTrackerLocalState,
  type TrackerStorageLike,
} from "../../apps/web/app/(app)/worker/tracker/trackerLocalStore.ts";

class MemoryStorage implements TrackerStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test("tracker local store persists and restores pending state", () => {
  const storage = new MemoryStorage();
  const started = startTrackerLocalSession(createTrackerLocalState(), {
    jobId: "job_1",
    jobTitle: "Kitchen remodel",
    notes: "Started framing",
    now: new Date("2026-06-20T12:00:00.000Z"),
  });

  writeTrackerLocalState(storage, started.state);
  const restored = readTrackerLocalState(storage);

  assert.equal(restored.activeSession?.jobId, "job_1");
  assert.equal(restored.activeSession?.status, "RUNNING");
  assert.equal(restored.pendingEvents.length, 1);
  assert.equal(restored.pendingEvents[0]?.type, "start");
  assert.ok(storage.getItem(TRACKER_LOCAL_STORE_KEY));
});

test("tracker local store prevents a double local start", () => {
  const started = startTrackerLocalSession(createTrackerLocalState(), {
    jobId: "job_1",
    now: new Date("2026-06-20T12:00:00.000Z"),
  });

  assert.throws(
    () => startTrackerLocalSession(started.state, { jobId: "job_2", now: new Date("2026-06-20T12:01:00.000Z") }),
    /sesión local activa/i,
  );
});

test("tracker local store queues offline note updates without dropping active session", () => {
  const started = startTrackerLocalSession(createTrackerLocalState(), {
    jobId: "job_1",
    now: new Date("2026-06-20T12:00:00.000Z"),
  });

  const updated = updateTrackerLocalSession(started.state, {
    id: createTrackerEventId(new Date("2026-06-20T12:05:00.000Z")),
    type: "update_note",
    sessionId: started.localSession.id,
    notes: "Installed baseboard and patched drywall corner",
    localTimestamp: "2026-06-20T12:05:00.000Z",
  });

  assert.equal(updated.activeSession?.notes, "Installed baseboard and patched drywall corner");
  assert.equal(updated.pendingEvents.length, 2);
  assert.equal(updated.syncStatus, "pending");
});

test("tracker local store keeps queue when sync fails and clears it when sync succeeds", () => {
  const queued = enqueueTrackerEvent(createTrackerLocalState(), {
    id: "evt_manual",
    type: "manual_session",
    jobId: "job_1",
    date: "2026-06-20",
    startTime: "09:00",
    endTime: "11:00",
    notes: "Offline manual entry",
    localTimestamp: "2026-06-20T16:00:00.000Z",
  });

  const failed = markTrackerSyncFailed(queued, "Network unavailable");
  assert.equal(failed.pendingEvents.length, 1);
  assert.equal(failed.syncStatus, "failed");
  assert.equal(failed.lastError, "Network unavailable");

  const synced = markTrackerSynced(failed, "2026-06-20T16:05:00.000Z");
  assert.equal(synced.pendingEvents.length, 0);
  assert.equal(synced.activeSession, null);
  assert.equal(synced.syncStatus, "synced");
  assert.equal(synced.lastSyncedAt, "2026-06-20T16:05:00.000Z");
});

test("tracker local store normalizes object-shaped persisted errors", () => {
  const storage = new MemoryStorage();
  storage.setItem(TRACKER_LOCAL_STORE_KEY, JSON.stringify({
    version: 1,
    activeSession: null,
    pendingEvents: [],
    syncStatus: "failed",
    lastError: { message: "Backend unavailable" },
  }));

  const restored = readTrackerLocalState(storage);

  assert.equal(restored.lastError, "Backend unavailable");
});
