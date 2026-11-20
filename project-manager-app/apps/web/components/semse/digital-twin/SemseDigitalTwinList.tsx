"use client";

import { CANONICAL_DOMAINS, DOMAIN_BY_ID, type DigitalTwinNode } from "@/lib/digital-twin/view-model";

interface Props {
  nodes: DigitalTwinNode[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}

export function SemseDigitalTwinList({ nodes, selectedId, onSelect }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center" data-testid="digital-twin-list">
        <div>
          <p className="text-sm font-semibold text-slate-200">No hay módulos que coincidan</p>
          <p className="mt-2 text-xs text-slate-500">Prueba otra búsqueda o selecciona todos los dominios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[480px] overflow-y-auto p-4" data-testid="digital-twin-list">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CANONICAL_DOMAINS.map((domain) => {
          const domainNodes = nodes.filter((node) => node.canonicalDomain === domain.id);
          if (domainNodes.length === 0) return null;
          return (
            <section key={domain.id} aria-labelledby={`domain-list-${domain.id}`}>
              <div className="mb-2 flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: domain.color }} />
                <h3 id={`domain-list-${domain.id}`} className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: domain.color }}>
                  {domain.label}
                </h3>
                <span className="ml-auto text-[10px] text-slate-600">{domainNodes.length}</span>
              </div>
              <div className="grid gap-1.5">
                {domainNodes.map((node) => {
                  const selected = node.id === selectedId;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      data-testid={`digital-twin-node-${node.id}`}
                      aria-pressed={selected}
                      onClick={() => onSelect(node.id)}
                      className={`min-h-[44px] rounded-lg border px-3 py-2 text-left transition-[background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${selected ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/5 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]"}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{node.label}</span>
                        {node.criticality === "critical" && <span className="rounded bg-red-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-red-300">Crítico</span>}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                        <span>{DOMAIN_BY_ID[node.canonicalDomain].shortLabel}</span>
                        <span>{node.maturity === null ? "Sin observación runtime" : `Registro ${node.maturity}/100`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
