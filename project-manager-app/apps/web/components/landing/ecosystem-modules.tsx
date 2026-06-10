"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calculator,
  Zap,
  Camera,
  Lock,
  ArrowLeftRight,
  Sparkles,
  Scale
} from "lucide-react";
import { ecosystemModules, type EcosystemModule } from "./landing-routes";

interface StyleDef {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  glowColor: string;
  bulletColor: string;
  bullets: string[];
}

const MODULE_STYLES: Record<string, StyleDef> = {
  protools: {
    icon: Calculator,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    glowColor: "bg-blue-500/5",
    bulletColor: "bg-blue-500",
    bullets: ["Estimación de metros cuadrados", "Precios base por región", "Simulador de materiales y mano de obra"]
  },
  buildops: {
    icon: Zap,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    glowColor: "bg-amber-500/5",
    bulletColor: "bg-amber-500",
    bullets: ["Checklists dinámicos por hito", "Reporte de incidencias en obra", "Control de tiempos y asistencia"]
  },
  evidence: {
    icon: Camera,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    glowColor: "bg-cyan-500/5",
    bulletColor: "bg-cyan-500",
    bullets: ["Fotos de antes y después", "Validación metadatos de imágenes", "Firmas digitales del acuerdo"]
  },
  escrow: {
    icon: Lock,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    glowColor: "bg-emerald-500/5",
    bulletColor: "bg-emerald-500",
    bullets: ["Cuentas de depósito en garantía (Escrow)", "Liberaciones parciales y reembolsos", "Conciliación financiera transparente"]
  },
  marketplace: {
    icon: ArrowLeftRight,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    glowColor: "bg-orange-500/5",
    bulletColor: "bg-orange-500",
    bullets: ["Matching inteligente por especialidad", "Historial de trabajos anteriores", "Cotizaciones comparativas automáticas"]
  },
  prometeo: {
    icon: Sparkles,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    glowColor: "bg-purple-500/5",
    bulletColor: "bg-purple-500",
    bullets: ["Análisis RAG de contratos", "Auditoría automática de fotos", "Recomendación de hitos y plazos"]
  },
  trust: {
    icon: Scale,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    glowColor: "bg-rose-500/5",
    bulletColor: "bg-rose-500",
    bullets: ["Trust Score basado en comportamiento", "Verificación de antecedentes e identidad", "Flujo asistido para resolución de conflictos"]
  }
};

export function EcosystemModules() {
  const mergedModules = useMemo(() => {
    return ecosystemModules.map((mod) => {
      const styles = MODULE_STYLES[mod.id] || {
        icon: Sparkles,
        color: "text-slate-500 bg-slate-500/10 border-slate-500/20",
        glowColor: "bg-slate-500/5",
        bulletColor: "bg-slate-500",
        bullets: []
      };
      return {
        ...mod,
        ...styles
      };
    });
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch justify-center">
        {mergedModules.map((mod, index) => {
          const IconComponent = mod.icon;
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className={`block no-underline select-none ${
                mod.id === "prometeo" ? "lg:col-span-2 xl:col-span-2" : ""
              }`}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-slate-350 dark:hover:border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 h-full cursor-pointer"
              >
                {/* Glow backdrop effect */}
                <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full ${mod.glowColor} blur-[32px] pointer-events-none`} />

                <div>
                  {/* Icon wrapper */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${mod.color} mb-5`}>
                    <IconComponent size={20} className="shrink-0" />
                  </div>

                  {/* Title & Desc */}
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">
                    {mod.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {mod.description}
                  </p>
                </div>

                {/* Bullets list */}
                {mod.bullets.length > 0 && (
                  <div className="mt-auto border-t border-slate-100 dark:border-slate-800/60 pt-4">
                    <ul className="space-y-2 list-none p-0 m-0">
                      {mod.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-650 dark:text-slate-400">
                          <div className={`w-1 h-1 rounded-full ${mod.bulletColor} shrink-0 mt-1.5`} />
                          <span className="leading-tight">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
