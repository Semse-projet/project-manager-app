"use client";

import { useState } from "react";
import { ToolResultPanel } from "../ToolResultPanel";

type ProjectManagerInput = {
  projectName: string;
  projectType: "remodel" | "newConstruction" | "repair" | "service" | "multitrade";
  budget: number;
  projectedDurationDays: number;
  crewSize: number;
  activeTrades: number;
  openTasks: number;
  inspectionsDue: number;
  changeOrders: number;
  clientMeetingsPerWeek: number;
  weatherRisk: "low" | "medium" | "high";
  permitRequired: boolean;
  safetyIssues: number;
  mode: "client" | "professional" | "admin";
};

const INITIAL_INPUT: ProjectManagerInput = {
  projectName: "Bathroom remodel",
  projectType: "remodel",
  budget: 45000,
  projectedDurationDays: 21,
  crewSize: 4,
  activeTrades: 4,
  openTasks: 12,
  inspectionsDue: 2,
  changeOrders: 1,
  clientMeetingsPerWeek: 2,
  weatherRisk: "medium",
  permitRequired: true,
  safetyIssues: 1,
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

export function ProjectManagerToolClient() {
  const [input, setInput] = useState<ProjectManagerInput>(INITIAL_INPUT);
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
          tool: "project-manager",
          input,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "No se pudo calcular Construction Manager.");
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
        <h1 className="mt-1 text-3xl font-bold">Construction Manager / Field Ops</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Plan de obra, crew, logs diarios, change orders, inspections y closeout para proyectos activos.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Project name"
          value={input.projectName}
          onChange={(value) => setInput({ ...input, projectName: value })}
        />

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Project type</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.projectType}
            onChange={(event) =>
              setInput({
                ...input,
                projectType: event.target.value as ProjectManagerInput["projectType"],
              })
            }
          >
            <option value="remodel">Remodel</option>
            <option value="newConstruction">New construction</option>
            <option value="repair">Repair</option>
            <option value="service">Service</option>
            <option value="multitrade">Multi-trade</option>
          </select>
        </label>

        <NumberField
          label="Budget"
          value={input.budget}
          onChange={(value) => setInput({ ...input, budget: value })}
        />

        <NumberField
          label="Projected duration (days)"
          value={input.projectedDurationDays}
          onChange={(value) => setInput({ ...input, projectedDurationDays: value })}
        />

        <NumberField
          label="Crew size"
          value={input.crewSize}
          onChange={(value) => setInput({ ...input, crewSize: value })}
        />

        <NumberField
          label="Active trades"
          value={input.activeTrades}
          onChange={(value) => setInput({ ...input, activeTrades: value })}
        />

        <NumberField
          label="Open tasks"
          value={input.openTasks}
          onChange={(value) => setInput({ ...input, openTasks: value })}
        />

        <NumberField
          label="Inspections due"
          value={input.inspectionsDue}
          onChange={(value) => setInput({ ...input, inspectionsDue: value })}
        />

        <NumberField
          label="Change orders"
          value={input.changeOrders}
          onChange={(value) => setInput({ ...input, changeOrders: value })}
        />

        <NumberField
          label="Client meetings / week"
          value={input.clientMeetingsPerWeek}
          onChange={(value) => setInput({ ...input, clientMeetingsPerWeek: value })}
        />

        <NumberField
          label="Safety issues"
          value={input.safetyIssues}
          onChange={(value) => setInput({ ...input, safetyIssues: value })}
        />

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Weather risk</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.weatherRisk}
            onChange={(event) =>
              setInput({
                ...input,
                weatherRisk: event.target.value as ProjectManagerInput["weatherRisk"],
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
            checked={input.permitRequired}
            onChange={(event) => setInput({ ...input, permitRequired: event.target.checked })}
          />
          <span>Permit required</span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-300">Mode</span>
          <select
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={input.mode}
            onChange={(event) =>
              setInput({
                ...input,
                mode: event.target.value as ProjectManagerInput["mode"],
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
        <strong>Nota operativa:</strong> este módulo controla obra activa. SEMSE debe guardar diario, cambios, fotos, inspecciones y aprobación antes de liberar cierre.
      </div>

      <button
        type="button"
        onClick={calculate}
        disabled={loading}
        className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
      >
        {loading ? "Calculando..." : "Calcular field ops"}
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
