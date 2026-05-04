"use client";

import { useState } from "react";
import {
  assistantConfirmDraft,
  assistantPublishFromDraft,
  type ProjectDraftSnapshot,
  type AssistantBudgetSuggestion,
} from "../../app/semse-api";

const CATEGORY_LABELS: Record<string, string> = {
  electricidad: "Electricidad", pintura: "Pintura", pisos: "Pisos",
  plomeria: "Plomería", carpinteria: "Carpintería", jardineria: "Jardinería",
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  instalacion_elec: "Instalación eléctrica", panel: "Panel eléctrico", iluminacion: "Iluminación",
  interior: "Pintura interior", exterior: "Pintura exterior", decorativa: "Pintura decorativa",
  instalacion_piso: "Instalación de pisos", pulido: "Pulido", ceramica: "Cerámica",
  reparacion: "Reparación", instalacion: "Instalación", destapado: "Destapado",
  muebles: "Muebles", puertas: "Puertas", remodelacion: "Remodelación",
  mantenimiento: "Mantenimiento", diseno: "Diseño", poda: "Poda",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#a3e635", medium: "#f59e0b", low: "#f87171",
};

function DraftRow({ label, value, icon }: { label: string; value: string | null | undefined; icon?: string }) {
  const hasValue = Boolean(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{icon ? `${icon} ` : ""}{label}</span>
      <span style={{ fontSize: 12, color: hasValue ? "#a3e635" : "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 4 }}>
        {hasValue ? <>{value} <span style={{ color: "#a3e635", fontSize: 10 }}>✓</span></> : <span style={{ fontStyle: "italic" }}>— pendiente</span>}
      </span>
    </div>
  );
}

type Props = {
  draft: ProjectDraftSnapshot;
  prefillHref: string;
  budgetSuggestion?: AssistantBudgetSuggestion;
  onConfirmed?: (prefillHref: string) => void;
  onPublished?: (jobUrl: string) => void;
};

export function DraftPreviewCard({ draft, prefillHref, budgetSuggestion, onConfirmed, onPublished }: Props) {
  const [localDraft, setLocalDraft] = useState(draft);
  const [localHref, setLocalHref] = useState(prefillHref);
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(
    draft.status === "published" && draft.publishedJobId ? `/client/jobs/${draft.publishedJobId}` : null,
  );

  const completion = localDraft.completion ?? 0;
  const isConfirmed = localDraft.status === "confirmed" || localDraft.status === "published";
  const isPublished = localDraft.status === "published";
  const readyToFill = completion >= 70;

  const budgetLabel = localDraft.budgetMin != null && localDraft.budgetMax != null
    ? `$${localDraft.budgetMin.toLocaleString()} – $${localDraft.budgetMax.toLocaleString()}`
    : localDraft.budgetMin != null
    ? `Desde $${localDraft.budgetMin.toLocaleString()}`
    : null;

  async function handleConfirm() {
    setConfirming(true);
    try {
      const result = await assistantConfirmDraft(localDraft.id);
      setLocalDraft(result.draft);
      setLocalHref(result.prefillHref);
      onConfirmed?.(result.prefillHref);
    } catch { /* silent */ } finally {
      setConfirming(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const result = await assistantPublishFromDraft(localDraft.id);
      setLocalDraft(result.draft);
      setPublishedUrl(result.jobUrl);
      onPublished?.(result.jobUrl);
    } catch { /* silent */ } finally {
      setPublishing(false);
    }
  }

  if (isPublished && publishedUrl) {
    return (
      <div style={{
        marginTop: 12, background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(163, 230, 53, 0.6)", borderRadius: 14,
        padding: "16px", width: "100%", maxWidth: 420, textAlign: "center",
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#a3e635", marginBottom: 4 }}>
          ¡Trabajo publicado!
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
          Tu trabajo ya está visible para profesionales de la zona.
        </div>
        <button
          type="button"
          onClick={() => { window.location.href = publishedUrl; }}
          style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #a3e635, #65a30d)",
            color: "#0a0f1e", fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}
        >
          Ver mi trabajo →
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 12, background: "rgba(15, 23, 42, 0.95)",
      border: `1px solid ${isConfirmed ? "rgba(163, 230, 53, 0.5)" : "rgba(163, 230, 53, 0.25)"}`,
      borderRadius: 14, padding: "14px 16px", width: "100%", maxWidth: 420,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#a3e635", textTransform: "uppercase", letterSpacing: 1 }}>
          Borrador del proyecto
        </span>
        {isConfirmed && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#a3e635", background: "rgba(163,230,53,0.15)", padding: "2px 8px", borderRadius: 20 }}>
            ✓ Confirmado
          </span>
        )}
      </div>

      <DraftRow label="Categoría" value={localDraft.categoryId ? (CATEGORY_LABELS[localDraft.categoryId] ?? localDraft.categoryId) : null} />
      <DraftRow label="Especialidad" value={localDraft.subcategoryId ? (SUBCATEGORY_LABELS[localDraft.subcategoryId] ?? localDraft.subcategoryId) : null} />
      <DraftRow label="Título" value={localDraft.title} />
      <DraftRow label="Descripción" value={localDraft.description ? `${localDraft.description.slice(0, 60)}${localDraft.description.length > 60 ? "..." : ""}` : null} />
      <DraftRow label="Ciudad" value={localDraft.city} />
      <DraftRow label="Presupuesto" value={budgetLabel} />
      {localDraft.attachmentsExpected && (
        <DraftRow label="Archivos" icon="📷" value="Pendiente de subir en el formulario" />
      )}

      {budgetSuggestion && budgetSuggestion.min > 0 && !budgetLabel && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.2)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Rango estimado (IA)</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: CONFIDENCE_COLORS[budgetSuggestion.confidence] ?? "#f59e0b", background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 10 }}>
              {budgetSuggestion.confidence === "high" ? "Alta confianza" : budgetSuggestion.confidence === "medium" ? "Media confianza" : "Baja confianza"}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#a3e635" }}>
            ${budgetSuggestion.min.toLocaleString()} – ${budgetSuggestion.max.toLocaleString()}
          </div>
          {budgetSuggestion.aiNarrative && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, lineHeight: 1.4 }}>
              {budgetSuggestion.aiNarrative.slice(0, 120)}{budgetSuggestion.aiNarrative.length > 120 ? "..." : ""}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Completado</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: readyToFill ? "#a3e635" : "#f97316" }}>{completion}%</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${completion}%`,
            background: readyToFill ? "linear-gradient(90deg, #a3e635, #65a30d)" : "linear-gradient(90deg, #f97316, #ea580c)",
            borderRadius: 4, transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {readyToFill && !isConfirmed && (
        <button
          type="button" onClick={() => void handleConfirm()} disabled={confirming}
          style={{
            marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10,
            border: "1px solid rgba(163,230,53,0.4)", background: "rgba(163,230,53,0.1)",
            color: "#a3e635", fontSize: 13, fontWeight: 700,
            cursor: confirming ? "not-allowed" : "pointer", opacity: confirming ? 0.6 : 1,
          }}
        >
          {confirming ? "Confirmando..." : "Confirmar borrador ✓"}
        </button>
      )}

      {isConfirmed && (
        <button
          type="button" onClick={() => void handlePublish()} disabled={publishing}
          style={{
            marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
            background: publishing ? "rgba(163,230,53,0.4)" : "linear-gradient(135deg, #a3e635, #65a30d)",
            color: "#0a0f1e", fontSize: 13, fontWeight: 800,
            cursor: publishing ? "not-allowed" : "pointer",
          }}
        >
          {publishing ? "Publicando..." : "Publicar trabajo ✦"}
        </button>
      )}

      {readyToFill && (
        <button
          type="button" onClick={() => { window.location.href = localHref; }}
          style={{
            marginTop: 6, width: "100%", padding: "8px 0", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
            color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          Revisar en formulario →
        </button>
      )}
    </div>
  );
}
