"use client";

import React from "react";
import { SEMSE_CORTEX, CortexType, MONETIZATION_FLOWS } from "@/lib/data/semse-consciousness-topology";

interface SemseControlPanelProps {
  activeCortex: CortexType | null;
  onCortexChange: (cortex: CortexType | null) => void;
  systemHealth: number;
  showMonetizationFlow: boolean;
  onMonetizationFlowChange: (show: boolean) => void;
}

export const SemseControlPanel: React.FC<SemseControlPanelProps> = ({
  activeCortex,
  onCortexChange,
  systemHealth,
  showMonetizationFlow,
  onMonetizationFlowChange,
}) => {
  const healthColor =
    systemHealth > 80 ? "text-green-400" : systemHealth > 60 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="p-4 space-y-6">
      {/* Sistema Health */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Salud del Sistema
        </h2>
        <div className={`text-3xl font-bold ${healthColor}`}>{Math.round(systemHealth)}%</div>
        <div className="w-full bg-slate-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              systemHealth > 80
                ? "bg-green-500"
                : systemHealth > 60
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${systemHealth}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Actualizado en tiempo real desde API
        </p>
      </div>

      {/* Cortex Selector */}
      <div className="space-y-3 border-t border-slate-700 pt-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Filtrar por Cortex
        </h3>

        <button
          onClick={() => onCortexChange(null)}
          className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
            activeCortex === null
              ? "bg-slate-700 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          Ver Todo
        </button>

        <div className="space-y-2">
          {Object.entries(SEMSE_CORTEX).map(([cortexId, cortex]) => (
            <button
              key={cortexId}
              onClick={() => onCortexChange(cortexId as CortexType)}
              className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                activeCortex === cortexId
                  ? "bg-slate-700 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cortex.color }}
              />
              <span className="flex-1 text-left">{cortex.name}</span>
              <span className="text-xs text-slate-500">{cortex.neurons.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Monetization Flows */}
      <div className="space-y-3 border-t border-slate-700 pt-4">
        <button
          onClick={() => onMonetizationFlowChange(!showMonetizationFlow)}
          className="w-full px-3 py-2 rounded text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-between"
        >
          <span className="uppercase tracking-wider">Flujos Monetizables</span>
          <span className={showMonetizationFlow ? "text-green-400" : "text-slate-500"}>
            {showMonetizationFlow ? "✓" : "○"}
          </span>
        </button>

        {showMonetizationFlow && (
          <div className="space-y-2 bg-slate-800 p-3 rounded text-xs">
            {MONETIZATION_FLOWS.map((flow) => (
              <div key={flow.id} className="space-y-1">
                <div className="font-semibold text-amber-400">{flow.name}</div>
                <div className="text-slate-400">{flow.description}</div>
                <div className="flex gap-1 flex-wrap">
                  {flow.neurons.slice(0, 3).map((neuronId) => (
                    <span
                      key={neuronId}
                      className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
                    >
                      {neuronId}
                    </span>
                  ))}
                  {flow.neurons.length > 3 && (
                    <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                      +{flow.neurons.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Information */}
      <div className="space-y-2 border-t border-slate-700 pt-4 text-xs text-slate-500">
        <div className="space-y-1">
          <h4 className="text-slate-400 font-semibold">Cómo usar</h4>
          <ul className="space-y-1 text-xs">
            <li>• Haz clic en puntos para ver detalles</li>
            <li>• Filtra por cortex para enfocar</li>
            <li>• Observa energía y madurez en tiempo real</li>
            <li>• Explora sinapsis (impulsos)</li>
          </ul>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 border-t border-slate-700 pt-4 bg-slate-800 p-3 rounded text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Cortex activos</span>
          <span className="text-white">7</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Neuronas</span>
          <span className="text-white">36</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Sinapsis</span>
          <span className="text-white">42</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Flujos monetizables</span>
          <span className="text-white">3</span>
        </div>
      </div>
    </div>
  );
};
