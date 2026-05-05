"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type InsulationInput = {
  areaSqft: number;
  insulationType: "batts" | "blownIn" | "sprayFoam" | "rigidBoard";
  targetRValue: number;
  accessType: "attic" | "walls" | "crawlspace" | "garage" | "exterior";
  existingInsulation: boolean;
  airSealing: boolean;
  materialCostPerSqft: number;
  laborCostPerSqft: number;
  mode: ToolMode;
};

const INITIAL_INPUT: InsulationInput = {
  areaSqft: 800,
  insulationType: "batts",
  targetRValue: 30,
  accessType: "attic",
  existingInsulation: true,
  airSealing: true,
  materialCostPerSqft: 1.6,
  laborCostPerSqft: 1.2,
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

export function InsulationToolClient() {
  const [input, setInput] = useState<InsulationInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "insulation",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Insulation calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate insulation material, air sealing, R-value, labor, risk, milestones and evidence for energy efficiency work.
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
                  Energy efficiency flow for attic, wall and crawlspace work.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Area (sqft)"
                value={input.areaSqft}
                onChange={(value) => setInput((current) => ({ ...current, areaSqft: value }))}
              />
              <NumberField
                label="Target R-value"
                value={input.targetRValue}
                onChange={(value) => setInput((current) => ({ ...current, targetRValue: value }))}
              />
              <NumberField
                label="Material cost per sqft"
                value={input.materialCostPerSqft}
                step={0.1}
                onChange={(value) => setInput((current) => ({ ...current, materialCostPerSqft: value }))}
              />
              <NumberField
                label="Labor cost per sqft"
                value={input.laborCostPerSqft}
                step={0.1}
                onChange={(value) => setInput((current) => ({ ...current, laborCostPerSqft: value }))}
              />

              <Select
                label="Insulation type"
                value={input.insulationType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    insulationType: event.target.value as InsulationInput["insulationType"],
                  }))
                }
              >
                <option value="batts">Batts</option>
                <option value="blownIn">Blown-in</option>
                <option value="sprayFoam">Spray foam</option>
                <option value="rigidBoard">Rigid board</option>
              </Select>

              <Select
                label="Access type"
                value={input.accessType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    accessType: event.target.value as InsulationInput["accessType"],
                  }))
                }
              >
                <option value="attic">Attic</option>
                <option value="walls">Walls</option>
                <option value="crawlspace">Crawlspace</option>
                <option value="garage">Garage</option>
                <option value="exterior">Exterior</option>
              </Select>

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
                <span>Existing insulation</span>
                <input
                  type="checkbox"
                  checked={input.existingInsulation}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      existingInsulation: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Air sealing</span>
                <input
                  type="checkbox"
                  checked={input.airSealing}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      airSealing: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-sm text-emerald-100">
              <strong>Note:</strong> insulation should document R-value, air sealing and cavity condition before closeout.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate insulation"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Flame size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the insulation flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">R-value</Badge>
                    <Badge variant="info">Air sealing</Badge>
                    <Badge variant="warn">Milestones</Badge>
                    <Badge variant="success">Evidence</Badge>
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
