"use client";

import type { IntakeWarning } from "../../lib/smart-intake";

const WARNING_COLOR: Record<IntakeWarning["severity"], { border: string; bg: string; text: string }> = {
  info: { border: "rgba(37,99,235,.22)", bg: "rgba(37,99,235,.08)", text: "#1d4ed8" },
  caution: { border: "rgba(245,158,11,.25)", bg: "rgba(245,158,11,.08)", text: "#b45309" },
  critical: { border: "rgba(239,68,68,.25)", bg: "rgba(239,68,68,.08)", text: "#b91c1c" },
};

export function WarningBanner({
  warning,
  language,
}: {
  warning: IntakeWarning;
  language: "es" | "en";
}) {
  const tone = WARNING_COLOR[warning.severity];
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${tone.border}`, background: tone.bg, color: tone.text }}>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>{warning.severity}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{language === "es" ? warning.message.es : warning.message.en}</div>
      {warning.recommendation ? (
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
          {language === "es" ? warning.recommendation.es : warning.recommendation.en}
        </div>
      ) : null}
    </div>
  );
}

