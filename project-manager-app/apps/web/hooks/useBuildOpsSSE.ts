"use client";

import { useEffect, useRef } from "react";

export type EvidenceUpdatedEvent   = { type: "evidence-item:updated";  milestoneId: string; itemId: string; status: string; updatedAt: string };
export type EvidenceReviewedEvent  = { type: "evidence-item:reviewed"; milestoneId: string; itemId: string; reviewStatus: string; riskLevel: string; reviewedAt: string };
export type ChangeOrderUpdatedEvent = { type: "change-order:updated"; changeOrderId: string; status: string; milestoneId?: string; buildOpsProjectId?: string; costDeltaAvg?: number };
export type ChangeOrderAppliedEvent = { type: "change-order:applied"; changeOrderId: string; status: string; milestoneId?: string; buildOpsProjectId?: string; costDeltaAvg?: number; riskLevel?: string; applied: boolean };
export type OperationalSignalEvent  = { type: "operational-signal:created"; id: string; severity: string; milestoneId?: string; buildOpsProjectId?: string };
export type KeepaliveEvent = { type: "keepalive" };

export type BuildOpsSSEEvent =
  | EvidenceUpdatedEvent
  | EvidenceReviewedEvent
  | ChangeOrderUpdatedEvent
  | ChangeOrderAppliedEvent
  | OperationalSignalEvent
  | KeepaliveEvent;

type Options = {
  /** Called whenever a relevant event arrives */
  onEvent: (event: BuildOpsSSEEvent) => void;
  /** Optional: only process events for these milestoneIds */
  milestoneIds?: string[];
  enabled?: boolean;
};

/**
 * Subscribe to the BuildOps SSE channel.
 * Reconnects automatically on disconnect (max 5 retries, exponential backoff).
 * Safe to use in pages that also do manual refresh — the callback just signals
 * that something changed; the caller decides what to re-fetch.
 */
export function useBuildOpsSSE({ onEvent, milestoneIds, enabled = true }: Options) {
  const onEventRef  = useRef(onEvent);
  const milestoneRef = useRef(milestoneIds);

  // Keep refs in sync without re-subscribing
  useEffect(() => { onEventRef.current  = onEvent; }, [onEvent]);
  useEffect(() => { milestoneRef.current = milestoneIds; }, [milestoneIds]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource("/api/semse/sse/buildops");

      function handleRaw(event: MessageEvent, type: string) {
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          const evt = { type, ...data } as BuildOpsSSEEvent;

          // Filter by milestoneId if specified
          const mids = milestoneRef.current;
          if (mids && mids.length > 0) {
            const evtMid = (data as Record<string, unknown>).milestoneId;
            if (typeof evtMid === "string" && !mids.includes(evtMid)) return;
          }

          onEventRef.current(evt);
        } catch { /* ignore malformed events */ }
      }

      es.addEventListener("evidence-item:updated",      (e) => handleRaw(e, "evidence-item:updated"));
      es.addEventListener("evidence-item:reviewed",      (e) => handleRaw(e, "evidence-item:reviewed"));
      es.addEventListener("change-order:updated",        (e) => handleRaw(e, "change-order:updated"));
      es.addEventListener("change-order:applied",        (e) => handleRaw(e, "change-order:applied"));
      es.addEventListener("operational-signal:created",  (e) => handleRaw(e, "operational-signal:created"));

      es.onerror = () => {
        es?.close();
        es = null;
        if (retries >= 5) return; // give up after 5 retries
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        retries++;
        timer = setTimeout(connect, delay);
      };

      es.onopen = () => { retries = 0; };
    }

    connect();
    return () => {
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [enabled]);
}
