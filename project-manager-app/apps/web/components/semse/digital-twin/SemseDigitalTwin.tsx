"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Box, Database, Eye, EyeOff, Network, ShieldCheck } from "lucide-react";
import { mergeConsciousnessIntoSnapshot, type ConsciousnessDigitalTwinSource } from "@/lib/digital-twin/consciousness-adapter";
import { createStaticDigitalTwinSnapshot } from "@/lib/digital-twin/topology-adapter";
import {
  CANONICAL_DOMAINS,
  DOMAIN_BY_ID,
  type CanonicalDomainId,
  type DigitalTwinPerspective,
  type DigitalTwinPlayback,
  type DigitalTwinViewMode,
} from "@/lib/digital-twin/view-model";
import { SemseDigitalTwin2D } from "./SemseDigitalTwin2D";
import { SemseDigitalTwinList } from "./SemseDigitalTwinList";
import { SemseDigitalTwinControls } from "./SemseDigitalTwinControls";

const SemseDigitalTwin3D = dynamic(() => import("./SemseDigitalTwin3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#060B14]" role="status">
      <div className="text-center">
        <Box className="mx-auto animate-pulse text-cyan-300" size={26} aria-hidden="true" />
        <p className="mt-3 text-xs text-slate-500">Preparando arquitectura 3D…</p>
      </div>
    </div>
  ),
});

