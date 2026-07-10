"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  fetchWorkerOpening,
  submitWorkerApplication,
  TRADE_OPTIONS,
  URGENCY_LABELS,
  formatBudgetRange,
  type WorkerOpening,
} from "../worker-apply-api";

export default function WorkerApplyOpeningPage() {
  const params = useParams<{ id: string }>();
  const openingId = typeof params?.id === "string" ? params.id : "";

  const [opening, setOpening] = useState<WorkerOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [trade, setTrade] = useState(TRADE_OPTIONS[0]?.value ?? "general");
  const [yearsExperience, setYearsExperience] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    if (!openingId) {
      setLoadError("Vacante inválida.");
      setLoading(false);
      return;
    }
    const run = async () => {
      try {
        const data = await fetchWorkerOpening(openingId);
        setOpening(data);
        if (data.category) {
          const category = data.category.toLowerCase();
          const match = TRADE_OPTIONS.find((option) =>
            category.includes(option.value) || option.label.toLowerCase().includes(category),
          );
          if (match) setTrade(match.value);
        }
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : "No se pudo cargar la vacante.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [openingId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !opening) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const parsedRate = proposedRate ? Number.parseFloat(proposedRate) : undefined;
      const receipt = await submitWorkerApplication({
        fullName,
        email,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        trade,
        yearsExperience: yearsExperience ? Number.parseInt(yearsExperience, 10) : undefined,
        proposedRate: parsedRate != null && Number.isFinite(parsedRate) ? parsedRate : undefined,
        message: message.trim() || undefined,
        jobId: opening.id,
      });
      setReceiptId(receipt.applicationId);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo enviar tu aplicación.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]";

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        <Link
          href="/worker/apply"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[var(--brand)] transition-colors no-underline"
        >
          <ArrowLeft size={16} />
          Todas las vacantes
        </Link>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-16 justify-center">
            <Loader2 size={16} className="animate-spin" /> Cargando vacante...
          </div>
        ) : loadError || !opening ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center space-y-3">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              {loadError ?? "Vacante no disponible."}
            </p>
            <p className="text-xs text-slate-500">
              Es posible que la vacante ya haya sido cubierta. Revisa las vacantes abiertas o envía una aplicación general.
            </p>
            <Link
              href="/worker/apply"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] text-white text-xs font-bold px-5 py-2.5 no-underline"
            >
              Ver vacantes abiertas
            </Link>
          </div>
        ) : receiptId ? (
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10 text-center space-y-4">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <h1 className="text-2xl font-extrabold">¡Aplicación enviada!</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Recibimos tu aplicación para <strong>{opening.title}</strong>. Nuestro equipo la revisará
              y te contactará por correo o teléfono. Guarda tu folio:
            </p>
            <p className="text-xs font-mono font-bold bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 inline-block">
              {receiptId}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* Opening details */}
            <section className="lg:col-span-2 rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-900/20 p-6 space-y-5">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {opening.category ?? "General"}
                </span>
                <h1 className="text-xl font-extrabold mt-1">{opening.title}</h1>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{opening.scope}</p>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <MapPin size={14} className="text-[var(--brand)]" />
                  {opening.location ?? "Ubicación por definir"}
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <DollarSign size={14} className="text-emerald-500" />
                  Presupuesto: <strong className="text-[var(--ink)]">{formatBudgetRange(opening.budgetMin, opening.budgetMax)}</strong>
                </div>
                {opening.urgency ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Briefcase size={14} className="text-amber-500" />
                    Urgencia: {URGENCY_LABELS[opening.urgency.toLowerCase()] ?? opening.urgency}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <ShieldCheck size={13} /> Pago protegido con escrow
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  El cliente fondea el trabajo antes de empezar. Cobras contra evidencia
                  de avance, con la reputación respaldada por SEMSE.
                </p>
              </div>
            </section>

            {/* Application form */}
            <section className="lg:col-span-3 rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-900/20 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <UserCheck size={16} className="text-[var(--brand)]" />
                <h2 className="text-lg font-extrabold">Aplicar a esta vacante</h2>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Nombre completo *
                  <input required minLength={2} maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Correo electrónico *
                  <input required type="email" maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Teléfono / WhatsApp
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Ciudad
                  <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Oficio principal *
                  <select value={trade} onChange={(e) => setTrade(e.target.value)} className={inputClass}>
                    {TRADE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Años de experiencia
                  <input type="number" min={0} max={60} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className={inputClass} />
                </label>
                <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Tu propuesta económica (opcional)
                  <input
                    type="number"
                    min={0}
                    step="50"
                    value={proposedRate}
                    onChange={(e) => setProposedRate(e.target.value)}
                    placeholder={`Referencia del cliente: ${formatBudgetRange(opening.budgetMin, opening.budgetMax)}`}
                    className={inputClass}
                  />
                </label>
                <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-bold text-slate-500">
                  ¿Por qué eres la persona indicada?
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Experiencia en trabajos similares, herramienta propia, disponibilidad..."
                    className={`${inputClass} resize-y`}
                  />
                </label>

                {submitError ? (
                  <p className="sm:col-span-2 text-xs font-bold text-red-500 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">
                    {submitError}
                  </p>
                ) : null}

                <div className="sm:col-span-2 flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] text-white text-sm font-bold px-8 py-3 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {submitting ? "Enviando..." : "Enviar aplicación"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
