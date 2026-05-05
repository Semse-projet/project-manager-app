"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type LandscapingInput = {
  landscapeAreaSqft: number;
  sodAreaSqft: number;
  mulchYards: number;
  plantCount: number;
  irrigationLinesFt: number;
  drainageType: "none" | "swale" | "frenchDrain" | "catchBasin";
  soilType: "loam" | "clay" | "sand";
  demoExisting: boolean;
  hardscapeSqft: number;
  mode: ToolMode;
};

const INITIAL_INPUT: LandscapingInput = {
  landscapeAreaSqft: 1200,
  sodAreaSqft: 800,
  mulchYards: 2,
  plantCount: 12,
  irrigationLinesFt: 120,
  drainageType: "swale",
  soilType: "loam",
  demoExisting: false,
  hardscapeSqft: 0,
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

export function LandscapingToolClient() {
  const [input, setInput] = useState<LandscapingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "landscaping",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Landscaping / Drainage calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate sod, mulch, plants, irrigation, drainage, labor, risk, evidence and milestones for landscaping and drainage work.
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
                  Landscaping flow with grading, irrigation and drainage checks.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Landscape area (sqft)"
                value={input.landscapeAreaSqft}
                onChange={(value) => setInput((current) => ({ ...current, landscapeAreaSqft: value }))}
              />

              <NumberField
                label="Sod area (sqft)"
                value={input.sodAreaSqft}
                onChange={(value) => setInput((current) => ({ ...current, sodAreaSqft: value }))}
              />

              <NumberField
                label="Mulch (yd³)"
                value={input.mulchYards}
                step={0.1}
                onChange={(value) => setInput((current) => ({ ...current, mulchYards: value }))}
              />

              <NumberField
                label="Plant count"
                value={input.plantCount}
                onChange={(value) => setInput((current) => ({ ...current, plantCount: value }))}
              />

              <NumberField
                label="Irrigation lines (ft)"
                value={input.irrigationLinesFt}
                onChange={(value) => setInput((current) => ({ ...current, irrigationLinesFt: value }))}
              />

              <Select
                label="Drainage type"
                value={input.drainageType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    drainageType: event.target.value as LandscapingInput["drainageType"],
                  }))
                }
              >
                <option value="none">None</option>
                <option value="swale">Swale</option>
                <option value="frenchDrain">French drain</option>
                <option value="catchBasin">Catch basin</option>
              </Select>

              <Select
                label="Soil type"
                value={input.soilType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    soilType: event.target.value as LandscapingInput["soilType"],
                  }))
                }
              >
                <option value="loam">Loam</option>
                <option value="clay">Clay</option>
                <option value="sand">Sand</option>
              </Select>

              <NumberField
                label="Hardscape area (sqft)"
                value={input.hardscapeSqft}
                onChange={(value) => setInput((current) => ({ ...current, hardscapeSqft: value }))}
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

              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                <span className="text-sm text-ink">Demo existing landscape</span>
                <input
                  type="checkbox"
                  checked={input.demoExisting}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, demoExisting: event.target.checked }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
              <strong>Note:</strong> grade, slope and discharge path matter. SEMSE should keep drainage and irrigation evidence.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              Calculate landscaping
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Result preview</h2>
                    <p className="text-sm text-muted">
                      Run the calculator to see sod, mulch, plants, drainage, labor, risk, milestones and evidence.
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
