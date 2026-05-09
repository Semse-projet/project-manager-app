"use client";

import { useState } from "react";
import { ToolResultPanel } from "../ToolResultPanel";

type LaborInput = {
  projectName: string;
  dailyWorkType: "demo" | "build" | "finish" | "cleanup" | "delivery" | "service" | "multi";
  crewSize: number;
  shiftHours: number;
  taskCount: number;
  materialMoves: number;
  cleanupHours: number;
  travelMinutes: number;
  safetyChecks: number;
  weatherRisk: "low" | "medium" | "high";
  incidentCount: number;
  mode: "client" | "professional" | "admin";
};

const INITIAL_INPUT: LaborInput = {
  projectName: "Bathroom remodel",
  dailyWorkType: "build",
  crewSize: 3,
  shiftHours: 8,
  taskCount: 10,
  materialMoves: 4,
  cleanupHours: 1.5,
  travelMinutes: 25,
  safetyChecks: 3,
  weatherRisk: "medium",
  incidentCount: 0,
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

export function LaborToolClient() {
  const [input, setInput] = useState<LaborInput>(INITIAL_INPUT);
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
          tool: "labor",
          input,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "No se pudo calcular Labor.");
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
        <h1 className="mt-1 text-3xl font-bold">Labor / Daily Field Ops</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Crew sign-in, task load, material moves, cleanup, safety and closeout for daily field work.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Project name"
          value={input.projectName}
          onChange={(value) => setInput({ ...input, projectName: value })}
        />

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Daily work type</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.dailyWorkType}
            onChange={(event) =>
              setInput({
                ...input,
                dailyWorkType: event.target.value as LaborInput["dailyWorkType"],
              })
            }
          >
            <option value="demo">Demo</option>
            <option value="build">Build</option>
            <option value="finish">Finish</option>
            <option value="cleanup">Cleanup</option>
            <option value="delivery">Delivery</option>
            <option value="service">Service</option>
            <option value="multi">Multi</option>
          </select>
        </label>

        <NumberField
          label="Crew size"
          value={input.crewSize}
          onChange={(value) => setInput({ ...input, crewSize: value })}
        />

        <NumberField
          label="Shift hours"
          value={input.shiftHours}
          onChange={(value) => setInput({ ...input, shiftHours: value })}
        />

        <NumberField
          label="Task count"
          value={input.taskCount}
          onChange={(value) => setInput({ ...input, taskCount: value })}
        />

        <NumberField
          label="Material moves"
          value={input.materialMoves}
          onChange={(value) => setInput({ ...input, materialMoves: value })}
        />

        <NumberField
          label="Cleanup hours"
          value={input.cleanupHours}
          step={0.25}
          onChange={(value) => setInput({ ...input, cleanupHours: value })}
        />

        <NumberField
          label="Travel minutes"
          value={input.travelMinutes}
          onChange={(value) => setInput({ ...input, travelMinutes: value })}
        />

        <NumberField
          label="Safety checks"
          value={input.safetyChecks}
          onChange={(value) => setInput({ ...input, safetyChecks: value })}
        />

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Weather risk</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.weatherRisk}
            onChange={(event) =>
              setInput({
                ...input,
                weatherRisk: event.target.value as LaborInput["weatherRisk"],
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <NumberField
          label="Incident count"
          value={input.incidentCount}
          onChange={(value) => setInput({ ...input, incidentCount: value })}
        />

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Mode</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.mode}
            onChange={(event) =>
              setInput({
                ...input,
                mode: event.target.value as LaborInput["mode"],
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
        <strong>Nota operativa:</strong> este módulo cubre trabajo diario. SEMSE debe guardar sign-in, tareas, fotos, seguridad y limpieza antes de cerrar.
      </div>

      <button
        type="button"
        onClick={calculate}
        disabled={loading}
        className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
      >
        {loading ? "Calculando..." : "Calcular labor"}
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
