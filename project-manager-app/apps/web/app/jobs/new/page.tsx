"use client";

import type { JobRecordView } from "@semse/schemas";
import { HtmlInCanvasPanel } from "@semse/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createRuntimeJob, semseRuntimeEnabled } from "../../semse-api";
import { Button } from "../../../components/ui/button";
import { Input, Textarea } from "../../../components/ui/input";
import { FeedbackBanner } from "../../../components/ui/error-state";
import { cn } from "../../../lib/cn";

// ── Tipos de formulario ───────────────────────────────────────
interface WizardForm {
  // Paso 1 — Descripción
  title: string;
  scope: string;
  // Paso 2 — Presupuesto
  budgetType: "FIXED" | "RANGE" | "TIME_AND_MATERIALS";
  budgetMin: string;
  budgetMax: string;
  urgency: "low" | "medium" | "high" | "urgent";
  deadline: string;
}

const initialForm: WizardForm = {
  title:            "",
  scope:            "",
  budgetType:       "RANGE",
  budgetMin:        "500",
  budgetMax:        "2500",
  urgency:          "medium",
  deadline:         "",
};

// ── Pasos del wizard ──────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Descripción",  desc: "Título y alcance del proyecto" },
  { id: 2, label: "Presupuesto",  desc: "Define el rango de precios" },
  { id: 3, label: "Revisar",      desc: "Confirma y publica" },
];

const URGENCY_OPTIONS: Array<{ value: WizardForm["urgency"]; label: string; desc: string; color: string }> = [
  { value: "low",    label: "Baja",    desc: "Sin prisa, flexible",           color: "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-400" },
  { value: "medium", label: "Media",   desc: "En las próximas semanas",        color: "border-brand/30 bg-brand/[0.05] text-brand" },
  { value: "high",   label: "Alta",    desc: "Esta semana",                    color: "border-amber-500/30 bg-amber-500/[0.05] text-amber-400" },
  { value: "urgent", label: "Urgente", desc: "Lo antes posible",              color: "border-red-500/30 bg-red-500/[0.05] text-red-400" },
];

const BUDGET_TYPE_OPTIONS: Array<{ value: WizardForm["budgetType"]; label: string; desc: string }> = [
  { value: "FIXED",             label: "Precio fijo",       desc: "Monto cerrado acordado" },
  { value: "RANGE",             label: "Rango",             desc: "Entre un mínimo y máximo" },
  { value: "TIME_AND_MATERIALS",label: "Por hora",          desc: "Tarifa por hora trabajada" },
];

