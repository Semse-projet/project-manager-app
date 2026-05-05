"use client";

import { useState } from "react";
import { ToolResultPanel } from "../ToolResultPanel";

type SolarInput = {
  projectName: string;
  roofAreaSqft: number;
  systemKw: number;
  panelCount: number;
  roofType: "shingle" | "tile" | "metal" | "flat";
  roofCondition: "good" | "fair" | "poor";
  sunExposure: "low" | "medium" | "high";
  batteryIncluded: boolean;
  permitRequired: boolean;
  electricalUpgradeNeeded: boolean;
  mode: "client" | "professional" | "admin";
};

const INITIAL_INPUT: SolarInput = {
  projectName: "Roof solar install",
  roofAreaSqft: 1200,
  systemKw: 8,
  panelCount: 20,
  roofType: "shingle",
  roofCondition: "good",
  sunExposure: "high",
  batteryIncluded: false,
  permitRequired: true,
  electricalUpgradeNeeded: false,
  mode: "professional",
};

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <input
        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <input
        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SolarToolClient() {
  const [input, setInput] = useState<SolarInput>(INITIAL_INPUT);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/semse/tools/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "solar",
          input,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "No se pudo calcular Solar.");
      }

      const data = await response.json();
      setResult(data);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
          SEMSE Pro Tools
        </p>
        <h1 className="mt-1 text-3xl font-bold">Solar / Renewable Calculator</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Roof suitability, panel count, electrical upgrade, permit and inspection-ready solar output.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Project name"
          value={input.projectName}
          onChange={(value) => setInput({ ...input, projectName: value })}
        />

        <NumberField
          label="Roof area (sqft)"
          value={input.roofAreaSqft}
          onChange={(value) => setInput({ ...input, roofAreaSqft: value })}
        />

        <NumberField
          label="System size (kW)"
          value={input.systemKw}
          step={0.1}
          onChange={(value) => setInput({ ...input, systemKw: value })}
        />

        <NumberField
          label="Panel count"
          value={input.panelCount}
          onChange={(value) => setInput({ ...input, panelCount: value })}
        />

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Roof type</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.roofType}
            onChange={(event) =>
              setInput({
                ...input,
                roofType: event.target.value as SolarInput["roofType"],
              })
            }
          >
            <option value="shingle">Shingle</option>
            <option value="tile">Tile</option>
            <option value="metal">Metal</option>
            <option value="flat">Flat</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Roof condition</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.roofCondition}
            onChange={(event) =>
              setInput({
                ...input,
                roofCondition: event.target.value as SolarInput["roofCondition"],
              })
            }
          >
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Sun exposure</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.sunExposure}
            onChange={(event) =>
              setInput({
                ...input,
                sunExposure: event.target.value as SolarInput["sunExposure"],
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <input
            type="checkbox"
            checked={input.batteryIncluded}
            onChange={(event) => setInput({ ...input, batteryIncluded: event.target.checked })}
          />
          <span>Battery included</span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <input
            type="checkbox"
            checked={input.permitRequired}
            onChange={(event) => setInput({ ...input, permitRequired: event.target.checked })}
          />
          <span>Permit required</span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <input
            type="checkbox"
            checked={input.electricalUpgradeNeeded}
            onChange={(event) => setInput({ ...input, electricalUpgradeNeeded: event.target.checked })}
          />
          <span>Electrical upgrade needed</span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Mode</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.mode}
            onChange={(event) =>
              setInput({
                ...input,
                mode: event.target.value as SolarInput["mode"],
              })
            }
          >
            <option value="client">Client</option>
            <option value="professional">Professional</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-sm text-cyan-100">
        <strong>Nota operativa:</strong> solar necesita techo sano, evidencia de montaje, cableado, inspección y PTO antes de cerrar.
      </div>

      <button
        type="button"
        onClick={calculate}
        disabled={loading}
        className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
      >
        {loading ? "Calculando..." : "Calcular solar"}
      </button>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <ToolResultPanel result={result} />
        </div>
      )}
    </section>
  );
}
