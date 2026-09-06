import { useEffect, useState } from "react";
import { API_BASE_URL, getAccessToken } from "./client";
import type { LiveSessionSnapshot } from "./liveSessions";

type LiveSessionEvent = {
  type: string;
  data: Partial<LiveSessionSnapshot> & { sessionId?: string; sessionVersion?: number };
};

export function useLiveSessionEvents(sessionId: string | null) {
  const [snapshot, setSnapshot] = useState<LiveSessionSnapshot | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSnapshot(null);
      return;
    }
    const controller = new AbortController();
    let active = true;

    void (async () => {
      const token = await getAccessToken();
      if (!token || !active) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/v1/prometeo/live-sessions/${encodeURIComponent(sessionId)}/events`,
          { headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` }, signal: controller.signal },
        );
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (active) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const type = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
            const data = frame.match(/^data:\s*(.+)$/m)?.[1];
            if (!type || !data || type === "keepalive") continue;
            try {
              const event = { type, data: JSON.parse(data) } as LiveSessionEvent;
              if (event.data.status) {
                setSnapshot((current) => current ? { ...current, status: event.data.status!, version: event.data.sessionVersion ?? current.version } : current);
              }
              if (event.type === "live_session.snapshot.v1" && event.data.id) setSnapshot(event.data as LiveSessionSnapshot);
            } catch { /* ignorar frames inválidos sin romper la sesión */ }
          }
        }
      } catch { /* la sesión sigue consultable aunque SSE no esté disponible */ }
    })();

    return () => { active = false; controller.abort(); };
  }, [sessionId]);

  return snapshot;
}
