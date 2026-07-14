"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  Send,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  fetchWorkerOpenings,
  submitWorkerApplication,
  TRADE_OPTIONS,
  URGENCY_LABELS,
  formatBudgetRange,
  type WorkerOpening,
} from "./worker-apply-api";

export default function WorkerApplyIndexPage() {
  const [openings, setOpenings] = useState<WorkerOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [trade, setTrade] = useState(TRADE_OPTIONS[0]?.value ?? "general");
  const [yearsExperience, setYearsExperience] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await fetchWorkerOpenings(24);
        setOpenings(data);
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : "No se pudieron cargar las vacantes.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const filteredOpenings = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return openings;
    return openings.filter((opening) =>
      [opening.title, opening.category ?? "", opening.location ?? "", opening.scope]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [openings, query]);

  async function handleGeneralSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitWorkerApplication({
        fullName,
        email,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        trade,
        yearsExperience: yearsExperience ? Number.parseInt(yearsExperience, 10) : undefined,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo enviar tu aplicación.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400">
            <Wrench size={12} />
            <span>Únete a la red de profesionales SEMSE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold">Trabaja con SEMSE</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Aplica a una vacante abierta o envíanos tu perfil general. Pagos protegidos con escrow,
            reputación verificable y herramientas profesionales para tu oficio.
          </p>
        </section>

        {/* Openings */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <Briefcase size={18} className="text-[var(--brand)]" />
              Vacantes abiertas
            </h2>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por oficio, ciudad..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 pl-9 pr-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
              <Loader2 size={16} className="animate-spin" /> Cargando vacantes reales...
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-600 dark:text-red-400">
              {loadError}
            </div>
          ) : filteredOpenings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 p-8 text-center text-sm text-slate-500">
              {openings.length === 0
                ? "Por ahora no hay vacantes abiertas. Envía tu aplicación general y te contactaremos cuando haya trabajo de tu oficio."
                : "Ninguna vacante coincide con tu búsqueda."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOpenings.map((opening) => (
                <Link
                  key={opening.id}
                  href={`/worker/apply/${encodeURIComponent(opening.id)}`}
                  className="group rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-900/20 p-5 no-underline text-inherit hover:border-[var(--brand)] transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {opening.category ?? "General"}
                      </p>
                      <h3 className="text-base font-extrabold mt-1 group-hover:text-[var(--brand)] transition-colors">
                        {opening.title}
                      </h3>
                    </div>
                    {opening.urgency ? (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {URGENCY_LABELS[opening.urgency.toLowerCase()] ?? opening.urgency}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                    {opening.scope}
                  </p>
                  <div className="flex items-center justify-between text-xs mt-auto pt-2">
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <MapPin size={12} /> {opening.location ?? "Por definir"}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatBudgetRange(opening.budgetMin, opening.budgetMax)}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)]">
                    Aplicar a esta vacante <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* General application */}
        <section id="general" className="rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-900/20 p-6 sm:p-10">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <UserPlus size={12} />
                <span>Aplicación general</span>
              </div>
              <h2 className="text-2xl font-extrabold">¿No ves una vacante para ti?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Déjanos tu perfil y te contactaremos cuando haya trabajo de tu oficio en tu zona.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-3">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
                <h3 className="text-lg font-extrabold">¡Aplicación recibida!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nuestro equipo revisará tu perfil y te contactará por correo o teléfono.
                </p>
              </div>
            ) : (
              <form onSubmit={handleGeneralSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Nombre completo *
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Correo electrónico *
                  <input
                    required
                    type="email"
                    maxLength={160}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Teléfono / WhatsApp
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={30}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Ciudad
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    maxLength={80}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Oficio principal *
                  <select
                    value={trade}
                    onChange={(event) => setTrade(event.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                  >
                    {TRADE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Años de experiencia
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={yearsExperience}
                    onChange={(event) => setYearsExperience(event.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-bold text-slate-500">
                  Cuéntanos de tu experiencia
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Trabajos que dominas, certificaciones, herramienta propia, disponibilidad..."
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--brand)] resize-y"
                  />
                </label>

                {submitError ? (
                  <p className="sm:col-span-2 text-xs font-bold text-red-500 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">
                    {submitError}
                  </p>
                ) : null}

                <div className="sm:col-span-2 flex justify-center pt-2">
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
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
