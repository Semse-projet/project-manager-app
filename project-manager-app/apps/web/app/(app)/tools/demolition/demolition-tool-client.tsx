"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type DemolitionInput = {
  areaSqft: number;
  demolitionType: "drywall" | "flooring" | "concrete" | "cabinets" | "fullInterior";
  difficulty: "basic" | "standard" | "complex" | "critical";
  disposalCostPerYard: number;
  laborRatePerHour: number;
  crewSize: number;
  hazardousMaterialSuspected: boolean;
  utilitiesPresent: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: DemolitionInput = {
  areaSqft: 500,
  demolitionType: "drywall",
  difficulty: "standard",
  disposalCostPerYard: 85,
  laborRatePerHour: 55,
  crewSize: 2,
  hazardousMaterialSuspected: false,
  utilitiesPresent: true,
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
    <Input
      label={label}
      type="number"
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export function DemolitionToolClient() {
  const [input, setInput] = useState<DemolitionInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "demolition",
        mode: input.mode,
        input,
      });
      setResult(response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unknown tools error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            Back to tools hub
          </Link>
          <Badge variant="brand">SEMSE Pro Tools</Badge>
        </div>

        <section className="grid gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Demolition calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate debris volume, disposal, labor, risk, milestones and evidence for selective or full interior demolition.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                <Calculator size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Input</h2>
                <p className="text-sm text-muted">
                  Demolition workflow with stronger evidence, disposal receipts and utility checks.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Area (sqft)"
                value={input.areaSqft}
                onChange={(value) => setInput((current) => ({ ...current, areaSqft: value }))}
              />

              <Select
                label="Demolition type"
                value={input.demolitionType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    demolitionType: event.target.value as DemolitionInput["demolitionType"],
                  }))
                }
              >
                <option value="drywall">Drywall</option>
                <option value="flooring">Flooring</option>
                <option value="concrete">Concrete</option>
                <option value="cabinets">Cabinets</option>
                <option value="fullInterior">Full interior</option>
              </Select>

              <Select
                label="Difficulty"
                value={input.difficulty}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    difficulty: event.target.value as DemolitionInput["difficulty"],
                  }))
                }
              >
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="complex">Complex</option>
                <option value="critical">Critical</option>
              </Select>

              <NumberField
                label="Disposal cost per yd³"
                value={input.disposalCostPerYard}
                onChange={(value) => setInput((current) => ({ ...current, disposalCostPerYard: value }))}
              />

              <NumberField
                label="Labor rate per hour"
                value={input.laborRatePerHour}
                onChange={(value) => setInput((current) => ({ ...current, laborRatePerHour: value }))}
              />

              <NumberField
                label="Crew size"
                value={input.crewSize}
                onChange={(value) => setInput((current) => ({ ...current, crewSize: value }))}
              />

              <Select
                label="Mode"
                value={input.mode}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    mode: event.target.value as ToolMode,
                  }))
                }
              >
                <option value="client">Client</option>
                <option value="professional">Professional</option>
                <option value="admin">Admin</option>
              </Select>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Hazardous material suspected</span>
                <input
                  type="checkbox"
                  checked={input.hazardousMaterialSuspected}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      hazardousMaterialSuspected: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Utilities present</span>
                <input
                  type="checkbox"
                  checked={input.utilitiesPresent}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      utilitiesPresent: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
              <strong>Note:</strong> demolition needs shutoff checks, dust containment, disposal proof and stronger closeout evidence.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              Calculate demolition
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Result preview</h2>
                    <p className="text-sm text-muted">
                      Run the calculator to see debris volume, disposal, labor, risk, milestones and evidence.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
