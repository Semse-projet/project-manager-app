"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle, ExternalLink, MapPin, Sparkles, Star, Upload, Users } from "lucide-react";
import {
  buildJobIntakeHref,
  JOB_CATEGORIES,
  JOB_URGENCY_OPTIONS,
  SMART_INTAKE_CATEGORY_IDS,
  type JobLocationType,
} from "../../lib/job-intake";
import { useIntake } from "../../hooks/use-intake";
import { AccuracyMeter } from "../project-intake/accuracy-meter";
import { LiveScopeSummary } from "../project-intake/live-scope-summary";
import { MilestonePreview } from "../project-intake/milestone-preview";
import { PreliminaryEstimateCard } from "../project-intake/preliminary-estimate-card";
import { QuestionCard } from "../project-intake/question-card";
import { TipsPanel } from "../project-intake/tips-panel";
import { WarningBanner } from "../project-intake/warning-banner";

function optionCard(selected: boolean, accent = "#2563eb"): CSSProperties {
  return {
    padding: "14px",
    borderRadius: 12,
    cursor: "pointer",
    textAlign: "left",
    border: `1.5px solid ${selected ? accent : "var(--border)"}`,
    background: selected ? `${accent}14` : "var(--surface)",
    transition: "all 0.15s",
  };
}

type RecommendedProfessional = {
  userId: string;
  displayName: string;
  publicSlug: string | null;
  email: string;
  score: number;
  percentileRank: number;
  verificationStatus: string;
  trustScore: number;
  avgRating: number;
  totalRatings: number;
  completedJobs: number;
  completedProjects: number;
  verifiedAt: string | null;
  specialties: string[];
  badges: string[];
  specialtySignal: number;
  matchReason: string;
};

const LEGACY_DESCRIPTION_MIN = 20;

