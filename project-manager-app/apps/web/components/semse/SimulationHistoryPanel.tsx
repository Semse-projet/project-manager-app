"use client";

import { useEffect, useState } from "react";

export interface SimulatedPatch {
  id: string;
  recommendation: {
    id: string;
    type: string;
    area: string;
    priority: string;
  };
  patch: {
    filesToCreate: string[];
    filesToModify: string[];
    estimatedLines: number;
    testCommand: string;
    safeToApply: boolean;
  };
  impactAnalysis: {
    status: "safe" | "review" | "risky";
    affectedModules: string[];
    breakingRisk: "none" | "low" | "medium" | "high";
    rollbackable: boolean;
    notes: string[];
  };
  previewDiff: string;
  autonomyNote: string;
}

export interface SimulationReport {
  generatedAt: string;
  tenantId: string;
  patchCount: number;
  safePatchCount: number;
  patches: SimulatedPatch[];
  autonomyLevel: 3;
  autonomyPolicy: string;
  guardrails: string[];
}

interface SimulationHistoryPanelProps {
  onSelectPatch?: (patch: SimulatedPatch) => void;
}

export function SimulationHistoryPanel({ onSelectPatch }: SimulationHistoryPanelProps) {
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSimulations = async () => {
      try {
        const res = await fetch("/api/semse/consciousness/simulations");
        if (!res.ok) throw new Error("Failed to fetch simulations");
        const json = await res.json();
        setReport(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchSimulations();
  }, []);

  if (loading) return <div className="p-4 text-gray-500">Loading simulations...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!report) return <div className="p-4 text-gray-500">No simulations available</div>;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded">
        <h3 className="font-semibold text-blue-900">Simulation Engine Report</h3>
        <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
          <div>
            <div className="text-blue-600 font-semibold">{report.patchCount}</div>
            <div className="text-blue-700">Total Patches</div>
          </div>
          <div>
            <div className="text-green-600 font-semibold">{report.safePatchCount}</div>
            <div className="text-green-700">Safe to Review</div>
          </div>
          <div>
            <div className="text-yellow-600 font-semibold">{report.patchCount - report.safePatchCount}</div>
            <div className="text-yellow-700">Require Review</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {report.patches.map((patch) => (
          <div
            key={patch.id}
            className="border rounded p-4 cursor-pointer hover:bg-gray-50 transition"
            onClick={() => onSelectPatch?.(patch)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{patch.recommendation.type}</div>
                <div className="text-sm text-gray-600">{patch.recommendation.area}</div>
                <div className="text-xs text-gray-500 mt-1">{patch.autonomyNote}</div>
              </div>
              <div className="flex gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    patch.impactAnalysis.status === "safe"
                      ? "bg-green-100 text-green-700"
                      : patch.impactAnalysis.status === "review"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {patch.impactAnalysis.status.toUpperCase()}
                </span>
                {patch.patch.safeToApply && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    SAFE_APPLY
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 flex gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">{patch.patch.filesToCreate.length}</span> files to create
              </div>
              <div>
                <span className="font-medium">{patch.patch.filesToModify.length}</span> files to modify
              </div>
              <div>
                <span className="font-medium">~{patch.patch.estimatedLines}</span> lines
              </div>
            </div>

            {patch.impactAnalysis.notes.length > 0 && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 space-y-1">
                {patch.impactAnalysis.notes.map((note, idx) => (
                  <div key={idx}>• {note}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
