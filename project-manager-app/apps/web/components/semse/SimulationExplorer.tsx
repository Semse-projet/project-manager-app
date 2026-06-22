"use client";

import { useState } from "react";
import { SimulationHistoryPanel, SimulatedPatch } from "./SimulationHistoryPanel";
import { PatchDiffViewer } from "./PatchDiffViewer";

export function SimulationExplorer() {
  const [selectedPatch, setSelectedPatch] = useState<SimulatedPatch | null>(null);

  return (
    <div className="space-y-6">
      {selectedPatch ? (
        <div>
          <button
            onClick={() => setSelectedPatch(null)}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center gap-1"
          >
            ← Back to Simulations
          </button>
          <PatchDiffViewer patch={selectedPatch} />
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Simulation Engine</h2>
          <SimulationHistoryPanel onSelectPatch={setSelectedPatch} />
        </div>
      )}
    </div>
  );
}
