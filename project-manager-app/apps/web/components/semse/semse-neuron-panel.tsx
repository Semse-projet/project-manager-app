"use client";

import React from "react";
import { Neuron, Synapse, SEMSE_CORTEX } from "@/lib/data/semse-consciousness-topology";

interface SemseNeuronPanelProps {
  neuron: Neuron;
  synapses: Synapse[];
}

const statusColors: Record<string, string> = {
  embryonic: "bg-red-900 text-red-100",
  developing: "bg-orange-900 text-orange-100",
  partial: "bg-yellow-900 text-yellow-100",
  functional: "bg-yellow-900 text-yellow-100",
  mature: "bg-green-900 text-green-100",
  critical: "bg-blue-900 text-blue-100",
  broken: "bg-gray-900 text-gray-100",
};

const criticalityColors = {
  low: "text-blue-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

export const SemseNeuronPanel: React.FC<SemseNeuronPanelProps> = ({ neuron, synapses }) => {
  const cortex = SEMSE_CORTEX[neuron.cortex];
  const incoming = synapses.filter((s) => s.target === neuron.id);
  const outgoing = synapses.filter((s) => s.source === neuron.id);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-amber-400">{neuron.label}</h2>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: cortex.color }}
          />
          <span className="text-sm text-slate-300">{cortex.name}</span>
        </div>
      </div>

      {/* Description */}
      <div>
        <p className="text-sm text-slate-300">{neuron.description}</p>
      </div>

      {/* Status Badge */}
      <div className="flex flex-wrap gap-2">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[neuron.status]}`}>
          {neuron.status.toUpperCase()}
        </span>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${criticalityColors[neuron.criticality]}`}>
          {neuron.criticality.toUpperCase()}
        </span>
      </div>

      {/* Metrics */}
      <div className="space-y-2 border-t border-slate-700 pt-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Madurez</span>
            <span className="text-amber-400">{neuron.maturity}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${neuron.maturity}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Energía (Actividad)</span>
            <span className="text-cyan-400">{neuron.energy}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-cyan-500 h-2 rounded-full"
              style={{ width: `${neuron.energy}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Impacto Monetizable</span>
            <span className="capitalize">{neuron.monetizationImpact}</span>
          </div>
        </div>
      </div>

      {/* Inputs */}
      {neuron.inputs.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Inputs</h3>
          <ul className="space-y-1">
            {neuron.inputs.map((input) => (
              <li key={input} className="text-xs text-slate-400 pl-2 border-l border-slate-600">
                {input}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Outputs */}
      {neuron.outputs.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Outputs</h3>
          <ul className="space-y-1">
            {neuron.outputs.map((output) => (
              <li key={output} className="text-xs text-slate-400 pl-2 border-l border-slate-600">
                {output}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Incoming Synapses */}
      {incoming.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Impulsos Entrantes</h3>
          <ul className="space-y-2">
            {incoming.map((synapse, idx) => (
              <li key={idx} className="text-xs bg-slate-800 p-2 rounded border-l-2 border-green-500">
                <div className="font-semibold text-green-400">{synapse.label}</div>
                <div className="text-slate-400">{synapse.description}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Outgoing Synapses */}
      {outgoing.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Impulsos Salientes</h3>
          <ul className="space-y-2">
            {outgoing.map((synapse, idx) => (
              <li key={idx} className="text-xs bg-slate-800 p-2 rounded border-l-2 border-blue-500">
                <div className="font-semibold text-blue-400">{synapse.label}</div>
                <div className="text-slate-400">{synapse.description}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
