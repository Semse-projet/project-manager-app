"use client";

import React, { useState, useEffect } from "react";
import {
  SEMSE_NEURONS,
  SEMSE_CORTEX,
  SEMSE_SYNAPSES,
  MONETIZATION_FLOWS,
  CortexType,
  Neuron,
} from "@/lib/data/semse-consciousness-topology";
import { SemseNeuralGraph } from "./semse-neural-graph";
import { SemseNeuronPanel } from "./semse-neuron-panel";
import { SemseControlPanel } from "./semse-control-panel";

export const SemseConsciousnessMap: React.FC = () => {
  const [selectedNeuron, setSelectedNeuron] = useState<string | null>("smart_intake");
  const [activeCortex, setActiveCortex] = useState<CortexType | null>(null);
  const [showMonetizationFlow, setShowMonetizationFlow] = useState(false);
  const [systemHealth, setSystemHealth] = useState(82);

  const selectedNeuronData = selectedNeuron ? SEMSE_NEURONS[selectedNeuron] : null;

  // Simular actualización de energía en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemHealth((prev) => {
        const change = (Math.random() - 0.5) * 2;
        return Math.max(50, Math.min(100, prev + change));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Panel de control izquierdo */}
      <div className="w-80 border-r border-slate-700 overflow-y-auto bg-slate-900">
        <SemseControlPanel
          activeCortex={activeCortex}
          onCortexChange={setActiveCortex}
          systemHealth={systemHealth}
          showMonetizationFlow={showMonetizationFlow}
          onMonetizationFlowChange={setShowMonetizationFlow}
        />
      </div>

      {/* Grafo central */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-slate-900">
          <h1 className="text-2xl font-bold text-amber-400">SEMSE Consciousness Map</h1>
          <p className="text-sm text-slate-400 mt-1">
            Sistema nervioso digital — 7 cortex, {Object.keys(SEMSE_NEURONS).length} neuronas,{" "}
            {SEMSE_SYNAPSES.length} sinapsis
          </p>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <SemseNeuralGraph
            selectedNeuron={selectedNeuron}
            onSelectNeuron={setSelectedNeuron}
            activeCortex={activeCortex}
          />
        </div>
      </div>

      {/* Panel lateral derecho - Detalles */}
      <div className="w-80 border-l border-slate-700 overflow-y-auto bg-slate-900">
        {selectedNeuronData && (
          <SemseNeuronPanel neuron={selectedNeuronData} synapses={SEMSE_SYNAPSES} />
        )}
      </div>
    </div>
  );
};
