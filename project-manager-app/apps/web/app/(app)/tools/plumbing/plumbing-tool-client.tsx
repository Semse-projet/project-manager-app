"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type PlumbingInput = {
  fixtureCount: number;
  pipeRunFeet: number;
  drainLineFeet: number;
  waterHeaterReplace: boolean;
  slabAccess: boolean;
  outdoorWork: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: PlumbingInput = {
  fixtureCount: 3,
  pipeRunFeet: 80,
  drainLineFeet: 30,
  waterHeaterReplace: false,
  slabAccess: false,
  outdoorWork: false,
  mode: "professional",
};

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <Input
      label={label}
      type="number"
      min={0}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      hint={hint}
    />
  );
}

export function PlumbingToolClient() {
  const [input, setInput] = useState<PlumbingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "plumbing",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Plumbing calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Calculate fixtures, pipe runs, drain lines, water-heater replacement, risk, milestones and evidence through the SEMSE tools API.
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
                  Plumbing flow with direct material and labor signals.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Fixtures"
                value={input.fixtureCount}
                onChange={(value) => setInput((current) => ({ ...current, fixtureCount: value }))}
              />
              <NumberField
                label="Pipe run (ft)"
                value={input.pipeRunFeet}
                onChange={(value) => setInput((current) => ({ ...current, pipeRunFeet: value }))}
              />
              <NumberField
                label="Drain line (ft)"
                value={input.drainLineFeet}
                onChange={(value) => setInput((current) => ({ ...current, drainLineFeet: value }))}
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
                <span>Water heater replacement</span>
                <input
                  type="checkbox"
                  checked={input.waterHeaterReplace}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      waterHeaterReplace: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Slab access required</span>
                <input
                  type="checkbox"
                  checked={input.slabAccess}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      slabAccess: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Outdoor work</span>
                <input
                  type="checkbox"
                  checked={input.outdoorWork}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      outdoorWork: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate plumbing"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Calculator size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the plumbing flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Fixtures</Badge>
                    <Badge variant="info">Labor</Badge>
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