interface Props {
  source?: ConsciousnessDigitalTwinSource | null;
  variant?: "admin" | "legacy";
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

const LAYER_LABELS = {
  "experience-platform": "Experience Platform",
  "semse-core": "SEMSE Core",
  "ecosystem-orchestrator": "Ecosystem Orchestrator",
  "domain-capability": "Domain Capability",
  "semse-ai": "SEMSE AI",
  "mission-control": "Mission Control",
};

export function SemseDigitalTwin({ source = null, variant = "admin" }: Props) {
  const reducedMotion = useReducedMotion();
  const staticSnapshot = useMemo(() => createStaticDigitalTwinSnapshot(), []);
  const snapshot = useMemo(
    () => mergeConsciousnessIntoSnapshot(staticSnapshot, source),
    [staticSnapshot, source],
  );
  const [viewMode, setViewMode] = useState<DigitalTwinViewMode>("3d");
  const [perspective, setPerspective] = useState<DigitalTwinPerspective>("architecture");
  const [selectedId, setSelectedId] = useState<string | null>("smart_intake");
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<CanonicalDomainId | "all">("all");
  const [activeFlowId, setActiveFlowId] = useState<string>(snapshot.flows[0].id);
  const [playback, setPlayback] = useState<DigitalTwinPlayback | null>(null);
  const [completedFlowId, setCompletedFlowId] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const selectedNode = snapshot.nodes.find((node) => node.id === selectedId) ?? null;
  const visibleNodes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return snapshot.nodes.filter((node) => {
      if (domainFilter !== "all" && node.canonicalDomain !== domainFilter) return false;
      if (!query) return true;
      const haystack = [
        node.label, node.description, DOMAIN_BY_ID[node.canonicalDomain].label,
        ...node.inputs, ...node.outputs,
      ].join(" ").toLocaleLowerCase("es");
      return haystack.includes(query);
    });
  }, [snapshot.nodes, search, domainFilter]);
  const hasEmphasisFilter = Boolean(search) || domainFilter !== "all";
  const emphasisKey = hasEmphasisFilter
    ? visibleNodes.map((node) => node.id).join(",") || "__no_matching_nodes__"
    : "";

  useEffect(() => {
    if (!playback) return;
    const flow = snapshot.flows.find((item) => item.id === playback.flowId);
    if (!flow) return;
    const duration = reducedMotion ? 0 : (flow.nodeIds.length - 1) * 650;
    const timeout = window.setTimeout(() => {
      setCompletedFlowId(flow.id);
      setPlayback(null);
    }, duration + 120);
    return () => window.clearTimeout(timeout);
  }, [playback, snapshot.flows, reducedMotion]);

  const handlePerspective = (next: DigitalTwinPerspective) => {
    setPerspective(next);
    setPlayback(null);
  };
  const handleFlow = (flowId: string) => {
    setActiveFlowId(flowId);
    setPlayback(null);
    setCompletedFlowId(null);
  };
  const playFlow = () => {
    setCompletedFlowId(null);
    setPlayback({ flowId: activeFlowId, startedAt: performance.now(), nonce: Date.now() });
  };
  const handleUnavailable = useCallback(() => {
    setWebglUnavailable(true);
    setViewMode("2d");
    setPlayback(null);
  }, []);

  return (
    <section
      aria-labelledby="digital-twin-title"
      data-testid="semse-digital-twin"
      className="overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#060B14] text-[#E8EDF3] shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
    >
      <header className="flex flex-wrap items-center gap-x-5 gap-y-4 border-b border-white/[0.08] bg-[#0B1220]/90 px-5 py-5 sm:px-6">
        <Network size={25} className="shrink-0 text-cyan-300" aria-hidden="true" />
        <div className="min-w-[230px] flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-cyan-300/70">SEMSE / Ecosystem atlas</span>
            <span className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider text-slate-500"><span className="h-1 w-1 rounded-full bg-slate-500" />Sólo lectura</span>
          </div>
          <h2 id="digital-twin-title" className="text-xl font-semibold tracking-[-0.025em] text-slate-100 sm:text-2xl">
            {variant === "legacy" ? "SEMSE Ecosystem Digital Twin" : "Ecosystem Digital Twin"}
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-400">
            Arquitectura y relaciones definidas en código. La observación runtime nunca se infiere de la topología.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-black/10 px-3 py-2 text-slate-300">
            <Database size={12} className="text-slate-500" aria-hidden="true" /> Topología estática
          </span>
          <span className={`flex items-center gap-2 rounded-md border px-3 py-2 ${snapshot.globalHealth === null ? "border-white/[0.08] text-slate-400" : "border-teal-300/20 bg-teal-300/[0.06] text-teal-200"}`}>
            <Activity size={12} aria-hidden="true" />
            {snapshot.globalHealth === null ? "Sin observación global" : `Salud global observada · ${snapshot.globalHealth}/100`}
          </span>
        </div>
      </header>

      <SemseDigitalTwinControls
        viewMode={viewMode} perspective={perspective} search={search} domainFilter={domainFilter}
        flows={snapshot.flows} activeFlowId={activeFlowId} playing={Boolean(playback)}
        hasCompleted={completedFlowId === activeFlowId}
        onViewModeChange={setViewMode} onPerspectiveChange={handlePerspective}
        onSearchChange={setSearch} onDomainFilterChange={setDomainFilter}
        onFlowChange={handleFlow} onPlay={playFlow} onReset={() => setResetToken((value) => value + 1)}
      />

      {webglUnavailable && (
        <div role="status" className="flex flex-wrap items-center gap-2 border-b border-amber-300/10 bg-amber-300/[0.05] px-4 py-2.5 text-xs text-amber-200/80">
          <AlertTriangle size={13} aria-hidden="true" />
          WebGL no está disponible o se perdió el contexto. La vista 2D conserva todas las funciones de exploración.
          <button type="button" onClick={() => { setWebglUnavailable(false); setViewMode("3d"); }} className="ml-auto min-h-11 px-2 font-bold text-amber-200 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300">Reintentar 3D</button>
        </div>
      )}
      {snapshot.degradedSources.length > 0 && (
        <div role="status" className="flex items-start gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-[11px] text-slate-400">
          <EyeOff size={12} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          Fuentes degradadas: {snapshot.degradedSources.join(", ")}. Los valores ausentes permanecen sin observación.
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-h-[560px] overflow-hidden border-b border-white/[0.08] lg:min-h-[650px] lg:border-b-0 lg:border-r">
          {viewMode !== "list" && (
            <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-white/[0.07] bg-[#08101B]/80 px-3 py-2 backdrop-blur-md">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Vista {viewMode} · {perspective === "architecture" ? "Arquitectura" : perspective === "flows" ? "Flujos" : "Criticidad"}</div>
              <div className="mt-1 text-[10px] text-slate-300">{visibleNodes.length} / {snapshot.nodes.length} módulos visibles</div>
            </div>
          )}
          {viewMode === "3d" && (
            <SemseDigitalTwin3D
              snapshot={snapshot} selectedId={selectedId} perspective={perspective}
              activeFlowId={activeFlowId} emphasisKey={emphasisKey} playback={playback}
              reducedMotion={reducedMotion} resetToken={resetToken}
              onSelect={setSelectedId} onUnavailable={handleUnavailable}
            />
          )}
          {viewMode === "2d" && (
            <SemseDigitalTwin2D
              snapshot={snapshot} selectedId={selectedId} perspective={perspective}
              activeFlowId={activeFlowId} emphasisKey={emphasisKey} playback={playback}
              reducedMotion={reducedMotion} onSelect={setSelectedId}
            />
          )}
          {viewMode === "list" && <SemseDigitalTwinList nodes={visibleNodes} selectedId={selectedId} onSelect={setSelectedId} />}
          {viewMode !== "list" && (
            <div className="pointer-events-none absolute bottom-4 right-4 max-w-[270px] rounded-md border border-white/[0.08] bg-[#08101B]/85 px-3 py-2 text-[10px] leading-relaxed text-slate-400 backdrop-blur-md">
              {perspective === "architecture" && "Color = dominio canónico · arrastra para orbitar"}
              {perspective === "flows" && "Dorado = camino derivado del flujo · no son eventos live"}
              {perspective === "health" && "Color = criticidad arquitectónica · no es salud runtime"}
            </div>
          )}
        </div>

        <aside className="min-h-[360px] border-t border-white/[0.06] bg-[#09111D] p-5 sm:p-6 lg:border-t-0" aria-label="Detalle del módulo">
          {selectedNode ? (
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Módulo seleccionado</div>
              <div className="mt-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DOMAIN_BY_ID[selectedNode.canonicalDomain].color }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: DOMAIN_BY_ID[selectedNode.canonicalDomain].color }}>
                  {DOMAIN_BY_ID[selectedNode.canonicalDomain].label}
                </span>
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-100">{selectedNode.label}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-slate-400">{selectedNode.description}</p>
              <div className="mt-6 grid grid-cols-2 border-y border-white/[0.07] py-4">
                <div className="pr-3">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Criticidad</div>
                  <div className="mt-1.5 text-xs font-semibold capitalize text-slate-200">{selectedNode.criticality}</div>
                </div>
                <div className="border-l border-white/[0.07] pl-4">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Runtime por nodo</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400"><EyeOff size={11} /> Sin observación</div>
                </div>
              </div>
              <dl className="text-[11px]">
                <div className="border-b border-white/[0.055] py-3"><dt className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Capa de ejecución</dt><dd className="mt-1.5 text-slate-300">{LAYER_LABELS[selectedNode.executionLayer]}</dd></div>
                <div className="border-b border-white/[0.055] py-3"><dt className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Madurez de registro</dt><dd className="mt-1.5 text-slate-300">{selectedNode.maturity === null ? "No disponible" : `${selectedNode.maturity}/100 · registro estático backend`}</dd></div>
                <div className="border-b border-white/[0.055] py-3"><dt className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Salud runtime por nodo</dt><dd className="mt-1.5 font-mono text-slate-400">null · no medida por este contrato</dd></div>
                <div className="border-b border-white/[0.055] py-3"><dt className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Fuentes</dt><dd className="mt-1.5 break-words font-mono text-slate-400">{selectedNode.sources.join(" · ")}</dd></div>
              </dl>
              <div className="mt-5">
                <div className="font-mono text-[9px] font-medium uppercase tracking-wider text-slate-600">Entradas declaradas</div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">{selectedNode.inputs.map((input) => <span key={input} className="rounded bg-white/[0.045] px-2 py-1 font-mono text-[9px] text-slate-400">{input}</span>)}</div>
                <div className="mt-4 flex items-center gap-1.5 font-mono text-[9px] font-medium uppercase tracking-wider text-slate-600">Salidas declaradas <ArrowRight size={10} /></div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">{selectedNode.outputs.map((output) => <span key={output} className="rounded bg-cyan-300/[0.06] px-2 py-1 font-mono text-[9px] text-cyan-200/70">{output}</span>)}</div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center"><Eye className="text-slate-700" /><p className="mt-3 text-xs text-slate-500">Selecciona un módulo para inspeccionarlo.</p></div>
          )}
          {perspective === "health" && (
            <div className="mt-4 rounded-lg border border-amber-300/10 bg-amber-300/[0.03] p-3 text-[10px] leading-relaxed text-amber-100/50">
              <ShieldCheck size={12} className="mb-2 text-amber-200/70" />
              La salud observada es global ({snapshot.globalHealth ?? "null"}). Los colores de nodos expresan criticidad estática y no diagnosis individual.
            </div>
          )}
          {snapshot.unmappedMaturityModules.length > 0 && (
            <details className="mt-4 text-[10px] text-slate-500">
              <summary className="cursor-pointer">{snapshot.unmappedMaturityModules.length} módulos de registro sin correspondencia</summary>
              <p className="mt-2 leading-relaxed">{snapshot.unmappedMaturityModules.join(" · ")}</p>
            </details>
          )}
        </aside>
      </div>

      <footer className="border-t border-white/[0.08] bg-[#08101B] px-5 py-4">
        <div className="flex flex-wrap gap-x-4 gap-y-2.5">
          {CANONICAL_DOMAINS.map((domain) => (
            <span key={domain.id} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: domain.color }} />
              {domain.shortLabel} · <span className="font-mono text-slate-500">{snapshot.nodes.filter((node) => node.canonicalDomain === domain.id).length}</span>
            </span>
          ))}
        </div>
        <p className="mt-3 border-t border-white/[0.05] pt-3 font-mono text-[9px] leading-relaxed text-slate-500">
          {snapshot.nodes.length} módulos · {snapshot.edges.length} relaciones (incluye conexiones derivadas de flujos) · {snapshot.observedAt ? `Observación global: ${new Date(snapshot.observedAt).toLocaleString("es-MX")}` : "Sin timestamp de observación"}.
        </p>
      </footer>
    </section>
  );
}
