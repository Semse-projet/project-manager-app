"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PanelsTopLeft, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type DrywallInput = {
  wallAreaSqft: number;
  ceilingAreaSqft: number;
  panelType: "regular" | "moisture-resistant" | "fire-rated";
  panelSize: "4x8" | "4x10" | "4x12";
  finishLevel: 0 | 1 | 2 | 3 | 4 | 5;
  includeCeiling: boolean;
  repairMode: boolean;
  textureMatch: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: DrywallInput = {
  wallAreaSqft: 420,
  ceilingAreaSqft: 0,
  panelType: "regular",
  panelSize: "4x8",
  finishLevel: 4,
  includeCeiling: false,
  repairMode: false,
  textureMatch: true,
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

export function DrywallToolClient() {
  const [input, setInput] = useState<DrywallInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "drywall",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Drywall calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate panels, screws, tape, joint compound, labor, risk, milestones and evidence for drywall installation or repair.
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
                  Interior repair and finish workflow that links naturally with painting.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Wall area (sqft)"
                value={input.wallAreaSqft}
                onChange={(value) => setInput((current) => ({ ...current, wallAreaSqft: value }))}
              />
              <NumberField
                label="Ceiling area (sqft)"
                value={input.ceilingAreaSqft}
                onChange={(value) => setInput((current) => ({ ...current, ceilingAreaSqft: value }))}
              />

              <Select
                label="Panel type"
                value={input.panelType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    panelType: event.target.value as DrywallInput["panelType"],
                  }))
                }
              >
                <option value="regular">Regular</option>
                <option value="moisture-resistant">Moisture resistant</option>
                <option value="fire-rated">Fire rated</option>
              </Select>

              <Select
                label="Panel size"
                value={input.panelSize}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    panelSize: event.target.value as DrywallInput["panelSize"],
                  }))
                }
              >
                <option value="4x8">4x8</option>
                <option value="4x10">4x10</option>
                <option value="4x12">4x12</option>
              </Select>

              <Select
                label="Finish level"
                value={String(input.finishLevel)}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    finishLevel: Number(event.target.value) as DrywallInput["finishLevel"],
                  }))
                }
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
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
                <span>Include ceiling</span>
                <input
                  type="checkbox"
                  checked={input.includeCeiling}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      includeCeiling: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Repair mode</span>
                <input
                  type="checkbox"
                  checked={input.repairMode}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      repairMode: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Match texture</span>
                <input
                  type="checkbox"
                  checked={input.textureMatch}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      textureMatch: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-sm text-cyan-100">
              <strong>Note:</strong> drywall level 5 and ceiling work should request extra evidence, especially before primer or painting.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate drywall"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <PanelsTopLeft size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the drywall flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Panels</Badge>
                    <Badge variant="info">Finish</Badge>
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
