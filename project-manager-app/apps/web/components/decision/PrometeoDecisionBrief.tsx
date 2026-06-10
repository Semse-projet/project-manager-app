"use client";

export interface PrometeoDecisionBriefProps {
  summary: string;
  recommendation: "approve" | "reject" | "request_changes" | "investigate" | "no_action";
  confidence: number;
  evidenceUsed: string[];
  missingInputs: string[];
  risks: string[];
}

export function PrometeoDecisionBrief({
  summary,
  recommendation,
  confidence,
  evidenceUsed,
  missingInputs,
  risks,
}: PrometeoDecisionBriefProps) {
  return (
    <section style={{ display: "grid", gap: "10px" }}>
      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>Prometeo decision brief</h3>
      <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{summary}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
        <div><span style={{ fontSize: "10px", color: "var(--muted)" }}>Recommendation</span><div style={{ fontSize: "12px", fontWeight: 800 }}>{recommendation}</div></div>
        <div><span style={{ fontSize: "10px", color: "var(--muted)" }}>Confidence</span><div style={{ fontSize: "12px", fontWeight: 800 }}>{Math.round(confidence * 100)}%</div></div>
        <div><span style={{ fontSize: "10px", color: "var(--muted)" }}>Evidence</span><div style={{ fontSize: "12px", fontWeight: 800 }}>{evidenceUsed.length}</div></div>
      </div>
      {missingInputs.length > 0 ? (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Missing inputs</div>
          <ul style={{ margin: 0, paddingLeft: "16px", color: "var(--muted)", fontSize: "11px" }}>
            {missingInputs.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {risks.length > 0 ? (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Risks</div>
          <ul style={{ margin: 0, paddingLeft: "16px", color: "var(--muted)", fontSize: "11px" }}>
            {risks.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
