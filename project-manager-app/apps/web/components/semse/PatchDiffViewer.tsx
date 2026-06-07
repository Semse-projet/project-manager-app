"use client";

import { SimulatedPatch } from "./SimulationHistoryPanel";

interface PatchDiffViewerProps {
  patch: SimulatedPatch;
  onClose?: () => void;
}

export function PatchDiffViewer({ patch, onClose }: PatchDiffViewerProps) {
  const handleCopyDiff = () => {
    navigator.clipboard.writeText(patch.previewDiff);
  };

  const handleCopyPrompt = () => {
    const prompt = `
Actúa como desarrollador senior de SEMSEproject.

Implementa el siguiente patch:

**Tipo:** ${patch.recommendation.type}
**Módulo:** ${patch.recommendation.area}
**Prioridad:** ${patch.recommendation.priority}

**Alcance:**
- Archivos a crear: ${patch.patch.filesToCreate.join(", ") || "ninguno"}
- Archivos a modificar: ${patch.patch.filesToModify.join(", ") || "ninguno"}
- Líneas estimadas: ${patch.patch.estimatedLines}

**Prueba:** ${patch.patch.testCommand}

**Seguridad:**
- Estado: ${patch.impactAnalysis.status.toUpperCase()}
- Riesgo de ruptura: ${patch.impactAnalysis.breakingRisk}
- Reversible: ${patch.impactAnalysis.rollbackable ? "Sí" : "No"}

**Notas de impacto:**
${patch.impactAnalysis.notes.map((n) => `- ${n}`).join("\n")}

**Restricciones obligatorias:**
- No tocar Payment Governance Core
- No auto-ejecutar acciones críticas
- Mantener Nivel 1 autonomía (solo lectura)
- Todo cambio debe tener tests

**Validaciones requeridas:**
- pnpm typecheck
- pnpm test:unit
- pnpm build:api pnpm build:web
- git diff --check

Implementa únicamente este patch.
    `;
    navigator.clipboard.writeText(prompt);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Patch Diff Viewer</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg font-bold"
          >
            ✕
          </button>
        )}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="bg-gray-100 border-b p-4 space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Type:</span>
              <div className="font-semibold text-gray-900">{patch.recommendation.type}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Module:</span>
              <div className="font-semibold text-gray-900">{patch.recommendation.area}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Safety:</span>
              <div
                className={`font-semibold ${
                  patch.impactAnalysis.status === "safe"
                    ? "text-green-700"
                    : patch.impactAnalysis.status === "review"
                    ? "text-yellow-700"
                    : "text-red-700"
                }`}
              >
                {patch.impactAnalysis.status.toUpperCase()}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Breaking Risk:</span>
              <div className="font-semibold text-gray-900">{patch.impactAnalysis.breakingRisk}</div>
            </div>
            <div>
              <span className="text-gray-600">Rollbackable:</span>
              <div className={`font-semibold ${patch.impactAnalysis.rollbackable ? "text-green-700" : "text-red-700"}`}>
                {patch.impactAnalysis.rollbackable ? "Yes" : "No"}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Files Affected</h4>
            <div className="space-y-1 text-sm">
              {patch.patch.filesToCreate.length > 0 && (
                <div className="text-green-700">
                  <strong>Create:</strong> {patch.patch.filesToCreate.join(", ")}
                </div>
              )}
              {patch.patch.filesToModify.length > 0 && (
                <div className="text-blue-700">
                  <strong>Modify:</strong> {patch.patch.filesToModify.join(", ")}
                </div>
              )}
              {patch.patch.filesToCreate.length === 0 && patch.patch.filesToModify.length === 0 && (
                <div className="text-gray-500">No file changes (operational action)</div>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Impact Notes</h4>
            <div className="space-y-1 text-sm text-gray-700">
              {patch.impactAnalysis.notes.map((note, idx) => (
                <div key={idx} className="flex gap-2">
                  <span>•</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Preview Diff</h4>
            <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-48 overflow-y-auto border">
              {patch.previewDiff}
            </pre>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={handleCopyDiff}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            >
              Copy Diff
            </button>
            <button
              onClick={handleCopyPrompt}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
            >
              Copy Claude Prompt
            </button>
            {!patch.patch.safeToApply && (
              <div className="flex items-center text-sm text-yellow-600 ml-auto">
                <span>⚠️ Requires manual review before application</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
