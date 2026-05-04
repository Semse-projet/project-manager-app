"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle, ExternalLink, MapPin, Sparkles, Star, Users } from "lucide-react";
import type { BudgetSuggestion } from "../../app/semse-api";
import {
  buildJobIntakeHref,
  JOB_CATEGORIES,
  JOB_URGENCY_OPTIONS,
  type JobLocationType,
} from "../../lib/job-intake";

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

export function LandingIntake() {
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<JobLocationType>("on_site");
  const [city, setCity] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [budgetSuggestion, setBudgetSuggestion] = useState<BudgetSuggestion | null>(null);
  const [recommendedPros, setRecommendedPros] = useState<RecommendedProfessional[]>([]);
  const [selectedProfessionalUserId, setSelectedProfessionalUserId] = useState<string>("");
  const [lastAnalysisKey, setLastAnalysisKey] = useState<string | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = useMemo(() => JOB_CATEGORIES.find((item) => item.id === categoryId), [categoryId]);
  const canContinue = categoryId && subcategoryId && title.trim().length >= 5 && description.trim().length >= 20;
  const analysisKey = JSON.stringify([
    categoryId,
    subcategoryId,
    title.trim(),
    description.trim(),
    city.trim(),
  ]);
  const analysisIsFresh = lastAnalysisKey === analysisKey;
  const visibleBudgetSuggestion = analysisIsFresh ? budgetSuggestion : null;
  const visibleRecommendedPros = analysisIsFresh ? recommendedPros : [];
  const selectedProfessional = visibleRecommendedPros.find((professional) => professional.userId === selectedProfessionalUserId)
    ?? visibleRecommendedPros[0]
    ?? null;
  const nextHref = buildJobIntakeHref({
    source: "landing",
    categoryId,
    subcategoryId,
    title,
    description,
    locationType,
    city,
    urgency,
    budgetType: "range",
    budgetMin: visibleBudgetSuggestion?.min,
    budgetMax: visibleBudgetSuggestion?.max,
    step: 3,
    preferredProfessionalUserId: selectedProfessional?.userId,
    preferredProfessionalName: selectedProfessional?.displayName,
    preferredProfessionalSlug: selectedProfessional?.publicSlug ?? undefined,
  });

  useEffect(() => {
    if (!analysisIsFresh || visibleRecommendedPros.length === 0) return;
    const stillExists = visibleRecommendedPros.some((professional) => professional.userId === selectedProfessionalUserId);
    if (!stillExists) {
      setSelectedProfessionalUserId(visibleRecommendedPros[0]?.userId ?? "");
    }
  }, [analysisIsFresh, selectedProfessionalUserId, visibleRecommendedPros]);

  async function runBudgetPreview() {
    if (!title.trim() || description.trim().length < 20) return;
    setBudgetLoading(true);
    setError(null);
    try {
      const nextAnalysisKey = analysisKey;
      const payload = {
        title,
        scope: description,
        category: categoryId || undefined,
        subcategory: subcategoryId || undefined,
        location: city || undefined,
        limit: 3,
      };
      const [budgetResponse, professionalsResponse] = await Promise.all([
        fetch("/api/semse/public/budget/suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
        fetch("/api/semse/public/professionals/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      ]);
      const [budgetJson, professionalsJson] = await Promise.all([
        budgetResponse.json() as Promise<{ data?: BudgetSuggestion; error?: { message?: string } }>,
        professionalsResponse.json() as Promise<{
          data?: { candidates?: RecommendedProfessional[] };
          error?: { message?: string };
        }>,
      ]);

      const nextErrors: string[] = [];

      if (budgetResponse.ok && budgetJson.data) {
        setBudgetSuggestion(budgetJson.data);
      } else {
        nextErrors.push(budgetJson.error?.message ?? "No se pudo calcular la estimación.");
      }

      if (professionalsResponse.ok && professionalsJson.data) {
        setRecommendedPros(professionalsJson.data.candidates ?? []);
        setSelectedProfessionalUserId(professionalsJson.data.candidates?.[0]?.userId ?? "");
      } else {
        setRecommendedPros([]);
        setSelectedProfessionalUserId("");
        nextErrors.push(professionalsJson.error?.message ?? "No se pudieron sugerir profesionales.");
      }

      if ((budgetResponse.ok && budgetJson.data) || (professionalsResponse.ok && professionalsJson.data)) {
        setLastAnalysisKey(nextAnalysisKey);
      }

      if (nextErrors.length > 0) {
        setError(nextErrors[0]);
      }
    } catch {
      setError("No se pudo calcular la estimación.");
    } finally {
      setBudgetLoading(false);
    }
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
          background: "rgba(255,255,255,.82)",
          boxShadow: "0 20px 60px rgba(15,23,42,.08)",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 8 }}>
              Brief inicial
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: 8 }}>
              Describe tu trabajo y entra al wizard real
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>
              Esta entrada pública no reemplaza el flujo real. Prepara el contexto, calcula presupuesto y te deja caer en el paso correcto de publicación.
            </p>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>Categoría</div>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{item.subcategories.length} especialidades</div>
                </button>
              ))}
            </div>
          </div>

          {category && (
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
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>desde ${item.basePrice.toLocaleString("es-MX")}</div>
                    </div>
                    {subcategoryId === item.id && <CheckCircle size={15} color="#2563eb" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Título</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej: Renovación de baño principal"
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Descripción</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Qué necesitas, dimensiones, materiales, problema actual y expectativas."
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
              <div style={{ fontSize: 11, color: description.trim().length >= 20 ? "#64748b" : "#ef4444", marginTop: 6 }}>
                {description.trim().length}/20 caracteres mínimo
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Modalidad</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))", gap: 8 }}>
                {([
                  { value: "on_site" as const, label: "Sitio" },
                  { value: "remote" as const, label: "Remoto" },
                  { value: "hybrid" as const, label: "Híbrido" },
                ]).map((item) => (
                  <button key={item.value} type="button" onClick={() => setLocationType(item.value)} style={optionCard(locationType === item.value, "#0f766e")}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Ciudad</label>
              <div style={{ position: "relative" }}>
                <MapPin size={14} color="#64748b" style={{ position: "absolute", left: 12, top: 13 }} />
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{item.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            alignContent: "start",
            padding: 20,
            borderRadius: 20,
            background: "linear-gradient(180deg, rgba(37,99,235,.08), rgba(124,58,237,.06))",
            border: "1px solid rgba(37,99,235,.12)",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 8 }}>
              Budget Intelligence
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
              Calcula un rango antes de entrar
            </h3>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              Usa el mismo motor de presupuesto del wizard real y una vista previa de matching para llegar con contexto y no empezar en blanco.
            </p>
          </div>

          <button
            type="button"
            disabled={budgetLoading || !title.trim() || description.trim().length < 20}
            onClick={() => void runBudgetPreview()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(79,70,229,.16)",
              background: "rgba(79,70,229,.08)",
              color: "#4f46e5",
              fontWeight: 800,
              cursor: budgetLoading ? "not-allowed" : "pointer",
              opacity: !title.trim() || description.trim().length < 20 ? 0.5 : 1,
            }}
          >
            <Sparkles size={15} />
            {budgetLoading ? "Analizando..." : "Analizar presupuesto y perfiles"}
          </button>

          {!analysisIsFresh && lastAnalysisKey && (
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", color: "#b45309", fontSize: 12, lineHeight: 1.6 }}>
              El brief cambió después del último análisis. Vuelve a correrlo para actualizar presupuesto y candidatos.
            </div>
          )}

          {visibleBudgetSuggestion ? (
            <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid rgba(37,99,235,.12)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#4f46e5" }}>Rango sugerido</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0f766e", background: "rgba(16,185,129,.12)", borderRadius: 999, padding: "4px 8px", textTransform: "uppercase" }}>
                  {visibleBudgetSuggestion.confidence}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: 6 }}>
                ${visibleBudgetSuggestion.min.toLocaleString("es-MX")} - ${visibleBudgetSuggestion.max.toLocaleString("es-MX")} {visibleBudgetSuggestion.currency}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                Mediana ${visibleBudgetSuggestion.median.toLocaleString("es-MX")} · {visibleBudgetSuggestion.similarJobsFound} referencias
              </div>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{visibleBudgetSuggestion.aiNarrative}</p>
            </div>
          ) : (
            <div style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,.65)", border: "1px dashed rgba(37,99,235,.16)", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              Completa categoría, título y descripción para calcular un rango antes de entrar al wizard.
            </div>
          )}

          {visibleRecommendedPros.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0f172a" }}>
                <Users size={15} color="#2563eb" />
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
                    background: "#fff",
                    border: selectedProfessional?.userId === pro.userId
                      ? "1.5px solid rgba(79,70,229,.45)"
                      : "1px solid rgba(37,99,235,.12)",
                    boxShadow: selectedProfessional?.userId === pro.userId
                      ? "0 8px 24px rgba(79,70,229,.12)"
                      : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{pro.displayName}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4, fontSize: 11, color: "#64748b" }}>
                        <span>{Math.round(pro.score * 100)}% match</span>
                        <span>{pro.trustScore} trust</span>
                        <span>{pro.completedProjects || pro.completedJobs} trabajos</span>
                        {pro.avgRating > 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#d97706" }}>
                            <Star size={11} fill="#d97706" />
                            {pro.avgRating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    {pro.publicSlug ? (
                      <Link
                        href={`/pro/${pro.publicSlug}`}
                        target="_blank"
                        style={{ color: "#4f46e5", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, textDecoration: "none" }}
                      >
                        Perfil <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>
                        Perfil privado
                      </span>
                    )}
                  </div>
                  {pro.specialties.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {pro.specialties.slice(0, 3).map((specialty) => (
                        <span
                          key={specialty}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#334155",
                            background: "#e2e8f0",
                            borderRadius: 999,
                            padding: "4px 8px",
                          }}
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {pro.matchReason}
                    {" · "}
                    {pro.verifiedAt ? "Credencial pública activa" : "Reputación detectada por historial operativo"}
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
                        ? "1px solid rgba(79,70,229,.2)"
                        : "1px solid var(--border)",
                      background: selectedProfessional?.userId === pro.userId
                        ? "rgba(79,70,229,.08)"
                        : "transparent",
                      color: selectedProfessional?.userId === pro.userId ? "#4f46e5" : "#334155",
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
            <div style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,.65)", border: "1px dashed rgba(37,99,235,.16)", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              Cuando analices el brief, aquí aparecerá una vista previa de profesionales compatibles.
            </div>
          )}

          {error && (
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#b91c1c", fontSize: 13 }}>
              {error}
            </div>
          )}

          <Link
            href={canContinue ? nextHref : "#"}
            aria-disabled={!canContinue}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 18px",
              borderRadius: 12,
              background: canContinue ? "linear-gradient(135deg, #2563eb, #7c3aed)" : "#cbd5e1",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
              pointerEvents: canContinue ? "auto" : "none",
            }}
          >
            Continuar al wizard completo →
          </Link>

          {selectedProfessional && (
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(79,70,229,.08)", border: "1px solid rgba(79,70,229,.18)", color: "#4338ca", fontSize: 12, lineHeight: 1.6 }}>
              El wizard llevará marcado a <strong>{selectedProfessional.displayName}</strong> como perfil objetivo y, al publicar, te llevará directo al matching del job.
            </div>
          )}

          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
            Si no has iniciado sesión, el sistema te pedirá entrar y luego volverá exactamente a este trabajo con los datos precargados.
          </div>
        </div>
      </div>
    </section>
  );
}
