"use client";

/**
 * Publicar Trabajo — Wizard de 4 pasos para el cliente
 * Portado desde labsemse/src/pages/Publicar.tsx
 * Adaptado: React Router → Next.js, Supabase → API REST
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  ArrowLeft, ArrowRight, CheckCircle, Upload, MapPin, Briefcase,
  Globe, Home, AlertCircle, Sparkles,
} from "lucide-react";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { CLIENT_ROUTES } from "../../../../lib/client-routes";
import { trackProductEvent } from "../../../../../lib/product-intelligence";
import { suggestBudget, type BudgetSuggestion } from "../../../../semse-api";
import {
  computeInitialJobWizardStep,
  JOB_CATEGORIES,
  JOB_URGENCY_OPTIONS,
  parseJobIntakePrefill,
  type JobBudgetType,
  type JobLocationType,
} from "../../../../../lib/job-intake";
import type { ProjectIntake } from "../../../../../lib/smart-intake";
import {
  clearPersistedIntakeId,
  getPersistedIntakeId,
} from "../../../../../hooks/use-intake";
import { useCurrentUser } from "../../../../../hooks/useCurrentUser";

// ──────────────────────────────────────────────
// DRAFT AUTOSAVE (audit 1.14) — the wizard used to lose 100% of its
// progress on a refresh. Persist the editable fields to localStorage,
// scoped per user so a shared browser can't leak one account's draft into
// another's, restored on mount and cleared once the job actually publishes.
// ──────────────────────────────────────────────

type JobDraftPayload = {
  categoryId: string;
  subcategoryId: string;
  title: string;
  description: string;
  locationType: JobLocationType;
  city: string;
  budgetType: JobBudgetType;
  budgetMin: number;
  budgetMax: number;
  urgency: string;
  deadline: string;
  step: number;
  savedAt: number;
};

function jobDraftStorageKey(userId: string | null | undefined): string | null {
  return userId ? `semse-job-draft:${userId}` : null;
}

// ──────────────────────────────────────────────
// DATA
// ──────────────────────────────────────────────

const STEPS = [
  { id: 1, title: "Categoría",   description: "Selecciona el tipo de servicio" },
  { id: 2, title: "Detalles",    description: "Describe tu proyecto" },
  { id: 3, title: "Presupuesto", description: "Define tu rango de precios" },
  { id: 4, title: "Revisar",     description: "Verifica y publica" },
];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ──────────────────────────────────────────────
// STEP INDICATOR
// ──────────────────────────────────────────────

function StepBar({ current, maxAvailable, onSelect }: { current: number; maxAvailable: number; onSelect: (step: number) => void }) {
  return (
    <HtmlInCanvasPanel as="section" style={{ marginBottom: "28px" }} canvasClassName="rounded-2xl" minHeight={120}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: "14px" }}>
        {STEPS.map((step, idx) => (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              disabled={step.id > maxAvailable}
              style={{
                width: "36px", height: "36px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "13px",
                background: current >= step.id ? "linear-gradient(135deg, var(--accent), #ff8c00)" : "var(--surface)",
                color: current >= step.id ? "#fff" : "var(--muted)",
                border: current >= step.id ? "none" : "1.5px solid var(--border)",
                transition: "all 0.2s",
                zIndex: 1,
                cursor: step.id > maxAvailable ? "not-allowed" : "pointer",
                opacity: step.id > maxAvailable ? 0.55 : 1,
              }}
            >
              {current > step.id ? <CheckCircle size={16} /> : step.id}
            </button>
            {idx < STEPS.length - 1 && (
              <div style={{
                width: "60px", height: "2px",
                background: current > step.id ? "var(--accent)" : "var(--border)",
                transition: "background 0.2s",
              }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>{STEPS[current - 1].title}</p>
        <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{STEPS[current - 1].description}</p>
      </div>
    </HtmlInCanvasPanel>
  );
}

// ──────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────

export default function NewJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = useMemo(() => parseJobIntakePrefill(searchParams), [searchParams]);
  const preferredProfessional = prefill.preferredProfessionalUserId
    ? {
        userId: prefill.preferredProfessionalUserId,
        name: prefill.preferredProfessionalName || "Profesional sugerido",
        slug: prefill.preferredProfessionalSlug || null,
      }
    : null;

  const [step, setStep] = useState(() => computeInitialJobWizardStep(prefill));
  const [wizardStartedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeIntakeId, setActiveIntakeId] = useState(prefill.intakeId);
  const [intakeRecovered, setIntakeRecovered] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const { user } = useCurrentUser();
  const draftKey = jobDraftStorageKey(user?.id);
  const draftHydratedRef = useRef(false);

  useEffect(() => {
    if (prefill.categoryId || prefill.intakeId) {
      trackProductEvent("wizard.prefill_arrived", {
        category: prefill.categoryId || null,
        step: computeInitialJobWizardStep(prefill),
        source: prefill.source ?? null,
      });
    }
    // Solo al montar: describe la llegada con prefill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 1
  const [categoryId, setCategoryId] = useState(prefill.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(prefill.subcategoryId);

  // Step 2
  const [title, setTitle] = useState(prefill.title);
  const [description, setDescription] = useState(prefill.description);
  const [locationType, setLocationType] = useState<"remote" | "on_site" | "hybrid">(prefill.locationType);
  const [city, setCity] = useState(prefill.city);
  const [files, setFiles] = useState<File[]>([]);

  // Step 3
  const [budgetType, setBudgetType] = useState<"fixed" | "range" | "hourly">(prefill.budgetType);
  const [budgetMin, setBudgetMin] = useState(prefill.budgetMin);
  const [budgetMax, setBudgetMax] = useState(prefill.budgetMax);
  const [budgetSuggestion, setBudgetSuggestion] = useState<BudgetSuggestion | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [urgency, setUrgency] = useState(prefill.urgency);
  const [deadline, setDeadline] = useState(prefill.deadline);

  const category = JOB_CATEGORIES.find(c => c.id === categoryId);
  const subcategory = category?.subcategories.find(s => s.id === subcategoryId);
  const currentStepMeta = STEPS[step - 1];
  const recommendedBudget = subcategory?.basePrice;
  const estimatedProposalWindow = urgency === "urgent" ? "24h" : urgency === "high" ? "48h" : urgency === "medium" ? "3-5 días" : "hasta 1 semana";
  const maxAvailableStep = useMemo(() => {
    if (!categoryId || !subcategoryId) return 1;
    if (title.length < 5 || description.length < 20) return 2;
    if (budgetMin <= 0 || budgetMax < budgetMin) return 3;
    return 4;
  }, [categoryId, subcategoryId, title, description, budgetMin, budgetMax]);

  const canProceed = () => {
    if (step === 1) return !!categoryId && !!subcategoryId;
    if (step === 2) return title.length >= 5 && description.length >= 20;
    if (step === 3) return budgetMin > 0 && budgetMax >= budgetMin;
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    const draftId = prefill.intakeId || getPersistedIntakeId();

    if (!draftId) {
      return;
    }

    const recoveredDraftId = draftId;

    async function hydrateFromIntake() {
      try {
        const claimResponse = await fetch(`/api/semse/intake/${encodeURIComponent(recoveredDraftId)}/claim`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const claimJson = (await claimResponse.json()) as {
          data?: { intakeId: string };
          error?: { message?: string };
        };
        if (!claimResponse.ok) {
          throw new Error(claimJson.error?.message ?? "No se pudo reclamar el intake.");
        }

        const intakeResponse = await fetch(`/api/semse/public/intake/${encodeURIComponent(recoveredDraftId)}`, {
          cache: "no-store",
        });
        const intakeJson = (await intakeResponse.json()) as {
          data?: ProjectIntake;
          error?: { message?: string };
        };
        if (!intakeResponse.ok || !intakeJson.data) {
          throw new Error(intakeJson.error?.message ?? "No se pudo recuperar el intake.");
        }

        if (cancelled) {
          return;
        }

        const intake = intakeJson.data;
        setActiveIntakeId(intake.id);
        setCategoryId((current) => current || intake.selectedCategoryId || "");
        setSubcategoryId((current) => current || intake.selectedSubcategoryId || "");
        setTitle((current) => current || intake.normalizedTitle || intake.providedTitle || "");
        setDescription((current) => current || intake.rawDescription || "");
        setLocationType((current) => intake.modality ?? current);
        setCity((current) => current || intake.city || "");
        setUrgency((current) => intake.urgency ?? current);
        if (intake.generatedEstimate?.totalRange) {
          setBudgetType("range");
          setBudgetMin((current) => current > 0 ? current : intake.generatedEstimate?.totalRange.min ?? current);
          setBudgetMax((current) => current > 0 ? current : intake.generatedEstimate?.totalRange.max ?? current);
        }
        setStep((current) => Math.max(current, 3));
        setIntakeRecovered(true);
        clearPersistedIntakeId();
      } catch {
        if (!cancelled) {
          setIntakeRecovered(false);
        }
      }
    }

    void hydrateFromIntake();
    return () => {
      cancelled = true;
    };
  }, [prefill.intakeId]);

  // Restore an autosaved draft on mount, once we know which user's draft to
  // load. A prefill/intake arriving via the URL is a fresh, explicit intent
  // and always wins over a stale local draft.
  useEffect(() => {
    if (!draftKey || draftHydratedRef.current) return;
    draftHydratedRef.current = true;

    const hasIncomingIntent = Boolean(prefill.categoryId || prefill.intakeId || prefill.title);
    if (hasIncomingIntent) return;

    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<JobDraftPayload>;

      if (draft.categoryId) setCategoryId(draft.categoryId);
      if (draft.subcategoryId) setSubcategoryId(draft.subcategoryId);
      if (draft.title) setTitle(draft.title);
      if (draft.description) setDescription(draft.description);
      if (draft.locationType) setLocationType(draft.locationType);
      if (draft.city) setCity(draft.city);
      if (draft.budgetType) setBudgetType(draft.budgetType);
      if (typeof draft.budgetMin === "number") setBudgetMin(draft.budgetMin);
      if (typeof draft.budgetMax === "number") setBudgetMax(draft.budgetMax);
      if (draft.urgency) setUrgency(draft.urgency);
      if (draft.deadline) setDeadline(draft.deadline);
      if (typeof draft.step === "number") setStep(draft.step);
      setDraftRestored(true);
    } catch {
      // Corrupt/unreadable draft — ignore and start fresh.
    }
  }, [draftKey, prefill.categoryId, prefill.intakeId, prefill.title]);

  // Autosave the draft on every change, once the restore attempt above has
  // had a chance to run (otherwise the empty first render would immediately
  // overwrite an existing draft before it's read).
  useEffect(() => {
    if (!draftKey || !draftHydratedRef.current) return;

    const hasContent = Boolean(categoryId || title.trim() || description.trim());
    try {
      if (!hasContent) {
        window.localStorage.removeItem(draftKey);
        return;
      }
      const payload: JobDraftPayload = {
        categoryId, subcategoryId, title, description, locationType, city,
        budgetType, budgetMin, budgetMax, urgency, deadline, step,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      // localStorage unavailable/full — draft autosave is best-effort.
    }
  }, [
    draftKey, categoryId, subcategoryId, title, description, locationType,
    city, budgetType, budgetMin, budgetMax, urgency, deadline, step,
  ]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        title,
        scope: description,
        description,
        category: subcategory?.name ?? category?.name,
        budgetType,
        budgetMin,
        budgetMax: budgetType === "range" ? budgetMax : budgetMin,
        urgency,
        locationType,
        ...(city ? { city } : {}),
        ...(deadline ? { deadline } : {}),
        ...(preferredProfessional ? {
          preferredProfessional: {
            userId: preferredProfessional.userId,
            displayName: preferredProfessional.name,
            ...(preferredProfessional.slug ? { publicSlug: preferredProfessional.slug } : {}),
          },
        } : {}),
      };

      const endpoint = activeIntakeId
        ? `/api/semse/intake/${encodeURIComponent(activeIntakeId)}/publish`
        : "/api/semse/jobs";
      const requestBody = activeIntakeId
        ? {
            confirmEstimate: true,
            title,
            description,
            category: subcategory?.name ?? category?.name,
            categoryId,
            subcategoryId,
            locationType,
            urgency,
            budgetType,
            budgetMin,
            budgetMax: budgetType === "range" ? budgetMax : budgetMin,
            ...(city ? { city } : {}),
            ...(deadline ? { deadline } : {}),
            ...(preferredProfessional ? {
              preferredProfessional: {
                userId: preferredProfessional.userId,
                displayName: preferredProfessional.name,
                ...(preferredProfessional.slug ? { publicSlug: preferredProfessional.slug } : {}),
              },
            } : {}),
          }
        : payload;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await res.json()) as {
        data?: { id?: string; jobId?: string; jobUrl?: string };
        error?: { message: string };
      };
      if (!res.ok || data.error) {
        setSubmitError(data.error?.message ?? `Error ${res.status}`);
        setSubmitting(false);
        return;
      }
      clearPersistedIntakeId();
      if (draftKey) {
        try { window.localStorage.removeItem(draftKey); } catch { /* best-effort */ }
      }
      trackProductEvent("wizard.published", {
        category: categoryId || null,
        durationMs: Date.now() - wizardStartedAt,
      });
      const jobId = data.data?.jobId ?? data.data?.id;
      if (jobId && preferredProfessional) {
        const qs = new URLSearchParams();
        qs.set("jobId", jobId);
        if (prefill.source) {
          qs.set("source", prefill.source);
        }
        router.push(`/client/professionals?${qs.toString()}`);
        return;
      }
      router.push(data.data?.jobUrl ?? (jobId ? `/client/jobs/${jobId}` : "/client/jobs"));
    } catch {
      setSubmitError("No se pudo conectar con el servidor");
      setSubmitting(false);
    }
  };

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "24px",
  };

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 13px", borderRadius: "8px",
    border: "1px solid var(--border)", background: "var(--bg)",
    color: "var(--ink)", fontSize: "14px", outline: "none",
    boxSizing: "border-box",
  };

  const optionCard = (selected: boolean, accent = "var(--accent)"): React.CSSProperties => ({
    padding: "14px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
    border: `1.5px solid ${selected ? accent : "var(--border)"}`,
    background: selected ? `${accent}14` : "var(--bg)",
    transition: "all 0.15s",
  });

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <ClientPageHeader
        title="Publicar trabajo"
        subtitle="Completa los pasos para recibir propuestas con contexto, presupuesto y expectativas claras."
        breadcrumbs={[{ label: "Trabajos", href: CLIENT_ROUTES.jobs }, { label: "Publicar trabajo" }]}
        minHeight={86}
        marginBottom={28}
        actions={
          <Link
            href={CLIENT_ROUTES.jobs}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "8px 12px", borderRadius: "8px",
              border: "1px solid var(--border)", color: "var(--ink)",
              textDecoration: "none", fontSize: "12px", fontWeight: 700
            }}
          >
            Ver mis trabajos
          </Link>
        }
      />

      {(prefill.source === "landing" || intakeRecovered || Boolean(activeIntakeId)) && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.18)", color: "#bfdbfe", fontSize: "13px" }}>
          {intakeRecovered
            ? "Recuperamos el intake de la landing y rellenamos el wizard con el borrador guardado."
            : "Trajimos el briefing desde la landing. Ya aterrizaste en el paso correcto para terminar la publicación."}
        </div>
      )}

      {draftRestored && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)", color: "#6ee7b7", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span>Recuperamos tu borrador guardado. Sigue donde lo dejaste.</span>
          <button
            type="button"
            onClick={() => {
              if (draftKey) { try { window.localStorage.removeItem(draftKey); } catch { /* best-effort */ } }
              setDraftRestored(false);
              setCategoryId(""); setSubcategoryId(""); setTitle(""); setDescription("");
              setCity(""); setBudgetMin(0); setBudgetMax(0); setDeadline("");
              setStep(1);
            }}
            style={{ background: "none", border: "none", color: "#6ee7b7", fontSize: "12px", fontWeight: 700, textDecoration: "underline", cursor: "pointer", padding: 0 }}
          >
            Descartar y empezar de nuevo
          </button>
        </div>
      )}

      {preferredProfessional && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(79,70,229,.08)", border: "1px solid rgba(79,70,229,.18)", color: "#c4b5fd", fontSize: "13px", lineHeight: 1.6 }}>
          Perfil objetivo: <strong>{preferredProfessional.name}</strong>. Al publicar, te llevaremos directo al matching del trabajo con este profesional ya marcado.
        </div>
      )}

      {/* Step indicator */}
      <StepBar current={step} maxAvailable={maxAvailableStep} onSelect={(targetStep) => {
        if (targetStep <= maxAvailableStep) setStep(targetStep);
      }} />

      {/* Card */}
      <HtmlInCanvasPanel as="section" style={card} canvasClassName="rounded-2xl" minHeight={420}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "18px", paddingBottom: "16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "11px", color: "var(--faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "4px" }}>
              Paso {step} de {STEPS.length}
            </p>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{currentStepMeta.title}</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>{currentStepMeta.description}</p>
          </div>
          <div style={{ minWidth: "180px", padding: "12px 14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg)" }}>
            <p style={{ fontSize: "11px", color: "var(--faint)", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>Radar del proyecto</p>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
              {subcategory ? `${subcategory.name} · ${category?.name}` : "Elige categoría y especialidad"}
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
              {recommendedBudget ? `Referencia desde ${fmt(recommendedBudget)}` : "Sin referencia todavía"}
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>
              Propuestas estimadas: {estimatedProposalWindow}
            </p>
            {preferredProfessional && (
              <p style={{ fontSize: "12px", color: "#a78bfa", marginTop: "6px" }}>
                Objetivo: {preferredProfessional.name}
              </p>
            )}
          </div>
        </div>

        {/* ── STEP 1: CATEGORY ── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>
                CATEGORÍA
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px" }}>
                {JOB_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoryId(cat.id); setSubcategoryId(""); }}
                    style={optionCard(categoryId === cat.id, "var(--brand)")}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{cat.name}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>{cat.subcategories.length} especialidades</p>
                  </button>
                ))}
              </div>
            </div>

            {category && (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>
                  ESPECIALIDAD
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {category.subcategories.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setSubcategoryId(sub.id)}
                      style={{ ...optionCard(subcategoryId === sub.id, "var(--brand)"), display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>{sub.name}</p>
                      <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>desde {fmt(sub.basePrice)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: DETAILS ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>TÍTULO DEL PROYECTO</label>
              <input
                style={input}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Necesito renovar el baño principal"
              />
              <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "4px" }}>Mínimo 5 caracteres</p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>DESCRIPCIÓN</label>
              <textarea
                style={{ ...input, resize: "vertical", minHeight: "120px" }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe detalladamente lo que necesitas, materiales preferidos, dimensiones, etc."
              />
              <p style={{ fontSize: "11px", color: description.length >= 20 ? "var(--faint)" : "var(--accent)", marginTop: "4px" }}>
                {description.length}/20 caracteres mínimo
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>UBICACIÓN</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {([
                  { value: "on_site" as const, label: "En sitio", icon: MapPin },
                  { value: "remote" as const,  label: "Remoto",   icon: Globe },
                  { value: "hybrid" as const,  label: "Híbrido",  icon: Home },
                ]).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setLocationType(value)}
                    style={{ ...optionCard(locationType === value, "var(--brand)"), display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "16px 8px" }}
                  >
                    <Icon size={20} color={locationType === value ? "var(--brand)" : "var(--muted)"} />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: locationType === value ? "var(--brand)" : "var(--muted)" }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {locationType !== "remote" && (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>CIUDAD / DIRECCIÓN</label>
                <input style={input} value={city} onChange={e => setCity(e.target.value)} placeholder="Ej: Miami, FL" />
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>ARCHIVOS ADJUNTOS (opcional)</label>
              <label
                htmlFor="file-upload"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                  padding: "28px", borderRadius: "10px", cursor: "pointer",
                  border: "2px dashed var(--border)", background: "var(--bg)",
                }}
              >
                <Upload size={24} color="var(--muted)" />
                <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center" }}>
                  Arrastra fotos o planos aquí, o haz clic para seleccionar
                </p>
                <p style={{ fontSize: "11px", color: "var(--faint)" }}>Máx. 10 MB por archivo</p>
              </label>
              <input id="file-upload" type="file" multiple style={{ display: "none" }} onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])} />
              {files.length > 0 && (
                <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {files.map((f, i) => (
                    <span key={i} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>{f.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: BUDGET ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>TIPO DE PRESUPUESTO</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {([
                  { value: "range" as const, label: "Rango",    desc: "Mín – Máx" },
                  { value: "fixed" as const, label: "Fijo",     desc: "Precio cerrado" },
                  { value: "hourly" as const, label: "Por hora", desc: "Tarifa/hr" },
                ]).map(t => (
                  <button key={t.value} onClick={() => setBudgetType(t.value)} style={optionCard(budgetType === t.value, "var(--brand)")}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{t.label}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
                  {budgetType === "range" ? "RANGO DE PRESUPUESTO" : "MONTO"}
                </label>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--accent)" }}>
                  {budgetType === "range" ? `${fmt(budgetMin)} – ${fmt(budgetMax)}` : fmt(budgetMin)}
                </span>
              </div>
              <input
                type="range" min="100" max="20000" step="100"
                value={budgetMin}
                onChange={e => { const v = +e.target.value; setBudgetMin(v); if (budgetMax < v) setBudgetMax(v); }}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
              {budgetType === "range" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--faint)", marginBottom: "4px" }}>
                    <span>Mínimo: {fmt(budgetMin)}</span><span>Máximo: {fmt(budgetMax)}</span>
                  </div>
                  <input
                    type="range" min={budgetMin} max="50000" step="100"
                    value={budgetMax}
                    onChange={e => setBudgetMax(+e.target.value)}
                    style={{ width: "100%", accentColor: "var(--accent)" }}
                  />
                </>
              )}
            </div>

            {/* Budget Intelligence widget */}
            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 16 }}>
              <button
                type="button"
                disabled={budgetLoading || !title.trim()}
                onClick={async () => {
                  setBudgetLoading(true);
                  try {
                    const s = await suggestBudget({ title, scope: description, category: categoryId ?? undefined });
                    setBudgetSuggestion(s);
                    if (s.min > 0) {
                      setBudgetMin(s.min);
                      setBudgetMax(s.max);
                    }
                  } catch { /* ignore */ }
                  finally { setBudgetLoading(false); }
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "9px 16px", borderRadius: 10, border: "1px solid var(--border)",
                  background: "rgba(129,140,248,.08)", color: "#818cf8", fontWeight: 700, fontSize: 12,
                  cursor: !title.trim() ? "not-allowed" : "pointer", opacity: !title.trim() ? 0.5 : 1,
                }}
              >
                <Sparkles size={14} />
                {budgetLoading ? "Analizando mercado..." : "Sugerir presupuesto con IA"}
              </button>
              {!title.trim() && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Completa el título primero</p>}

              {budgetSuggestion && (
                <div style={{
                  marginTop: 12, padding: "14px 16px", borderRadius: 14,
                  background: "rgba(129,140,248,.06)", border: "1px solid rgba(129,140,248,.2)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Estimación del mercado</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      background: budgetSuggestion.confidence === "high" ? "rgba(16,185,129,.15)" : budgetSuggestion.confidence === "medium" ? "rgba(251,191,36,.15)" : "rgba(148,163,184,.15)",
                      color: budgetSuggestion.confidence === "high" ? "#10b981" : budgetSuggestion.confidence === "medium" ? "#fbbf24" : "#94a3b8",
                      textTransform: "uppercase",
                    }}>
                      {budgetSuggestion.confidence}
                    </span>
                  </div>
                  {budgetSuggestion.min > 0 && (
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--ink)", marginBottom: 6 }}>
                      ${budgetSuggestion.min.toLocaleString()} – ${budgetSuggestion.max.toLocaleString()} {budgetSuggestion.currency}
                      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>
                        (mediana ${budgetSuggestion.median.toLocaleString()})
                      </span>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 8 }}>{budgetSuggestion.aiNarrative}</p>
                  <p style={{ fontSize: 10, color: "#475569" }}>
                    {budgetSuggestion.basis} · {budgetSuggestion.similarJobsFound} trabajos similares
                  </p>
                  {budgetSuggestion.min > 0 && (
                    <p style={{ fontSize: 11, color: "#10b981", marginTop: 6, fontWeight: 600 }}>✓ Rango aplicado automáticamente a los sliders</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>URGENCIA</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                {JOB_URGENCY_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setUrgency(o.value)} style={optionCard(urgency === o.value, o.color)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{o.label}</p>
                      {urgency === o.value && <CheckCircle size={14} color={o.color} />}
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "3px" }}>{o.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>FECHA LÍMITE (opcional)</label>
              <input type="date" style={input} value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>
          </div>
        )}

        {/* ── STEP 4: REVIEW ── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "var(--bg)", borderRadius: "10px", border: "1px solid var(--border)", overflow: "hidden" }}>
              {[
                { label: "Categoría",   value: `${category?.name} → ${subcategory?.name}` },
                { label: "Título",      value: title },
                { label: "Ubicación",   value: locationType === "remote" ? "Remoto" : `${locationType === "on_site" ? "En sitio" : "Híbrido"}${city ? ` · ${city}` : ""}` },
                { label: "Presupuesto", value: budgetType === "range" ? `${fmt(budgetMin)} – ${fmt(budgetMax)}` : fmt(budgetMin) },
                { label: "Urgencia",    value: JOB_URGENCY_OPTIONS.find(o => o.value === urgency)?.label ?? urgency },
                ...(preferredProfessional ? [{ label: "Profesional objetivo", value: preferredProfessional.name }] : []),
                ...(deadline ? [{ label: "Fecha límite", value: new Date(deadline).toLocaleDateString("es-ES") }] : []),
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>{row.label}</span>
                  <span style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{row.value}</span>
                </div>
              ))}
              <div style={{ padding: "12px 16px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Descripción</span>
                <p style={{ fontSize: "13px", color: "var(--ink)", marginTop: "6px", lineHeight: 1.5 }}>{description}</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", padding: "14px", background: "#ff6a0010", border: "1px solid #ff6a0030", borderRadius: "10px" }}>
              <AlertCircle size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: "1px" }} />
              <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
                Al publicar aceptas los términos de servicio de SEMSE. El pago se realizará vía <strong>escrow</strong> para proteger ambas partes.
                {preferredProfessional ? " Después te llevaremos al matching del trabajo con tu perfil objetivo al frente." : ""}
              </p>
            </div>
          </div>
        )}
      </HtmlInCanvasPanel>

      {/* Submit error */}
      {submitError && (
        <div style={{ marginTop: "14px", padding: "12px 16px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.25)", borderRadius: "10px", color: "#ef4444", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
        {step === 1 ? (
          <Link
            href={CLIENT_ROUTES.dashboard}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "10px 18px", borderRadius: "9px",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--ink)", fontSize: "13px", fontWeight: 600, textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} /> Cancelar
          </Link>
        ) : (
          <button
            onClick={() => setStep(s => s - 1)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "10px 18px", borderRadius: "9px",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--ink)", cursor: "pointer",
              fontSize: "13px", fontWeight: 600,
            }}
          >
            <ArrowLeft size={14} /> Anterior
          </button>
        )}

        {step < STEPS.length ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "10px 18px", borderRadius: "9px",
              background: canProceed() ? "linear-gradient(135deg, var(--brand), #2563eb)" : "var(--surface)",
              color: canProceed() ? "#fff" : "var(--faint)", cursor: canProceed() ? "pointer" : "not-allowed",
              fontSize: "13px", fontWeight: 700, border: "none",
              boxShadow: canProceed() ? "0 4px 12px rgba(59,130,246,.3)" : "none",
            }}
          >
            Siguiente <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 22px", borderRadius: "9px",
              background: submitting ? "var(--surface)" : "linear-gradient(135deg, var(--accent), #ff8c00)",
              color: submitting ? "var(--faint)" : "#fff", cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "13px", fontWeight: 700, border: "none",
              boxShadow: submitting ? "none" : "0 4px 12px rgba(255,106,0,.35)",
            }}
          >
            {submitting ? (
              <><span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid #fff4", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Publicando...</>
            ) : (
              <><Briefcase size={14} /> Publicar trabajo</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
