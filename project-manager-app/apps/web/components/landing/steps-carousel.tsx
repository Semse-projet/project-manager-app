"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Sparkles,
  Users,
  ShieldCheck,
  Layers,
  DollarSign,
  CheckCircle2,
  Scale,
  ArrowRight,
  Sparkle
} from "lucide-react";

interface StepItem {
  num: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accentColor: string;
  details: string[];
}

const STEPS: StepItem[] = [
  {
    num: "01",
    title: "Publica tu proyecto",
    desc: "Describe qué necesitas: construcción, remodelación, mantenimiento, reparación o soporte administrativo.",
    icon: Briefcase,
    accentColor: "from-blue-500 to-indigo-500",
    details: [
      "Wizard guiado paso a paso",
      "Sugerencias automáticas por categoría",
      "Sube fotos y planos de referencia",
      "Define plazos y presupuesto estimado"
    ]
  },
  {
    num: "02",
    title: "Prometeo analiza la solicitud",
    desc: "Nuestra IA analiza el alcance de la obra o servicio, detecta urgencias, resume la necesidad y sugiere checklists.",
    icon: Sparkles,
    accentColor: "from-violet-500 to-purple-500",
    details: [
      "Extracción inteligente de requerimientos",
      "Clasificación automática de riesgo y categoría",
      "Creación sugerida de hitos operacionales",
      "Estimación preliminar de viabilidad"
    ]
  },
  {
    num: "03",
    title: "Recibe propuestas",
    desc: "Profesionales verificados envían cotizaciones estructuradas con precios, tiempos, experiencia y disponibilidad.",
    icon: Users,
    accentColor: "from-emerald-500 to-teal-500",
    details: [
      "Ofertas comparables ítem por ítem",
      "Acceso al portafolio y calificaciones del pro",
      "Chat seguro con traducción o glosario si aplica",
      "Evidencia de licencias y certificaciones"
    ]
  },
  {
    num: "04",
    title: "Elige con confianza",
    desc: "Compara propuestas basándote en reputación verificada, trust score, historial real y testimonios.",
    icon: ShieldCheck,
    accentColor: "from-amber-500 to-orange-500",
    details: [
      "Trust score dinámico por profesional",
      "Revisión de proyectos previos similares",
      "Validación de antecedentes e identidad",
      "Entrevistas integradas y chat seguro"
    ]
  },
  {
    num: "05",
    title: "Crea hitos y acuerdo",
    desc: "El proyecto se organiza en fases o hitos claros de entrega con fechas y montos específicos.",
    icon: Layers,
    accentColor: "from-cyan-500 to-blue-500",
    details: [
      "Contrato digital autogenerado",
      "Checklists específicas para aprobar cada hito",
      "Fechas de entrega vinculadas al cronograma",
      "Definición clara de criterios de aceptación"
    ]
  },
  {
    num: "06",
    title: "Protege el pago en escrow",
    desc: "El dinero del hito activo se deposita en una cuenta de garantía segura y solo se libera al aprobar la entrega.",
    icon: DollarSign,
    accentColor: "from-lime-500 to-emerald-500",
    details: [
      "Fondos resguardados de forma segura",
      "Garantía de cobro para el profesional",
      "Protección contra abandono de obra",
      "Liberación parcial por hito completado"
    ]
  },
  {
    num: "07",
    title: "Documenta evidencias",
    desc: "Fotos, reportes, acuerdos y conversaciones quedan registrados en blockchain o logs inmutables por cada hito.",
    icon: CheckCircle2,
    accentColor: "from-pink-500 to-rose-500",
    details: [
      "Bitácora fotográfica diaria en campo",
      "Validación de fotos por metadatos (hora y GPS)",
      "Registro inmutable de chats y cambios de alcance",
      "Aprobaciones explícitas firmadas digitalmente"
    ]
  },
  {
    num: "08",
    title: "Cierre con historial completo",
    desc: "SEMSE compila el reporte final de entrega, historial financiero, evidencias y abre soporte si hay disputa.",
    icon: Scale,
    accentColor: "from-indigo-500 to-violet-500",
    details: [
      "Generación de dossier de entrega final",
      "Actualización del trust score de ambas partes",
      "Facturación unificada y reportes fiscales",
      "Soporte mediado por IA y arbitraje humano"
    ]
  }
];

export function StepsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<number>(0);

  useEffect(() => {
    // Progress bar tick
    const intervalTime = 100; // 100ms
    const totalTime = 7000; // 7 seconds per step
    const stepTick = (intervalTime / totalTime) * 100;

    if (!isHovered) {
      timerRef.current = setInterval(() => {
        progressRef.current += stepTick;
        if (progressRef.current >= 100) {
          progressRef.current = 0;
          setActiveIndex((prev) => (prev + 1) % STEPS.length);
        }
        setProgress(progressRef.current);
      }, intervalTime);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  const selectStep = (index: number) => {
    setActiveIndex(index);
    progressRef.current = 0;
    setProgress(0);
  };

  const currentStep = STEPS[activeIndex];
  const StepIcon = currentStep.icon;

  return (
    <div
      className="max-w-6xl mx-auto bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Horizontal Nav / Timeline (Scrollable on mobile) */}
      <div
        className="flex gap-2 overflow-x-auto pb-4 mb-10 border-b border-slate-100 dark:border-slate-800/80 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === activeIndex;
          return (
            <button
              key={step.num}
              onClick={() => selectStep(index)}
              className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-350 cursor-pointer ${
                isActive
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-extrabold shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {step.num}
              </span>
              <span className="text-sm hidden sm:inline">{step.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[360px]">
        {/* Left Side: Illustration / Icon Container */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[260px] bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850 p-8 overflow-hidden group">
          {/* Animated Glowing Accent */}
          <div className={`absolute inset-0 bg-gradient-to-br ${currentStep.accentColor} opacity-5 group-hover:opacity-10 transition-opacity duration-500`} />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotate: 10 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="relative"
            >
              {/* Outer decorative ring */}
              <div className={`w-32 h-32 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center animate-spin-slow`} />
              
              {/* Central Icon container */}
              <div className={`absolute inset-4 rounded-full bg-gradient-to-br ${currentStep.accentColor} text-white flex items-center justify-center shadow-lg`}>
                <StepIcon size={44} />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progress Bar (Auto-slide indicator) */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full bg-gradient-to-r ${currentStep.accentColor} transition-all duration-100 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Right Side: Step Details */}
        <div className="lg:col-span-7 flex flex-col justify-between h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${currentStep.accentColor} text-white text-[10px] font-extrabold uppercase tracking-widest mb-3`}>
                  Paso {currentStep.num}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                  {currentStep.title}
                </h3>
              </div>

              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                {currentStep.desc}
              </p>

              {/* List of Details / Features of this step */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {currentStep.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Sparkle size={14} className="text-blue-500 mt-1 shrink-0 fill-blue-500/10" />
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {detail}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Quick CTA to advance or start */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800/60 mt-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
              {isHovered ? "⏸ Autoreproducción pausada" : "▶ Autoreproduciendo"}
            </span>

            <button
              onClick={() => selectStep((activeIndex + 1) % STEPS.length)}
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 group transition-colors duration-200 cursor-pointer"
            >
              <span>Ver siguiente paso</span>
              <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform duration-200" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
