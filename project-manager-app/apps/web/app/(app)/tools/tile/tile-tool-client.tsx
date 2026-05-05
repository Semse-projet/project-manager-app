"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Grid2x2, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type TileInput = {
  lengthFt: number;
  widthFt: number;
  tileSizeIn: number;
  pattern: "straight" | "diagonal" | "herringbone";
  areaType: "floor" | "wall" | "backsplash" | "shower";
  waterproofing: boolean;
  demoExisting: boolean;
  substratePrep: "none" | "minor" | "major";
  groutType: "standard" | "sanded" | "epoxy";
  mode: ToolMode;
};

const INITIAL_INPUT: TileInput = {
  lengthFt: 12,
  widthFt: 10,
  tileSizeIn: 12,
  pattern: "straight",
  areaType: "floor",
  waterproofing: false,
  demoExisting: false,
  substratePrep: "minor",
  groutType: "standard",
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

export function TileToolClient() {
  const [input, setInput] = useState<TileInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "tile",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Tile calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate tile layout, waterproofing, grout, thinset, labor, milestones and evidence for walls, floors, backsplashes and showers.
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
                  Wet-area tile work with strong evidence requirements for shower installs.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Length (ft)"
                value={input.lengthFt}
                onChange={(value) => setInput((current) => ({ ...current, lengthFt: value }))}
              />
              <NumberField
                label="Width (ft)"
                value={input.widthFt}
                onChange={(value) => setInput((current) => ({ ...current, widthFt: value }))}
              />
              <NumberField
                label="Tile size (in)"
                value={input.tileSizeIn}
                onChange={(value) => setInput((current) => ({ ...current, tileSizeIn: value }))}
              />

              <Select
                label="Pattern"
                value={input.pattern}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    pattern: event.target.value as TileInput["pattern"],
                  }))
                }
              >
                <option value="straight">Straight</option>
                <option value="diagonal">Diagonal</option>
                <option value="herringbone">Herringbone</option>
              </Select>

              <Select
                label="Area type"
                value={input.areaType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    areaType: event.target.value as TileInput["areaType"],
                  }))
                }
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
                <option value="backsplash">Backsplash</option>
                <option value="shower">Shower</option>
              </Select>

              <Select
                label="Substrate prep"
                value={input.substratePrep}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    substratePrep: event.target.value as TileInput["substratePrep"],
                  }))
                }
              >
                <option value="none">None</option>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
              </Select>

              <Select
                label="Grout type"
                value={input.groutType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    groutType: event.target.value as TileInput["groutType"],
                  }))
                }
              >
                <option value="standard">Standard</option>
                <option value="sanded">Sanded</option>
                <option value="epoxy">Epoxy</option>
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
                <span>Waterproofing</span>
                <input
                  type="checkbox"
                  checked={input.waterproofing}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      waterproofing: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Demo existing tile</span>
                <input
                  type="checkbox"
                  checked={input.demoExisting}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      demoExisting: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-sm text-cyan-100">
              <strong>Note:</strong> shower tile and diagonal patterns should elevate risk, evidence and waterproofing checks.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate tile"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Grid2x2 size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the tile flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Layout</Badge>
                    <Badge variant="info">Waterproofing</Badge>
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
