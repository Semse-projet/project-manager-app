"use client";

export interface TrustLedgerEvent {
  id: string;
  label: string;
  happenedAt: string;
  detail?: string;
}

export function TrustLedgerTimeline({ events }: { events: TrustLedgerEvent[] }) {
  return (
    <section style={{ display: "grid", gap: "10px" }}>
      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>Trust ledger</h3>
      <div style={{ display: "grid", gap: "8px" }}>
        {events.map((event) => (
          <article key={event.id} style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{event.label}</strong>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>{event.happenedAt}</span>
            </div>
            {event.detail ? <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>{event.detail}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
