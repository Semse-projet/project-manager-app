"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Zap } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type ElectricalInput = {
  watts: number;
  voltage: 120 | 208 | 220 | 240;
  powerFactor: number;
  phase: 1 | 3;
  isContinuous: boolean;
  runFeet: number;
  numCircuits: number;
  panelUpgrade: boolean;
  outdoorWork: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: ElectricalInput = {
  watts: 2400,
  voltage: 120,
  powerFactor: 0.9,
  phase: 1,
  isContinuous: false,
  runFeet: 75,
  numCircuits: 1,
  panelUpgrade: false,
  outdoorWork: false,
  mode: "professional",
};

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <Input
      label={label}
      type="number"
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      hint={hint}
    />
  );
}

export function ElectricalToolClient() {
  const [input, setInput] = useState<ElectricalInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "electrical",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Electrical calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Calculate load, breaker, conductor, voltage drop, risk, milestones and evidence through the SEMSE tools API.
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
                  Electrical flow with NEC-oriented warnings and safety-critical signals.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Watts"
                value={input.watts}
                onChange={(value) => setInput((current) => ({ ...current, watts: value }))}
              />
              <NumberField
                label="Voltage"
                value={input.voltage}
                onChange={(value) => setInput((current) => ({ ...current, voltage: value as ElectricalInput["voltage"] }))}
                hint="Common values: 120, 208, 220 or 240."
              />
              <NumberField
                label="Power factor"
                value={input.powerFactor}
                step={0.01}
                onChange={(value) => setInput((current) => ({ ...current, powerFactor: value }))}
              />
              <NumberField
                label="Run distance (ft)"
                value={input.runFeet}
                onChange={(value) => setInput((current) => ({ ...current, runFeet: value }))}
              />
              <NumberField
                label="Number of circuits"
                value={input.numCircuits}
                onChange={(value) => setInput((current) => ({ ...current, numCircuits: value }))}
              />

              <Select
                label="Phase"
                value={input.phase}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    phase: Number(event.target.value) as ElectricalInput["phase"],
                  }))
                }
              >
                <option value={1}>Single phase</option>
                <option value={3}>Three phase</option>
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
                <span>Continuous load</span>
                <input
                  type="checkbox"
                  checked={input.isContinuous}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      isContinuous: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Panel upgrade</span>
                <input
                  type="checkbox"
                  checked={input.panelUpgrade}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      panelUpgrade: event.target.checked,
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

            <div className="grid gap-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-100">
              <p>
                <strong>Safety critical:</strong> electrical work should be reviewed by a qualified professional and checked against local code.
              </p>
              <p>
                Do not release escrow without final photos, measurements and inspection evidence.
              </p>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate electrical"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Zap size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the electrical flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Load</Badge>
                    <Badge variant="info">Conductor</Badge>
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
