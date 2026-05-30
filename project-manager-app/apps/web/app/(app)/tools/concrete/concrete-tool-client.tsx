"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, MetricCard, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type ConcreteInput = {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
  wastePercent: number;
  mixStrength: "2500psi" | "3000psi" | "3500psi" | "4000psi";
  reinforced: boolean;
  formworkIncluded: boolean;
  pumpRequired: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: ConcreteInput = {
  lengthFt: 20,
  widthFt: 15,
  thicknessIn: 4,
  wastePercent: 10,
  mixStrength: "3000psi",
  reinforced: true,
  formworkIncluded: true,
  pumpRequired: false,
  mode: "professional",
};


function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <MetricCard
      label={label}
      value={value}
      sub={sub}
      className="min-h-[112px]"
    />
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

export function ConcreteToolClient() {
  const [input, setInput] = useState<ConcreteInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalculate() {
    setLoading(true);
    setError(null);

    try {
      const data = await calculateSemseTool({
        tool: "concrete",
        mode: input.mode,
        input,
      });
      setResult(data);
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Concrete calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Calculate slab volume, mix requirements, reinforcement, milestone plan and evidence checklist through the tools API.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <SectionTitle
              icon={<Calculator size={18} />}
              title="Input"
              description="Enter slab dimensions and mix preferences. The engine handles pricing and risk logic."
            />

            <div className="grid gap-4">
              <Input
                label="Length (ft)"
                type="number"
                min={0}
                value={input.lengthFt}
                onChange={(event) => setInput((current) => ({ ...current, lengthFt: Number(event.target.value) }))}
              />

              <Input
                label="Width (ft)"
                type="number"
                min={0}
                value={input.widthFt}
                onChange={(event) => setInput((current) => ({ ...current, widthFt: Number(event.target.value) }))}
              />

              <Input
                label="Thickness (in)"
                type="number"
                min={2}
                max={24}
                value={input.thicknessIn}
                onChange={(event) => setInput((current) => ({ ...current, thicknessIn: Number(event.target.value) }))}
              />

              <Input
                label="Waste (%)"
                type="number"
                min={0}
                max={30}
                value={input.wastePercent}
                onChange={(event) => setInput((current) => ({ ...current, wastePercent: Number(event.target.value) }))}
              />

              <Select
                label="Mix strength"
                value={input.mixStrength}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    mixStrength: event.target.value as ConcreteInput["mixStrength"],
                  }))
                }
              >
                <option value="2500psi">2500 PSI</option>
                <option value="3000psi">3000 PSI</option>
                <option value="3500psi">3500 PSI</option>
                <option value="4000psi">4000 PSI</option>
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
                <span>Reinforced</span>
                <input
                  type="checkbox"
                  checked={input.reinforced}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      reinforced: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Include formwork</span>
                <input
                  type="checkbox"
                  checked={input.formworkIncluded}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      formworkIncluded: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Pump required</span>
                <input
                  type="checkbox"
                  checked={input.pumpRequired}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      pumpRequired: event.target.checked,
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

            <Button onClick={() => void handleCalculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate concrete"}
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
                      Fill the fields on the left and run the concrete flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Volume</Badge>
                    <Badge variant="info">Mix</Badge>
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
