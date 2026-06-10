"use client";

export interface NextActionItem {
  id: string;
  label: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  href?: string;
}

export function NextActionRail({ actions }: { actions: NextActionItem[] }) {
  return (
    <section style={{ display: "grid", gap: "10px" }}>
      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>Next actions</h3>
      <div style={{ display: "grid", gap: "8px" }}>
        {actions.map((action) => (
          <article
            key={action.id}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(148,163,184,0.18)",
              background:
                action.severity === "critical"
                  ? "rgba(239,68,68,0.08)"
                  : action.severity === "high"
                  ? "rgba(245,158,11,0.08)"
                  : "rgba(59,130,246,0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{action.label}</strong>
              <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "var(--muted)" }}>
                {action.severity}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>{action.reason}</p>
            {action.href ? (
              <a href={action.href} style={{ display: "inline-block", marginTop: "6px", fontSize: "11px", fontWeight: 700 }}>
                Open
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
