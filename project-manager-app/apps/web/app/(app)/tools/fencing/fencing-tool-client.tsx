"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type FencingInput = {
  fenceLengthFt: number;
  fenceHeightFt: number;
  materialType: "wood" | "vinyl" | "chainLink" | "metal";
  postSpacingFt: number;
  gateCount: number;
  demoExisting: boolean;
  stainSeal: boolean;
  terrainType: "flat" | "sloped" | "rocky";
  mode: ToolMode;
};

const INITIAL_INPUT: FencingInput = {
  fenceLengthFt: 80,
  fenceHeightFt: 6,
  materialType: "wood",
  postSpacingFt: 8,
  gateCount: 1,
  demoExisting: false,
  stainSeal: true,
  terrainType: "flat",
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

export function FencingToolClient() {
  const [input, setInput] = useState<FencingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "fencing",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Fencing calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate fence panels, posts, gates, labor, risk, evidence and milestones for new fence or replacement work.
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
                  Exterior fence workflow with property line, slope and gate checks.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Fence length (ft)"
                value={input.fenceLengthFt}
                onChange={(value) => setInput((current) => ({ ...current, fenceLengthFt: value }))}
              />

              <NumberField
                label="Fence height (ft)"
                value={input.fenceHeightFt}
                onChange={(value) => setInput((current) => ({ ...current, fenceHeightFt: value }))}
              />

              <Select
                label="Material type"
                value={input.materialType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    materialType: event.target.value as FencingInput["materialType"],
                  }))
                }
              >
                <option value="wood">Wood</option>
                <option value="vinyl">Vinyl</option>
                <option value="chainLink">Chain link</option>
                <option value="metal">Metal</option>
              </Select>

              <NumberField
                label="Post spacing (ft)"
                value={input.postSpacingFt}
                onChange={(value) => setInput((current) => ({ ...current, postSpacingFt: value }))}
              />

              <NumberField
                label="Gate count"
                value={input.gateCount}
                onChange={(value) => setInput((current) => ({ ...current, gateCount: value }))}
              />

              <Select
                label="Terrain"
                value={input.terrainType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    terrainType: event.target.value as FencingInput["terrainType"],
                  }))
                }
              >
                <option value="flat">Flat</option>
                <option value="sloped">Sloped</option>
                <option value="rocky">Rocky</option>
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

              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                <span className="text-sm text-ink">Demo existing fence</span>
                <input
                  type="checkbox"
                  checked={input.demoExisting}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, demoExisting: event.target.checked }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                <span className="text-sm text-ink">Stain / seal wood</span>
                <input
                  type="checkbox"
                  checked={input.stainSeal}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, stainSeal: event.target.checked }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
              <strong>Note:</strong> verify property line, slope and gate placement before digging post holes.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              Calculate fencing
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
                      Run the calculator to see fence panels, posts, gates, labor, risk, milestones and evidence.
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
