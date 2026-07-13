"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, ArrowRight, Zap, RefreshCw } from "lucide-react";
import { PublicLandingFeaturedJob } from "../../lib/public-landing";

interface FeaturedJobsFeedProps {
  jobs: PublicLandingFeaturedJob[];
}

const FALLBACK_JOBS: PublicLandingFeaturedJob[] = [
  {
    id: "job-1",
    title: "Pintura de departamento completo",
    category: "Pintura",
    scope: "Se requiere pintar paredes y techos de un departamento de 80m2. Incluye sala, cocina, pasillo y 2 recámaras. Se proporciona pintura vinílica mate de primera calidad.",
    status: "POSTED",
    budgetMin: 1800,
    budgetMax: 2600,
    location: "Tallahassee, FL",
    urgency: "urgent",
  },
  {
    id: "job-2",
    title: "Reparación de plafón de tablaroca dañado por humedad",
    category: "Drywall",
    scope: "Reparación de sección de 1.5 x 2 metros en plafón de cocina. Requiere cambio de placas, encintado, compuesto y preparación final para pintura.",
    status: "IN_PROGRESS",
    budgetMin: 450,
    budgetMax: 700,
    location: "Orlando, FL",
    urgency: "high",
  },
  {
    id: "job-3",
    title: "Remodelación de baño de visitas",
    category: "Remodelación",
    scope: "Instalación de nueva loseta cerámica en muros y piso, cambio de taza de baño, lavamanos y colocación de accesorios de grifería.",
    status: "POSTED",
    budgetMin: 6500,
    budgetMax: 9500,
    location: "Tampa, FL",
    urgency: "standard",
  },
  {
    id: "job-4",
    title: "Mantenimiento preventivo de aire acondicionado",
    category: "Mantenimiento",
    scope: "Servicio de limpieza y recarga de refrigerante para 3 equipos minisplit inverter de 1.5 toneladas.",
    status: "REVIEW",
    budgetMin: 350,
    budgetMax: 550,
    location: "Miami, FL",
    urgency: "standard",
  },
  {
    id: "job-5",
    title: "Instalación de piso laminado residencial",
    category: "Pisos",
    scope: "Colocación de piso laminado de 8mm sobre superficie nivelada en recámara principal y vestidor. Aprox 30m2.",
    status: "AWARDED",
    budgetMin: 1400,
    budgetMax: 2000,
    location: "Jacksonville, FL",
    urgency: "high",
  },
];

const URGENCY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  standard: "Estándar",
  low: "Baja",
};

function timeSince(index: number) {
  const times = [
    "hace 2 min",
    "hace 12 min",
    "hace 45 min",
    "hace 2 horas",
    "hace 4 horas",
  ];
  return times[index % times.length];
}

function jobStatusBadge(status: string) {
  const labels: Record<string, { text: string; css: string }> = {
    POSTED: { text: "Activo / Recibiendo propuestas", css: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    PUBLISHED: { text: "Activo / Recibiendo propuestas", css: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    IN_PROGRESS: { text: "En ejecución", css: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    REVIEW: { text: "En revisión de entrega", css: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    AWARDED: { text: "Asignado", css: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    COMPLETED: { text: "Completado y pagado", css: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  };

  const current = labels[status] ?? { text: status, css: "bg-slate-500/10 text-slate-600 dark:text-slate-400" };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${current.css}`}>
      <span className="relative flex h-2 w-2">
        {status === "POSTED" || status === "PUBLISHED" ? (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        ) : null}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${
          status === "POSTED" || status === "PUBLISHED" ? "bg-emerald-500" :
          status === "IN_PROGRESS" ? "bg-blue-500" :
          status === "REVIEW" ? "bg-purple-500" : "bg-slate-400"
        }`}></span>
      </span>
      {current.text}
    </span>
  );
}

export function FeaturedJobsFeed({ jobs }: FeaturedJobsFeedProps) {
  const initialItems = jobs.length > 0 ? jobs : FALLBACK_JOBS;
  const [items, setItems] = useState<PublicLandingFeaturedJob[]>(initialItems);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulate periodic feed refresh to feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      setTimeout(() => {
        // Rotate the array items slightly to simulate a new live job popping up at the top
        setItems((prev) => {
          const next = [...prev];
          const last = next.pop();
          if (last) next.unshift(last);
          return next;
        });
        setIsRefreshing(false);
      }, 800);
    }, 15000); // refresh every 15s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Live Feed Header Bar */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200/50 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
            Feed de Actividad en Tiempo Real
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
          <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
          <span>{isRefreshing ? "Actualizando..." : "Autorefrescando"}</span>
        </div>
      </div>

      {/* Feed Stack */}
      <div className="space-y-4">
        {items.slice(0, 4).map((job, idx) => (
          <div
            key={job.id}
            className="group/item bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-350 relative overflow-hidden flex flex-col md:flex-row justify-between gap-6"
          >
            {/* Glowing Accent Border on active */}
            <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-blue-500 to-indigo-500 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />

            {/* Left Block: Info */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {jobStatusBadge(job.status)}
                
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold tracking-wide uppercase">
                  {job.category ?? "General"}{job.location ? ` · 📍 ${job.location}` : ""}
                </span>

                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold italic">
                  {timeSince(idx)}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors duration-250">
                  {job.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1 line-clamp-2">
                  {job.scope}
                </p>
              </div>
            </div>

            {/* Right Block: Budget & CTA */}
            <div className="flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end gap-4 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/60 pt-4 md:pt-0 md:pl-6">
              <div className="text-left md:text-right">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">
                  Presupuesto
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {job.budgetMin !== null
                    ? `$${job.budgetMin.toLocaleString("en-US")}${job.budgetMax !== null ? ` - $${job.budgetMax.toLocaleString("en-US")}` : ""}`
                    : "Por definir"}
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                  Urgencia: <span className={
                    job.urgency === "urgent" ? "text-red-500 font-extrabold" :
                    job.urgency === "high" ? "text-amber-500" : "text-slate-400"
                  }>{URGENCY_LABELS[job.urgency ?? "standard"] ?? "Estándar"}</span>
                </div>
              </div>

              <a
                href={`/worker/apply/${job.id}`}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover/item:bg-blue-600 group-hover/item:text-white text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm active:scale-98 transition-all duration-200"
              >
                <span>Postularme</span>
                <ArrowRight size={14} className="transform group-hover/item:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