// ── Helpers ───────────────────────────────────────────────────
function normalizeMoney(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

// ── Step indicator ────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <HtmlInCanvasPanel as="section" className="mb-8" aria-label="Progreso del formulario" canvasClassName="rounded-2xl" minHeight={120}>
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done    = step.id < current;
          const active  = step.id === current;
          const pending = step.id > current;

          return (
            <div key={step.id} className="flex flex-1 items-center">
              {/* Nodo */}
              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                    done   && "border-emerald-500 bg-emerald-500 text-white",
                    active && "border-brand bg-brand/20 text-brand",
                    pending && "border-white/[0.12] bg-transparent text-muted"
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 16 16">
                      <path d="M2.5 8.5l4 4 7-8" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                {/* Label */}
                <div className="mt-1.5 text-center">
                  <p className={cn("text-[0.68rem] font-semibold", active ? "text-ink" : done ? "text-emerald-400" : "text-muted")}>
                    {step.label}
                  </p>
                  <p className="hidden text-[0.6rem] text-muted/60 sm:block">{step.desc}</p>
                </div>
              </div>
              {/* Conector */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-all",
                    done ? "bg-emerald-500/50" : "bg-white/[0.07]"
                  )}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </HtmlInCanvasPanel>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function PublishJobPage() {
  const runtimeEnabled = semseRuntimeEnabled();

  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<WizardForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [created, setCreated] = useState<JobRecordView | null>(null);

  function field(key: keyof WizardForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(c => ({ ...c, [key]: e.target.value }));
  }

  // Validación por paso
  const canProceed = useMemo(() => {
    if (step === 1) return form.title.trim().length >= 5 && form.scope.trim().length >= 10;
    if (step === 2) {
      const min = normalizeMoney(form.budgetMin);
      const max = normalizeMoney(form.budgetMax);
      if (form.budgetType === "RANGE") return (min ?? 0) > 0 && (max ?? 0) >= (min ?? 0);
      return (min ?? 0) > 0;
    }
    return true;
  }, [step, form]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const job = await createRuntimeJob({
        title:     form.title.trim(),
        scope:     form.scope.trim(),
        budgetMin: normalizeMoney(form.budgetMin),
        budgetMax: normalizeMoney(form.budgetMax),
        // TODO: enviar también budgetType, urgency, deadline cuando el schema los soporte
      });
      setCreated(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el job.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Pantalla de éxito ──────────────────────────────────────
  if (created) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl">
          ✓
        </div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-emerald-400">
          Job publicado
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{created.title}</h1>
        <p className="mt-2 text-sm text-muted">
          El job está listo. El siguiente paso es crear los milestones y fondear el escrow.
        </p>
        <p className="mt-1 font-mono text-xs text-muted/50">{created.id}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/jobs/${created.id}/escrow`}>
            <Button>Ir al Escrow →</Button>
          </Link>
          <Link href={`/jobs/${created.id}`}>
            <Button variant="ghost">Ver detalle</Button>
          </Link>
          <Button variant="ghost" onClick={() => { setCreated(null); setStep(1); setForm(initialForm); }}>
            Publicar otro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-brand transition-colors">Jobs</Link>
        <span aria-hidden className="text-white/20">/</span>
        <span className="text-ink font-medium">Publicar trabajo</span>
      </nav>

      {/* Header */}
      <HtmlInCanvasPanel as="section" className="mb-6" canvasClassName="rounded-2xl" minHeight={84}>
        <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-brand mb-1">
          Marketplace
        </p>
        <h1 className="text-xl font-bold tracking-tight text-ink">Publicar trabajo</h1>
        <p className="mt-1 text-sm text-muted">
          Completa los pasos para publicar tu proyecto y recibir propuestas.
        </p>
      </HtmlInCanvasPanel>

      {/* Runtime banner */}
      {!runtimeEnabled && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">Modo simulación</p>
          <p className="mt-0.5 text-xs text-amber-300/70">
            Configura NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true para crear jobs reales.
          </p>
        </div>
      )}

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Panel del paso ──────────────────────────────── */}
      <HtmlInCanvasPanel as="section" className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-6" canvasClassName="rounded-2xl" minHeight={360}>
        {/* Error */}
        {error && <div className="mb-4"><FeedbackBanner type="error" message={error} /></div>}

        {/* ── PASO 1: Descripción ─────────────────────── */}
        {step === 1 && (
          <div className="grid gap-5">
            <div>
              <h2 className="text-base font-semibold text-ink">¿Qué necesitas hacer?</h2>
              <p className="mt-0.5 text-xs text-muted">Sé específico — los mejores profesionales eligen los jobs bien descritos.</p>
            </div>
            <Input
              label="Título del proyecto"
              placeholder="Ej. Reparar filtración en techo de townhouse, unidad 5513"
              maxLength={140}
              value={form.title}
              onChange={field("title")}
              hint={`${form.title.length}/140 · mínimo 5 caracteres`}
            />
            <Textarea
              label="Alcance y descripción"
              placeholder="Qué hay que hacer, materiales necesarios, acceso al lugar, restricciones importantes, criterio de éxito…"
              maxLength={5000}
              rows={6}
              value={form.scope}
              onChange={field("scope")}
              hint={`${form.scope.length}/5000 · mínimo 10 caracteres`}
            />
          </div>
        )}

        {/* ── PASO 2: Presupuesto ─────────────────────── */}
        {step === 2 && (
          <div className="grid gap-6">
            <div>
              <h2 className="text-base font-semibold text-ink">¿Cuál es tu presupuesto?</h2>
              <p className="mt-0.5 text-xs text-muted">Define el rango. Los profesionales enviarán propuestas dentro de este rango.</p>
            </div>

            {/* Tipo de presupuesto */}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-muted">Tipo de presupuesto</legend>
              <div className="grid grid-cols-3 gap-2">
                {BUDGET_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(c => ({ ...c, budgetType: opt.value }))}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      form.budgetType === opt.value
                        ? "border-brand/50 bg-brand/10"
                        : "border-white/[0.08] bg-[#131328] hover:border-white/20"
                    )}
                  >
                    <p className={cn("text-xs font-semibold", form.budgetType === opt.value ? "text-brand" : "text-ink")}>
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-muted">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Montos */}
            <div className={cn("grid gap-3", form.budgetType === "RANGE" ? "grid-cols-2" : "grid-cols-1 max-w-xs")}>
              <Input
                label={form.budgetType === "RANGE" ? "Mínimo (USD)" : "Monto (USD)"}
                inputMode="decimal"
                placeholder="500"
                value={form.budgetMin}
                onChange={field("budgetMin")}
              />
              {form.budgetType === "RANGE" && (
                <Input
                  label="Máximo (USD)"
                  inputMode="decimal"
                  placeholder="2500"
                  value={form.budgetMax}
                  onChange={field("budgetMax")}
                />
              )}
            </div>

            {/* Urgencia */}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-muted">Urgencia</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {URGENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(c => ({ ...c, urgency: opt.value }))}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      form.urgency === opt.value
                        ? opt.color
                        : "border-white/[0.08] bg-[#131328] hover:border-white/20"
                    )}
                  >
                    <p className="text-xs font-semibold text-ink">{opt.label}</p>
                    <p className="mt-0.5 text-[0.65rem] text-muted">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Fecha límite */}
            <Input
              label="Fecha límite (opcional)"
              type="date"
              value={form.deadline}
              onChange={field("deadline")}
            />
          </div>
        )}

        {/* ── PASO 3: Revisar ─────────────────────────── */}
        {step === 3 && (
          <div className="grid gap-5">
            <div>
              <h2 className="text-base font-semibold text-ink">Revisa antes de publicar</h2>
              <p className="mt-0.5 text-xs text-muted">Confirma que todo está correcto.</p>
            </div>

            <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-[#131328] p-4 text-sm">
              {[
                { label: "Título",       value: form.title },
                {
                  label: "Presupuesto",
                  value: form.budgetType === "RANGE"
                    ? `${formatCurrency(normalizeMoney(form.budgetMin) ?? 0)} – ${formatCurrency(normalizeMoney(form.budgetMax) ?? 0)}`
                    : formatCurrency(normalizeMoney(form.budgetMin) ?? 0)
                },
                {
                  label: "Urgencia",
                  value: URGENCY_OPTIONS.find(o => o.value === form.urgency)?.label ?? "—"
                },
                ...(form.deadline ? [{
                  label: "Fecha límite",
                  value: new Date(form.deadline).toLocaleDateString("es-MX")
                }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                  <span className="text-xs text-muted">{label}</span>
                  <span className="text-right text-xs font-medium text-ink max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            {/* Alcance colapsado */}
            <details className="rounded-xl border border-white/[0.06] bg-[#131328]">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-muted hover:text-ink">
                Ver descripción completa
              </summary>
              <p className="border-t border-white/[0.04] px-4 py-3 text-xs leading-relaxed text-ink/80">
                {form.scope}
              </p>
            </details>

            {/* Términos */}
            <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/[0.04] px-4 py-3">
              <span className="mt-0.5 text-brand" aria-hidden>ℹ</span>
              <p className="text-xs text-muted/80">
                Al publicar aceptas los términos de SEMSE. El pago se procesará vía escrow
                para proteger a ambas partes durante el proyecto.
              </p>
            </div>
          </div>
        )}
      </HtmlInCanvasPanel>

      {/* ── Navegación del wizard ──────────────────────────── */}
      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={step === 1}
          onClick={() => setStep(s => Math.max(1, s - 1))}
        >
          ← Anterior
        </Button>

        {step < STEPS.length ? (
          <Button
            disabled={!canProceed}
            onClick={() => setStep(s => Math.min(STEPS.length, s + 1))}
          >
            Siguiente →
          </Button>
        ) : (
          <Button
            disabled={!runtimeEnabled}
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            Publicar trabajo
          </Button>
        )}
      </div>
    </div>
  );
}
