"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type MasonryInput = {
  wallLengthFt: number;
  wallHeightFt: number;
  unitType: "block8" | "brick" | "stoneVeneer";
  wastePercent: number;
  unitCost: number;
  mortarBagCost: number;
  laborRatePerSqft: number;
  reinforced: boolean;
  exteriorWork: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: MasonryInput = {
  wallLengthFt: 30,
  wallHeightFt: 8,
  unitType: "block8",
  wastePercent: 0.08,
  unitCost: 2.25,
  mortarBagCost: 9,
  laborRatePerSqft: 12,
  reinforced: true,
  exteriorWork: true,
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

export function MasonryToolClient() {
  const [input, setInput] = useState<MasonryInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "masonry",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Masonry / Block calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate block, brick or stone veneer, mortar, reinforcement, labor, risk, milestones and evidence for masonry work.
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
                  Exterior / structural light masonry workflow with footing and plumb checks.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Wall length (ft)"
                value={input.wallLengthFt}
                onChange={(value) => setInput((current) => ({ ...current, wallLengthFt: value }))}
              />

              <NumberField
                label="Wall height (ft)"
                value={input.wallHeightFt}
                onChange={(value) => setInput((current) => ({ ...current, wallHeightFt: value }))}
              />

              <Select
                label="Unit type"
                value={input.unitType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    unitType: event.target.value as MasonryInput["unitType"],
                  }))
                }
              >
                <option value="block8">Block 8x8x16</option>
                <option value="brick">Brick</option>
                <option value="stoneVeneer">Stone veneer</option>
              </Select>

              <NumberField
                label="Waste percent"
                value={input.wastePercent}
                step={0.01}
                onChange={(value) => setInput((current) => ({ ...current, wastePercent: value }))}
              />

              <NumberField
                label="Unit cost"
                value={input.unitCost}
                step={0.01}
                onChange={(value) => setInput((current) => ({ ...current, unitCost: value }))}
              />

              <NumberField
                label="Mortar bag cost"
                value={input.mortarBagCost}
                step={0.01}
                onChange={(value) => setInput((current) => ({ ...current, mortarBagCost: value }))}
              />

              <NumberField
                label="Labor per ft²"
                value={input.laborRatePerSqft}
                step={0.01}
                onChange={(value) => setInput((current) => ({ ...current, laborRatePerSqft: value }))}
              />

              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                <input
                  type="checkbox"
                  checked={input.reinforced}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, reinforced: event.target.checked }))
                  }
                />
                <span>Include reinforcement / rebar</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                <input
                  type="checkbox"
                  checked={input.exteriorWork}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, exteriorWork: event.target.checked }))
                  }
                />
                <span>Exterior work</span>
              </label>

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
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
              <strong>Note:</strong> tall walls, exterior work and non-reinforced masonry should trigger extra checks on footing, plumb and approval.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              Calculate masonry
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
                      Run the calculator to see block / brick / stone takeoff, mortar, labor, risk, milestones and evidence.
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
