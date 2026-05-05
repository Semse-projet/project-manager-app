"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type DeckInput = {
  deckLengthFt: number;
  deckWidthFt: number;
  materialType: "pressureTreated" | "cedar" | "composite" | "tropicalHardwood";
  joistSpacingIn: 12 | 16 | 24;
  postCount: number;
  railingLinearFt: number;
  stairsCount: number;
  demoExisting: boolean;
  stainSeal: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: DeckInput = {
  deckLengthFt: 16,
  deckWidthFt: 12,
  materialType: "pressureTreated",
  joistSpacingIn: 16,
  postCount: 4,
  railingLinearFt: 24,
  stairsCount: 1,
  demoExisting: false,
  stainSeal: true,
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

export function DeckToolClient() {
  const [input, setInput] = useState<DeckInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "deck",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Deck calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate decking boards, framing, railing, stairs, labor, risk, evidence and milestones for new deck or remodel work.
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
                  Exterior deck flow with demo, railing and stair checks.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Deck length (ft)"
                value={input.deckLengthFt}
                onChange={(value) => setInput((current) => ({ ...current, deckLengthFt: value }))}
              />

              <NumberField
                label="Deck width (ft)"
                value={input.deckWidthFt}
                onChange={(value) => setInput((current) => ({ ...current, deckWidthFt: value }))}
              />

              <Select
                label="Material type"
                value={input.materialType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    materialType: event.target.value as DeckInput["materialType"],
                  }))
                }
              >
                <option value="pressureTreated">Pressure treated</option>
                <option value="cedar">Cedar</option>
                <option value="composite">Composite</option>
                <option value="tropicalHardwood">Tropical hardwood</option>
              </Select>

              <Select
                label="Joist spacing"
                value={String(input.joistSpacingIn)}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    joistSpacingIn: Number(event.target.value) as DeckInput["joistSpacingIn"],
                  }))
                }
              >
                <option value="12">12 in</option>
                <option value="16">16 in</option>
                <option value="24">24 in</option>
              </Select>

              <NumberField
                label="Post count"
                value={input.postCount}
                onChange={(value) => setInput((current) => ({ ...current, postCount: value }))}
              />

              <NumberField
                label="Railing linear ft"
                value={input.railingLinearFt}
                onChange={(value) => setInput((current) => ({ ...current, railingLinearFt: value }))}
              />

              <NumberField
                label="Stairs count"
                value={input.stairsCount}
                onChange={(value) => setInput((current) => ({ ...current, stairsCount: value }))}
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
                <span className="text-sm text-ink">Demo existing deck</span>
                <input
                  type="checkbox"
                  checked={input.demoExisting}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, demoExisting: event.target.checked }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                <span className="text-sm text-ink">Stain / seal</span>
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
              <strong>Note:</strong> railing, stairs and demo work increase risk. SEMSE should keep evidence on frame, footings and final safe access.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              Calculate deck
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
                      Run the calculator to see decking, framing, railing, stairs, labor, risk, milestones and evidence.
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
