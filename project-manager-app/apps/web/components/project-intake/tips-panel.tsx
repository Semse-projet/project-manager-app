"use client";

import type { BilingualString } from "../../lib/smart-intake";

export function TipsPanel({
  tips,
  language,
}: {
  tips: BilingualString[];
  language: "es" | "en";
}) {
  return (
    <div style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,.72)", border: "1px solid rgba(37,99,235,.12)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Tips</div>
      {tips.length === 0 ? (
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          Responde una o dos preguntas mas para que aparezcan recomendaciones mas especificas.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {tips.map((tip, index) => (
            <div key={`${tip.en}-${index}`} style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
              {language === "es" ? tip.es : tip.en}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

