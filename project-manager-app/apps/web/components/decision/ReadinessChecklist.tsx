"use client";

export interface ReadinessChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  source?: string;
}

export interface ReadinessChecklistProps {
  title?: string;
  items: ReadinessChecklistItem[];
}

export function ReadinessChecklist({ title = "Readiness checklist", items }: ReadinessChecklistProps) {
  return (
    <section style={{ display: "grid", gap: "10px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>{title}</h3>
        <span style={{ fontSize: "11px", color: "var(--muted)" }}>{items.length} checks</span>
      </header>
      <div style={{ display: "grid", gap: "8px" }}>
        {items.map((item) => (
          <div
            key={item.key}
            style={{
              display: "grid",
              gap: "3px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(148,163,184,0.18)",
              background: item.passed ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
                {item.passed ? "✓" : "•"} {item.label}
              </span>
              <span style={{ fontSize: "10px", color: item.passed ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                {item.passed ? "PASS" : "BLOCKED"}
              </span>
            </div>
            {item.source ? (
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>{item.source}</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
