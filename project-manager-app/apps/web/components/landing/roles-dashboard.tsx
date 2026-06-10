"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Briefcase,
  Users,
  CheckCircle2,
  DollarSign,
  Layers,
  Activity
} from "lucide-react";

import { roleCards } from "./landing-routes";

interface RoleDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  href: string;
  color: string;
  borderColor: string;
  bg: string;
}

const ROLE_STYLES: Record<string, { icon: string; color: string; borderColor: string; bg: string }> = {
  client: {
    icon: "🏢",
    color: "text-blue-600 dark:text-blue-400",
    borderColor: "group-hover:border-blue-500/50 hover:border-blue-500/50",
    bg: "bg-blue-500/10"
  },
  worker: {
    icon: "🔨",
    color: "text-emerald-600 dark:text-emerald-400",
    borderColor: "group-hover:border-emerald-500/50 hover:border-emerald-500/50",
    bg: "bg-emerald-500/10"
  },
  admin: {
    icon: "⚙️",
    color: "text-violet-600 dark:text-violet-400",
    borderColor: "group-hover:border-violet-500/50 hover:border-violet-500/50",
    bg: "bg-violet-500/10"
  }
};

export function RolesDashboard() {
  const [activeRole, setActiveRole] = useState("client");

  const roles = React.useMemo(() => {
    return roleCards.map((rc) => {
      const styles = ROLE_STYLES[rc.id] || {
        icon: "🔨",
        color: "text-slate-600 dark:text-slate-400",
        borderColor: "group-hover:border-slate-500/50 hover:border-slate-550/50",
        bg: "bg-slate-500/10"
      };
      return {
        id: rc.id,
        label: rc.title,
        desc: rc.description,
        href: rc.href,
        ...styles
      };
    });
  }, []);

  // Client Mockup Interactive states
  const [milestone2Status, setMilestone2Status] = useState<"locked" | "released">("locked");
  const [showEvidences, setShowEvidences] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Left side: Role selectors (5 cols) */}
      <div className="lg:col-span-5 flex flex-col justify-center gap-4">
        {roles.map((role) => {
          const isActive = role.id === activeRole;
          return (
            <div
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`group flex flex-col justify-between p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                isActive
                  ? "bg-white dark:bg-slate-900 border-indigo-500/80 shadow-md animate-fade-in"
                  : "bg-white/40 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800/40 hover:bg-white dark:hover:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{role.icon}</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {role.label}
                    </h3>
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  {role.desc}
                </p>
              </div>

              <Link
                href={role.href}
                className={`inline-flex items-center justify-between font-bold text-xs ${role.color} no-underline mt-2`}
              >
                <span>Acceder al portal</span>
                <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Right side: Glassmorphism Dashboard Preview (7 cols) */}
      <div className="lg:col-span-7 bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 backdrop-blur-md flex flex-col justify-between min-h-[440px] relative overflow-hidden shadow-xl">
        {/* Background ambient light */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-10">
          <div className="absolute top-10 right-10 w-[250px] h-[250px] rounded-full bg-indigo-500 blur-[60px]" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {activeRole === "client" && (
              <motion.div
                key="client-preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                {/* Header card preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Portal de Clientes</span>
                      <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">Remodelación de Baño Principal</h4>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      En ejecución
                    </span>
                  </div>

                  {/* Progress bar info */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Progreso global</span>
                      <span>{milestone2Status === "released" ? "90%" : "65%"}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: milestone2Status === "released" ? "90%" : "65%" }} />
                    </div>
                  </div>
                </div>

                {/* Milestone tracking panel */}
                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850 p-4 rounded-2xl">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-1.5 flex justify-between items-center">
                    <span>Estructura de Escrow por Hito</span>
                    <button
                      type="button"
                      onClick={() => setShowEvidences(!showEvidences)}
                      className="text-[9px] font-black uppercase text-indigo-550 dark:text-indigo-400 hover:underline cursor-pointer select-none"
                    >
                      {showEvidences ? "Ocultar Evidencia" : "Ver Evidencia Foto"}
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-900 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span className="font-bold text-slate-700 dark:text-slate-250">Hito 1: Demolición y desmontaje</span>
                      </div>
                      <span className="text-slate-400 dark:text-slate-500 font-bold">$4,500 MXN · Pagado</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-900 pb-2">
                      <div className="flex items-center gap-2">
                        {milestone2Status === "released" ? (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500/80 flex items-center justify-center text-[8px] text-indigo-500 font-black shrink-0">▶</span>
                        )}
                        <span className="font-bold text-slate-700 dark:text-slate-250">Hito 2: Tuberías y desagües</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${milestone2Status === "released" ? "text-slate-400" : "text-indigo-600 dark:text-indigo-400"} font-bold`}>
                          {milestone2Status === "released" ? "$5,800 MXN · Pagado" : "$5,800 MXN · Bloqueado"}
                        </span>
                        {milestone2Status === "locked" && (
                          <button
                            type="button"
                            onClick={() => setMilestone2Status("released")}
                            className="text-[9px] font-black uppercase bg-indigo-600 hover:bg-indigo-755 text-white px-2 py-0.5 rounded cursor-pointer select-none transition-colors duration-150"
                          >
                            Liberar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700 flex shrink-0" />
                        <span>Hito 3: Loseta y grifería final</span>
                      </div>
                      <span className="font-bold">$3,000 MXN · Pendiente</span>
                    </div>
                  </div>
                </div>

                {/* Evidence Image Dropdown */}
                <AnimatePresence>
                  {showEvidences && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl flex items-center gap-4 shadow-inner"
                    >
                      <div className="w-16 h-16 rounded-xl bg-slate-800 bg-[url('https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=200')] bg-cover bg-center shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Evidencia Hito 2 (Plomería)</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed block">
                          Tuberías de cobre soldadas e instaladas. Validado por metadatos GPS y el AI Evidence Agent.
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Live notifications */}
                <div className="flex items-center gap-2 text-[10px] text-slate-555 border-t border-slate-200/50 dark:border-slate-850 pt-3">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold text-slate-400">
                    {milestone2Status === "released"
                      ? "Notificación: Has liberado el Hito 2 con éxito. Fondos en tránsito a Adrián Reyes."
                      : "Notificación: Evidence Agent validó la foto de desmontaje cargada por el contratista."}
                  </span>
                </div>
              </motion.div>
            )}

            {activeRole === "worker" && (
              <motion.div
                key="worker-preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                {/* Header pro card info */}
                <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Portal de Contratistas</span>
                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">Adrián Reyes (Electricista)</h4>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] uppercase">
                    <TrendingUp size={11} />
                    <span>96 trust</span>
                  </div>
                </div>

                {/* Checklist task list */}
                <div className="space-y-3">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">Checklist de Hito Activo</span>
                  <div className="space-y-2 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850 p-4 rounded-2xl">
                    <div className="flex items-center gap-2.5 text-xs text-slate-400 line-through">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span>Retirar ductos y cableado antiguo</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-250 font-bold">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 flex shrink-0 mt-0.5" />
                      <span>Instalar mangueras y cablear circuito de luminarias LED</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-slate-400">
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700 flex shrink-0 mt-0.5" />
                      <span>Subir evidencia fotográfica de cableado nuevo</span>
                    </div>
                  </div>
                </div>

                {/* Finances card info */}
                <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl mt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Fondos en Escrow</div>
                      <span className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1 inline-block">$12,500 MXN</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-1 rounded-lg shrink-0">
                    Siguiente liberación: mañana
                  </span>
                </div>
              </motion.div>
            )}

            {activeRole === "admin" && (
              <motion.div
                key="admin-preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                {/* Admin Header */}
                <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Panel de Administración</span>
                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">Consola PMO Global</h4>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                    Sincronizado
                  </span>
                </div>

                {/* Grid metrics summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850 rounded-2xl">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Proyectos Activos</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white mt-1 inline-block">124</span>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850 rounded-2xl">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Escrow Bloqueado</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white mt-1 inline-block">$148,500 USD</span>
                  </div>
                </div>

                {/* Agents monitor panel */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">Monitor del Runtime de Agentes</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { name: "Marketplace", status: "98% match" },
                      { name: "ProTools", status: "calculando" },
                      { name: "Evidence", status: "vault ok" }
                    ].map((agent) => (
                      <div key={agent.name} className="p-2 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between text-[10px] font-medium text-slate-400">
                        <span>{agent.name}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Finance and commission log */}
                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/50 dark:border-slate-850 pt-3">
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Activity size={12} className="text-purple-500" />
                    <span>Margen operativo global: 12.4%</span>
                  </span>
                  <span className="text-[9px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded uppercase">
                    Comisión: 0.75%
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