export function LandingIntake() {
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<JobLocationType>("on_site");
  const [city, setCity] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [recommendedPros, setRecommendedPros] = useState<RecommendedProfessional[]>([]);
  const [selectedProfessionalUserId, setSelectedProfessionalUserId] = useState<string>("");
  const [legacyBudget, setLegacyBudget] = useState<{
    min: number;
    max: number;
    median: number;
    currency: string;
    confidence: string;
    similarJobsFound: number;
    aiNarrative: string;
  } | null>(null);
  const [legacyBudgetLoading, setLegacyBudgetLoading] = useState(false);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [lastLegacyAnalysisKey, setLastLegacyAnalysisKey] = useState<string | null>(null);

  const {
    intakeId,
    intake,
    nextQuestion,
    warnings,
    tips,
    liveSummary,
    estimate,
    milestones,
    estimateUnlocked,
    isLoading: intakeLoading,
    analyzeDescription,
    submitAnswer,
    uploadImages,
    requestEstimate,
  } = useIntake();

  const category = useMemo(() => JOB_CATEGORIES.find((item) => item.id === categoryId), [categoryId]);
  const isSmartIntakeCategory = SMART_INTAKE_CATEGORY_IDS.has(categoryId);
  const legacyAnalysisKey = JSON.stringify([categoryId, subcategoryId, title.trim(), description.trim(), city.trim()]);
  const legacyAnalysisIsFresh = lastLegacyAnalysisKey === legacyAnalysisKey;
  const visibleLegacyBudget = useMemo(
    () => (legacyAnalysisIsFresh ? legacyBudget : null),
    [legacyAnalysisIsFresh, legacyBudget],
  );
  const visibleRecommendedPros = useMemo(
    () => (legacyAnalysisIsFresh ? recommendedPros : []),
    [legacyAnalysisIsFresh, recommendedPros],
  );
  const selectedProfessional = visibleRecommendedPros.find((professional) => professional.userId === selectedProfessionalUserId)
    ?? visibleRecommendedPros[0]
    ?? null;
  const nextHref = buildJobIntakeHref({
    source: "landing",
    intakeId: isSmartIntakeCategory ? intakeId ?? undefined : undefined,
    categoryId,
    subcategoryId,
    title,
    description,
    locationType,
    city,
    urgency,
    budgetType: "range",
    budgetMin: estimate?.totalRange.min ?? visibleLegacyBudget?.min,
    budgetMax: estimate?.totalRange.max ?? visibleLegacyBudget?.max,
    step: 3,
    preferredProfessionalUserId: selectedProfessional?.userId,
    preferredProfessionalName: selectedProfessional?.displayName,
    preferredProfessionalSlug: selectedProfessional?.publicSlug ?? undefined,
  });

  useEffect(() => {
    if (!isSmartIntakeCategory || description.trim().length < 10 || title.trim().length < 3) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void analyzeDescription({
        rawDescription: description,
        title,
        category: categoryId,
        subcategory: subcategoryId,
        modality: locationType,
        city,
        urgency: urgency as "low" | "medium" | "high" | "urgent",
      }).catch(() => {
        // Surface errors through the estimate/request flows instead of every debounce tick.
      });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    analyzeDescription,
    categoryId,
    city,
    description,
    isSmartIntakeCategory,
    locationType,
    subcategoryId,
    title,
    urgency,
  ]);

  useEffect(() => {
    if (!legacyAnalysisIsFresh || visibleRecommendedPros.length === 0) return;
    const stillExists = visibleRecommendedPros.some((professional) => professional.userId === selectedProfessionalUserId);
    if (!stillExists) {
      setSelectedProfessionalUserId(visibleRecommendedPros[0]?.userId ?? "");
    }
  }, [legacyAnalysisIsFresh, selectedProfessionalUserId, visibleRecommendedPros]);

  async function fetchProfessionalPreview() {
    const payload = {
      title,
      scope: description,
      category: categoryId || undefined,
      subcategory: subcategoryId || undefined,
      location: city || undefined,
      limit: 3,
    };

    const professionalsResponse = await fetch("/api/semse/public/professionals/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const professionalsJson = await professionalsResponse.json() as {
      data?: { candidates?: RecommendedProfessional[] };
      error?: { message?: string };
    };

    if (!professionalsResponse.ok || !professionalsJson.data) {
      throw new Error(professionalsJson.error?.message ?? "No se pudieron sugerir profesionales.");
    }

    setRecommendedPros(professionalsJson.data.candidates ?? []);
    setSelectedProfessionalUserId(professionalsJson.data.candidates?.[0]?.userId ?? "");
    return professionalsJson.data.candidates ?? [];
  }

  async function runLegacyPreview() {
    if (!title.trim() || description.trim().length < LEGACY_DESCRIPTION_MIN) return;
    setLegacyBudgetLoading(true);
    setLegacyError(null);
    try {
      const nextAnalysisKey = legacyAnalysisKey;
      const payload = {
        title,
        scope: description,
        category: categoryId || undefined,
        subcategory: subcategoryId || undefined,
        location: city || undefined,
        limit: 3,
      };
      const budgetResponse = await fetch("/api/semse/public/budget/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const budgetJson = await budgetResponse.json() as {
        data?: {
          min: number;
          max: number;
          median: number;
          currency: string;
          confidence: string;
          similarJobsFound: number;
          aiNarrative: string;
        };
        error?: { message?: string };
      };

      if (!budgetResponse.ok || !budgetJson.data) {
        throw new Error(budgetJson.error?.message ?? "No se pudo calcular la estimacion.");
      }

      await fetchProfessionalPreview();
      setLegacyBudget(budgetJson.data);
      setLastLegacyAnalysisKey(nextAnalysisKey);
    } catch (error) {
      setLegacyError(error instanceof Error ? error.message : "No se pudo calcular la estimacion.");
    } finally {
      setLegacyBudgetLoading(false);
    }
  }

  async function runSmartPreview() {
    setLegacyBudgetLoading(true);
    setLegacyError(null);
    try {
      await requestEstimate();
      await fetchProfessionalPreview();
      setLastLegacyAnalysisKey(legacyAnalysisKey);
    } catch (error) {
      setLegacyError(error instanceof Error ? error.message : "No se pudo calcular la estimacion.");
    } finally {
      setLegacyBudgetLoading(false);
    }
  }

  async function runPreview() {
    if (isSmartIntakeCategory) {
      await runSmartPreview();
      return;
    }
    await runLegacyPreview();
  }

  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 72px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
          padding: 24,
          borderRadius: 24,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "0 20px 60px rgba(15,23,42,.08)",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 8 }}>
              Brief inicial
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
              Describe tu trabajo y entra al wizard real
            </h2>
            <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
              Selecciona una categoría y describe el trabajo. El wizard inteligente aplica a Pintura, Drywall, Baño, Cocina, Limpieza y Carpintería.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {[
                {
                  label: "🎨 Pintar sala",
                  cat: "pintura",
                  sub: "interior",
                  title: "Pintura de sala y comedor",
                  desc: "Necesito pintar las paredes de la sala y el comedor, aproximadamente 45 metros cuadrados. Se requiere resanar un par de grietas menores y aplicar dos manos de pintura látex satinada.",
                },
                {
                  label: "🧱 Hueco en drywall",
                  cat: "drywall",
                  sub: "reparacion",
                  title: "Reparación de agujero en drywall",
                  desc: "Tengo un hueco en la pared de drywall debido a un golpe, de unos 15x15 cm. Necesito colocar un parche, encintar, aplicar compuesto y dejar listo para pintar.",
                },
                {
                  label: "🚽 Renovar baño",
                  cat: "bano",
                  sub: "cosmetico",
                  title: "Actualización de baño de visitas",
                  desc: "Necesito cambiar el inodoro, el lavamanos antiguo y el grifo de agua. También colocar espejo nuevo y cambiar 4 azulejos rotos en el área de la ducha.",
                },
              ].map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => {
                    setCategoryId(prompt.cat);
                    setSubcategoryId(prompt.sub);
                    setTitle(prompt.title);
                    setDescription(prompt.desc);
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: 12,
                    background: "var(--brand-dim)",
                    border: "1px solid var(--brand-dim)",
                    color: "var(--brand)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>Categoria</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {JOB_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(item.id);
                    setSubcategoryId("");
                  }}
                  style={optionCard(categoryId === item.id)}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{item.subcategories.length} especialidades</div>
                </button>
              ))}
            </div>
          </div>

          {category ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>Especialidad</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
                {category.subcategories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSubcategoryId(item.id)}
                    style={{ ...optionCard(subcategoryId === item.id), display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>desde ${item.basePrice.toLocaleString("en-US")}</div>
                    </div>
                    {subcategoryId === item.id ? <CheckCircle size={15} color="var(--brand)" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Titulo</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej: Renovacion de bano principal"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Descripcion</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Que necesitas, dimensiones, materiales, problema actual y expectativas."
                style={{
                  width: "100%",
                  minHeight: 112,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  resize: "vertical",
                }}
              />
              <div style={{ fontSize: 11, color: description.trim().length >= (isSmartIntakeCategory ? 10 : LEGACY_DESCRIPTION_MIN) ? "var(--muted)" : "var(--error)", marginTop: 6 }}>
                {description.trim().length}/{isSmartIntakeCategory ? 10 : LEGACY_DESCRIPTION_MIN} caracteres minimo
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Modalidad</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))", gap: 8 }}>
                {([
                  { value: "on_site" as const, label: "Sitio" },
                  { value: "remote" as const, label: "Remoto" },
                  { value: "hybrid" as const, label: "Hibrido" },
                ]).map((item) => (
                  <button key={item.value} type="button" onClick={() => setLocationType(item.value)} style={optionCard(locationType === item.value, "#0f766e")}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{item.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Ciudad</label>
              <div style={{ position: "relative" }}>
                <MapPin size={14} color="var(--muted)" style={{ position: "absolute", left: 12, top: 13 }} />
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Ej: Miami, FL"
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 34px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>Urgencia</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {JOB_URGENCY_OPTIONS.map((item) => (
                <button key={item.value} type="button" onClick={() => setUrgency(item.value)} style={optionCard(urgency === item.value, item.color)}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{item.description}</div>
                </button>
              ))}
            </div>
          </div>

          {isSmartIntakeCategory ? (
            <>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Fotos del espacio (opcional)</label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 14,
                    borderRadius: 12,
                    border: "1px dashed var(--brand-dim)",
                    background: "var(--brand-dim)",
                    color: "var(--brand)",
                    cursor: intakeLoading ? "wait" : "pointer",
                  }}
                >
                  <Upload size={16} />
                  <span style={{ fontSize: 12, fontWeight: 800 }}>
                    {intakeLoading ? "Subiendo..." : "Subir fotos antes de pedir estimate"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      if (files.length > 0) {
                        void uploadImages(files, "before");
                      }
                    }}
                  />
                </label>
              </div>

              {warnings.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {warnings.map((warning) => (
                    <WarningBanner key={warning.id} warning={warning} language={intake?.detectedLanguage ?? "es"} />
                  ))}
                </div>
              ) : null}

              <QuestionCard
                question={nextQuestion}
                language={intake?.detectedLanguage ?? "es"}
                warnings={warnings}
                onAnswer={(answer) => void submitAnswer(answer)}
                isSubmitting={intakeLoading}
              />
            </>
          ) : (
            <div style={{ padding: 14, borderRadius: 14, background: "var(--raised)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              Algunas categorías ya cuentan con estimador inteligente avanzado; otras usan un brief inicial mientras expandimos el sistema.
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            alignContent: "start",
            padding: 20,
            borderRadius: 20,
            background: "linear-gradient(180deg, var(--brand-dim), var(--violet-dim))",
            border: "1px solid var(--brand-dim)",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--violet)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 8 }}>
              Budget Intelligence
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
              Calcula un rango antes de entrar
            </h3>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
              Estimaciones automáticas para pintura interior. Para las demás categorías, se proporciona un rango preliminar mientras expandimos el sistema.
            </p>
          </div>

          {isSmartIntakeCategory && intake ? (
            <>
              <AccuracyMeter
                score={intake.accuracyScore}
                level={intake.accuracyLevel}
                missingFields={intake.missingFields}
                estimateUnlocked={estimateUnlocked}
              />
              <TipsPanel tips={tips} language={intake.detectedLanguage} />
              <LiveScopeSummary summary={liveSummary} />
            </>
          ) : null}

          <button
            type="button"
            disabled={
              legacyBudgetLoading ||
              (isSmartIntakeCategory
                ? !estimateUnlocked
                : !title.trim() || description.trim().length < LEGACY_DESCRIPTION_MIN)
            }
            onClick={() => void runPreview()}
            title={isSmartIntakeCategory && !estimateUnlocked ? "Completa mas detalles para desbloquear el presupuesto" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid var(--violet-dim)",
              background: "var(--violet-dim)",
              color: "var(--violet)",
              fontWeight: 800,
              cursor: legacyBudgetLoading ? "not-allowed" : "pointer",
              opacity: isSmartIntakeCategory
                ? estimateUnlocked ? 1 : 0.5
                : (!title.trim() || description.trim().length < LEGACY_DESCRIPTION_MIN ? 0.5 : 1),
              boxShadow: isSmartIntakeCategory && estimateUnlocked ? "0 0 0 1px rgba(79,70,229,.14), 0 12px 28px rgba(79,70,229,.14)" : "none",
            }}
          >
            <Sparkles size={15} />
            {legacyBudgetLoading ? "Analizando..." : "Analizar presupuesto y perfiles"}
          </button>

          {!isSmartIntakeCategory && !legacyAnalysisIsFresh && lastLegacyAnalysisKey ? (
            <div style={{ padding: 12, borderRadius: 12, background: "var(--warn-dim)", border: "1px solid var(--warn)", color: "var(--warn)", fontSize: 12, lineHeight: 1.6 }}>
              El brief cambio despues del ultimo analisis. Ejecutalo de nuevo para actualizar presupuesto y candidatos.
            </div>
          ) : null}

          {isSmartIntakeCategory ? (
            <>
              <PreliminaryEstimateCard estimate={estimate} />
              <MilestonePreview milestones={milestones} />
            </>
          ) : visibleLegacyBudget ? (
            <div style={{ padding: 16, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--violet)" }}>Rango sugerido</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "var(--ok)", background: "var(--ok-dim)", borderRadius: 999, padding: "4px 8px", textTransform: "uppercase" }}>
                  {visibleLegacyBudget.confidence}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 6 }}>
                ${visibleLegacyBudget.min.toLocaleString("en-US")} - ${visibleLegacyBudget.max.toLocaleString("en-US")} {visibleLegacyBudget.currency}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                Mediana ${visibleLegacyBudget.median.toLocaleString("en-US")} · {visibleLegacyBudget.similarJobsFound} referencias
              </div>
              <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>{visibleLegacyBudget.aiNarrative}</p>
            </div>
          ) : (
            <div style={{ padding: 16, borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              {isSmartIntakeCategory
                ? "Responde las preguntas guiadas hasta cruzar el umbral de score para desbloquear el estimate."
                : "Completa categoria, titulo y descripcion para calcular un rango antes de entrar al wizard."}
            </div>
          )}

          {visibleRecommendedPros.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)" }}>
                <Users size={15} color="var(--brand)" />
                <span style={{ fontSize: 12, fontWeight: 800 }}>Profesionales sugeridos para este brief</span>
              </div>
              {visibleRecommendedPros.map((pro) => (
                <div
                  key={pro.userId}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 14,
                    borderRadius: 16,
                    background: "var(--surface)",
                    border: selectedProfessional?.userId === pro.userId
                      ? "1.5px solid var(--brand)"
                      : "1px solid var(--border)",
                    boxShadow: selectedProfessional?.userId === pro.userId
                      ? "0 8px 24px rgba(79,70,229,.12)"
                      : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{pro.displayName}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                        <span>{Math.round(pro.score * 100)}% match</span>
                        <span>{pro.trustScore} trust</span>
                        <span>{pro.completedProjects || pro.completedJobs} trabajos</span>
                        {pro.avgRating > 0 ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--warn)" }}>
                            <Star size={11} fill="var(--warn)" />
                            {pro.avgRating.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {pro.publicSlug ? (
                      <Link
                        href={`/pro/${pro.publicSlug}`}
                        target="_blank"
                        style={{ color: "var(--violet)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, textDecoration: "none" }}
                      >
                        Perfil <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>Perfil privado</span>
                    )}
                  </div>
                  {pro.specialties.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {pro.specialties.slice(0, 3).map((specialty) => (
                        <span
                          key={specialty}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--ink)",
                            background: "var(--raised)",
                            borderRadius: 999,
                            padding: "4px 8px",
                          }}
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {pro.matchReason}
                    {" · "}
                    {pro.verifiedAt ? "Credencial publica activa" : "Reputacion detectada por historial operativo"}
                    {pro.badges.length > 0 ? ` · ${pro.badges.slice(0, 2).join(" · ")}` : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProfessionalUserId(pro.userId)}
                    style={{
                      justifySelf: "start",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: selectedProfessional?.userId === pro.userId
                        ? "1px solid var(--violet-dim)"
                        : "1px solid var(--border)",
                      background: selectedProfessional?.userId === pro.userId
                        ? "var(--violet-dim)"
                        : "transparent",
                      color: selectedProfessional?.userId === pro.userId ? "var(--violet)" : "var(--ink)",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {selectedProfessional?.userId === pro.userId ? "Perfil objetivo seleccionado" : "Usar este perfil como objetivo"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 16, borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              Cuando analices el brief, aqui aparecera una vista previa de profesionales compatibles.
            </div>
          )}

          {legacyError ? (
            <div style={{ padding: 12, borderRadius: 12, background: "var(--error-dim)", border: "1px solid var(--error)", color: "var(--error)", fontSize: 13 }}>
              {legacyError}
            </div>
          ) : null}

          <Link
            href={nextHref}
            onClick={() => {
              if (intakeId) {
                window.localStorage.setItem("intake_draft_id", intakeId);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 18px",
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--brand), var(--violet))",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Continuar al wizard completo →
          </Link>

          {selectedProfessional ? (
            <div style={{ padding: 12, borderRadius: 12, background: "var(--brand-dim)", border: "1px solid var(--brand-dim)", color: "var(--brand)", fontSize: 12, lineHeight: 1.6 }}>
              El wizard llevara marcado a <strong>{selectedProfessional.displayName}</strong> como perfil objetivo y, al publicar, te llevara directo al matching del job.
            </div>
          ) : null}

          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            Si no has iniciado sesion, el sistema te pedira entrar y luego volvera al wizard con el intake recuperado cuando aplique.
          </div>
        </div>
      </div>
    </section>
  );
}
