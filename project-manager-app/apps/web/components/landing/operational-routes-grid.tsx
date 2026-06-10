"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PlusCircle,
  Calculator,
  Search,
  FolderKanban,
  Camera,
  CreditCard,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { operationalRoutes, type OperationalRoute } from "./landing-routes";

const ICON_MAP: Record<number, React.ComponentType<{ className?: string; size?: number }>> = {
  0: PlusCircle,
  1: Calculator,
  2: Search,
  3: FolderKanban,
  4: Camera,
  5: CreditCard,
  6: Sparkles,
};

const GLOW_COLORS: Record<number, string> = {
  0: "bg-blue-500/10 dark:bg-blue-500/5",
  1: "bg-amber-500/10 dark:bg-amber-500/5",
  2: "bg-emerald-500/10 dark:bg-emerald-500/5",
  3: "bg-indigo-500/10 dark:bg-indigo-500/5",
  4: "bg-cyan-500/10 dark:bg-cyan-500/5",
  5: "bg-rose-500/10 dark:bg-rose-500/5",
  6: "bg-purple-500/10 dark:bg-purple-500/5",
};

const ICON_COLORS: Record<number, string> = {
  0: "text-blue-500 border-blue-500/20",
  1: "text-amber-500 border-amber-500/20",
  2: "text-emerald-500 border-emerald-500/20",
  3: "text-indigo-500 border-indigo-500/20",
  4: "text-cyan-500 border-cyan-500/20",
  5: "text-rose-500 border-rose-500/20",
  6: "text-purple-500 border-purple-500/20",
};

export function OperationalRoutesGrid() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch justify-center">
        {operationalRoutes.map((route, idx) => {
          const Icon = ICON_MAP[idx] || Sparkles;
          const glow = GLOW_COLORS[idx] || "bg-blue-500/5";
          const iconColor = ICON_COLORS[idx] || "text-blue-500 border-blue-500/20";
          
          return (
            <Link
              key={route.title}
              href={route.href}
              className="block no-underline select-none group h-full"
            >
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                whileHover={{ y: -4 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-slate-350 dark:hover:border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 h-full cursor-pointer"
              >
                {/* Glow backdrop */}
                <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full ${glow} blur-[28px] pointer-events-none`} />

                <div className="space-y-4">
                  {/* Icon wrapper */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border bg-slate-50/50 dark:bg-slate-950/20 ${iconColor} mb-2`}>
                    <Icon size={20} className="shrink-0" />
                  </div>

                  {/* Title & Desc */}
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {route.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {route.description}
                    </p>
                  </div>
                </div>

                {/* Footer link trigger */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-1 text-xs font-bold text-slate-450 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <span>Iniciar ruta</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
