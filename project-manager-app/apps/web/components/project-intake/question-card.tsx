"use client";

import { useState } from "react";
import type { IntakeAnswerInput, IntakeQuestion, IntakeWarning } from "../../lib/smart-intake";
import { WarningBanner } from "./warning-banner";

function optionStyle(selected: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${selected ? "rgba(79,70,229,.4)" : "var(--border)"}`,
    background: selected ? "rgba(79,70,229,.08)" : "#fff",
    color: selected ? "#4338ca" : "#334155",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
}

export function QuestionCard({
  question,
  language,
  warnings,
  onAnswer,
  isSubmitting,
}: {
  question: IntakeQuestion | null;
  language: "es" | "en";
  warnings: IntakeWarning[];
  onAnswer: (answer: IntakeAnswerInput) => void;
  isSubmitting: boolean;
}) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [isNotSure, setIsNotSure] = useState(false);

  if (!question) {
    return (
      <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid rgba(37,99,235,.12)", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
        No hay mas preguntas por ahora. Ya puedes revisar el estimate o continuar al wizard.
      </div>
    );
  }

  const inlineWarning = question.warningIfSelected
    ? warnings.find((warning) => warning.id === question.warningIfSelected?.warningId && selectedValues.includes(question.warningIfSelected.optionValue))
    : null;
  const showOther = selectedValues.includes("other") || (question.allowOther && selectedValues.length === 0 && customText.length > 0);

  return (
    <div style={{ display: "grid", gap: 12, padding: 16, borderRadius: 16, background: "#fff", border: "1px solid rgba(37,99,235,.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", marginBottom: 6 }}>Pregunta {question.step}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
            {language === "es" ? question.label.es : question.label.en}
          </div>
          {question.description ? (
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
              {language === "es" ? question.description.es : question.description.en}
            </div>
          ) : null}
        </div>
        {question.estimateImpact ? (
          <div style={{ whiteSpace: "nowrap", padding: "4px 8px", borderRadius: 999, background: "rgba(37,99,235,.08)", color: "#2563eb", fontSize: 10, fontWeight: 800 }}>
            {question.estimateImpact === "high" ? "High impact" : question.estimateImpact === "medium" ? "Medium impact" : "Low impact"}
          </div>
        ) : null}
      </div>

      {question.options ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {question.options.map((option) => {
            const selected = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setIsNotSure(false);
                  setSelectedValues([option.value]);
                }}
                style={optionStyle(selected)}
              >
                {language === "es" ? option.label.es : option.label.en}
              </button>
            );
          })}
          {question.allowNotSure ? (
            <button
              type="button"
              onClick={() => {
                setSelectedValues([]);
                setCustomText("");
                setIsNotSure(true);
              }}
              style={optionStyle(isNotSure)}
            >
              {language === "es" ? "No estoy seguro" : "Not sure"}
            </button>
          ) : null}
          {question.allowOther ? (
            <button
              type="button"
              onClick={() => {
                setIsNotSure(false);
                setSelectedValues(["other"]);
              }}
              style={optionStyle(selectedValues.includes("other"))}
            >
              {language === "es" ? "Otro" : "Other"}
            </button>
          ) : null}
        </div>
      ) : null}

      {showOther ? (
        <textarea
          value={customText}
          onChange={(event) => setCustomText(event.target.value)}
          placeholder={language === "es" ? "Agrega el detalle aqui" : "Add detail here"}
          style={{
            width: "100%",
            minHeight: 90,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            resize: "vertical",
          }}
        />
      ) : null}

      {inlineWarning ? <WarningBanner warning={inlineWarning} language={language} /> : null}

      {question.tip ? (
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, padding: 12, borderRadius: 12, background: "rgba(148,163,184,.08)" }}>
          {language === "es" ? question.tip.es : question.tip.en}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          disabled={isSubmitting || (!isNotSure && selectedValues.length === 0) || (selectedValues.includes("other") && !customText.trim())}
          onClick={() => onAnswer({
            questionId: question.id,
            selectedValues,
            customText: customText.trim() || undefined,
            isNotSure,
          })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(79,70,229,.16)",
            background: "rgba(79,70,229,.08)",
            color: "#4f46e5",
            fontWeight: 800,
            cursor: isSubmitting ? "wait" : "pointer",
            opacity: isSubmitting || (!isNotSure && selectedValues.length === 0) ? 0.55 : 1,
          }}
        >
          {isSubmitting ? (language === "es" ? "Guardando..." : "Saving...") : (language === "es" ? "Guardar respuesta" : "Save answer")}
        </button>
      </div>
    </div>
  );
}

