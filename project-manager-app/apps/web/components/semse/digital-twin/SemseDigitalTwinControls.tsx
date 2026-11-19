"use client";

import { Box, List, Map, Play, RotateCcw, Search, X } from "lucide-react";
import {
  CANONICAL_DOMAINS,
  type CanonicalDomainId,
  type DigitalTwinFlow,
  type DigitalTwinPerspective,
  type DigitalTwinViewMode,
} from "@/lib/digital-twin/view-model";

interface Props {
  viewMode: DigitalTwinViewMode;
  perspective: DigitalTwinPerspective;
  search: string;
  domainFilter: CanonicalDomainId | "all";
  flows: DigitalTwinFlow[];
  activeFlowId: string;
  playing: boolean;
  hasCompleted: boolean;
  onViewModeChange: (mode: DigitalTwinViewMode) => void;
  onPerspectiveChange: (mode: DigitalTwinPerspective) => void;
  onSearchChange: (value: string) => void;
  onDomainFilterChange: (value: CanonicalDomainId | "all") => void;
  onFlowChange: (flowId: string) => void;
  onPlay: () => void;
  onReset: () => void;
}

const VIEWS = [
  { id: "3d" as const, label: "3D", icon: Box },
  { id: "2d" as const, label: "2D", icon: Map },
  { id: "list" as const, label: "Lista", icon: List },
];
const PERSPECTIVES = [
  { id: "architecture" as const, label: "Arquitectura" },
  { id: "flows" as const, label: "Flujos de valor" },
  { id: "health" as const, label: "Salud y riesgo" },
];

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export function SemseDigitalTwinControls(props: Props) {
  return (
    <div className="grid gap-3 border-b border-white/[0.08] bg-[#08101B]/95 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1 self-stretch border-b border-white/10" aria-label="Tipo de vista">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} type="button" aria-pressed={props.viewMode === id}
              onClick={() => props.onViewModeChange(id)}
              className={`-mb-px flex min-h-[44px] cursor-pointer items-center gap-1.5 border-b-2 px-3 text-[11px] font-semibold transition-[color,background-color,border-color] duration-150 sm:min-h-10 ${focusRing} ${props.viewMode === id ? "border-cyan-300 bg-cyan-300/[0.05] text-cyan-200" : "border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-slate-200"}`}
            >
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap rounded-xl bg-black/20 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]" aria-label="Perspectiva">
          {PERSPECTIVES.map(({ id, label }) => (
            <button
              key={id} type="button" aria-pressed={props.perspective === id}
              onClick={() => props.onPerspectiveChange(id)}
              className={`min-h-[44px] cursor-pointer rounded-lg px-3 text-[11px] font-medium transition-[color,background-color,box-shadow] duration-150 sm:min-h-9 ${focusRing} ${props.perspective === id ? "bg-white/[0.09] text-slate-100 shadow-sm" : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {props.viewMode === "3d" && (
          <button type="button" onClick={props.onReset} className={`ml-auto flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-transparent px-3 text-[11px] text-slate-400 transition-[color,background-color,border-color] duration-150 hover:border-white/10 hover:bg-white/[0.04] hover:text-white sm:min-h-9 ${focusRing}`}>
            <RotateCcw size={13} aria-hidden="true" /> Restablecer cámara
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-[210px] flex-1">
          <span className="sr-only">Buscar módulo</span>
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <input
            value={props.search} onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder="Buscar módulo, descripción o señal…"
            className="h-[44px] w-full rounded-xl border border-white/[0.08] bg-[#050B13] pl-10 pr-11 text-xs text-slate-200 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-600 focus:border-cyan-300/40 focus:shadow-[0_0_0_3px_rgba(46,196,182,0.07)]"
          />
          {props.search && (
            <button type="button" onClick={() => props.onSearchChange("")} aria-label="Limpiar búsqueda" className={`absolute right-0 top-1/2 flex h-[44px] w-[44px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-white/5 hover:text-white ${focusRing}`}>
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </label>
        <label>
          <span className="sr-only">Filtrar por dominio</span>
          <select
            value={props.domainFilter}
            onChange={(event) => props.onDomainFilterChange(event.target.value as CanonicalDomainId | "all")}
            className="h-[44px] cursor-pointer rounded-xl border border-white/[0.08] bg-[#050B13] px-3.5 text-xs text-slate-300 outline-none transition-[border-color,box-shadow] duration-150 focus:border-cyan-300/40 focus:shadow-[0_0_0_3px_rgba(46,196,182,0.07)]"
          >
            <option value="all">Los nueve dominios</option>
            {CANONICAL_DOMAINS.map((domain) => <option key={domain.id} value={domain.id}>{domain.label}</option>)}
          </select>
        </label>
        {props.perspective === "flows" && (
          <div className="flex min-w-full flex-wrap items-center gap-2.5 border-t border-amber-300/10 pt-3 sm:min-w-0 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <label>
              <span className="sr-only">Flujo de valor</span>
              <select
                value={props.activeFlowId} onChange={(event) => props.onFlowChange(event.target.value)}
                className="h-[44px] max-w-[240px] cursor-pointer rounded-xl border border-amber-300/20 bg-[#050B13] px-3 text-xs text-amber-100 outline-none focus:border-amber-300/50"
              >
                {props.flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.label}</option>)}
              </select>
            </label>
            <button
              type="button" data-testid="digital-twin-play-flow" onClick={props.onPlay} disabled={props.playing}
              className={`flex h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 text-xs font-semibold text-amber-200 transition-[background-color,border-color] duration-150 hover:border-amber-300/45 hover:bg-amber-300/15 disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
            >
              <Play size={12} fill="currentColor" aria-hidden="true" />
              {props.playing ? "Reproduciendo…" : props.hasCompleted ? "Repetir flujo" : "Reproducir flujo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
