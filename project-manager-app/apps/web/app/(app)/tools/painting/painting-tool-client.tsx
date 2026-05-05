"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brush, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type PaintingInput = {
  roomLengthFt: number;
  roomWidthFt: number;
  wallHeightFt: number;
  doors: number;
  windows: number;
  coats: number;
  surfaceType: "smooth" | "textured" | "newDrywall" | "exterior";
  includeCeiling: boolean;
  includePrimer: boolean;
  paintQuality: "economy" | "standard" | "premium";
  mode: ToolMode;
};

const INITIAL_INPUT: PaintingInput = {
  roomLengthFt: 16,
  roomWidthFt: 12,
  wallHeightFt: 9,
  doors: 2,
  windows: 3,
  coats: 2,
  surfaceType: "smooth",
  includeCeiling: false,
  includePrimer: true,
  paintQuality: "standard",
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

export function PaintingToolClient() {
  const [input, setInput] = useState<PaintingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "painting",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Painting calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Calculate net area, gallons, primer, labor, risk, milestones and evidence for residential painting work.
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
                  High-volume residential flow with fast quoting signals.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Room length (ft)"
                value={input.roomLengthFt}
                onChange={(value) => setInput((current) => ({ ...current, roomLengthFt: value }))}
              />
              <NumberField
                label="Room width (ft)"
                value={input.roomWidthFt}
                onChange={(value) => setInput((current) => ({ ...current, roomWidthFt: value }))}
              />
              <NumberField
                label="Wall height (ft)"
                value={input.wallHeightFt}
                onChange={(value) => setInput((current) => ({ ...current, wallHeightFt: value }))}
              />
              <NumberField
                label="Doors"
                value={input.doors}
                onChange={(value) => setInput((current) => ({ ...current, doors: value }))}
              />
              <NumberField
                label="Windows"
                value={input.windows}
                onChange={(value) => setInput((current) => ({ ...current, windows: value }))}
              />
              <NumberField
                label="Coats"
                value={input.coats}
                onChange={(value) => setInput((current) => ({ ...current, coats: value }))}
              />

              <Select
                label="Surface type"
                value={input.surfaceType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    surfaceType: event.target.value as PaintingInput["surfaceType"],
                  }))
                }
              >
                <option value="smooth">Smooth</option>
                <option value="textured">Textured</option>
                <option value="newDrywall">New drywall</option>
                <option value="exterior">Exterior</option>
              </Select>

              <Select
                label="Paint quality"
                value={input.paintQuality}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    paintQuality: event.target.value as PaintingInput["paintQuality"],
                  }))
                }
              >
                <option value="economy">Economy</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
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
                <span>Include primer</span>
                <input
                  type="checkbox"
                  checked={input.includePrimer}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      includePrimer: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-sm text-cyan-100">
              <strong>Note:</strong> painting should request before/after photos, color confirmation, finish type and surface prep evidence when risk is medium or higher.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate painting"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Brush size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the painting flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Area</Badge>
                    <Badge variant="info">Primer</Badge>
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
