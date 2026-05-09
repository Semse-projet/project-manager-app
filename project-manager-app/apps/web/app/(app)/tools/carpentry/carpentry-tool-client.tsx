"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Hammer, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type CarpentryInput = {
  projectType: "cabinet" | "door" | "closet" | "shelf" | "trim" | "table" | "repair" | "custom";
  material: "pine" | "plywood" | "mdf" | "oak" | "treated";
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  quantity: number;
  finishType: "none" | "paint" | "stain" | "polyurethane";
  complexity: "basic" | "medium" | "complex";
  hardwareCount: number;
  mode: ToolMode;
};

const INITIAL_INPUT: CarpentryInput = {
  projectType: "closet",
  material: "plywood",
  lengthIn: 96,
  widthIn: 24,
  thicknessIn: 0.75,
  quantity: 6,
  finishType: "paint",
  complexity: "medium",
  hardwareCount: 12,
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

export function CarpentryToolClient() {
  const [input, setInput] = useState<CarpentryInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "carpentry",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Carpentry calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate board feet, hardware, finish materials, labor, milestones and evidence for cabinetry, trim and finish carpentry.
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
                  Interior and finish carpentry flows with durable closeout evidence.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <Select
                label="Project type"
                value={input.projectType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    projectType: event.target.value as CarpentryInput["projectType"],
                  }))
                }
              >
                <option value="cabinet">Cabinet</option>
                <option value="door">Door</option>
                <option value="closet">Closet</option>
                <option value="shelf">Shelf</option>
                <option value="trim">Trim</option>
                <option value="table">Table</option>
                <option value="repair">Repair</option>
                <option value="custom">Custom</option>
              </Select>

              <Select
                label="Material"
                value={input.material}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    material: event.target.value as CarpentryInput["material"],
                  }))
                }
              >
                <option value="pine">Pine</option>
                <option value="plywood">Plywood</option>
                <option value="mdf">MDF</option>
                <option value="oak">Oak</option>
                <option value="treated">Treated</option>
              </Select>

              <NumberField
                label="Length (in)"
                value={input.lengthIn}
                onChange={(value) => setInput((current) => ({ ...current, lengthIn: value }))}
              />
              <NumberField
                label="Width (in)"
                value={input.widthIn}
                onChange={(value) => setInput((current) => ({ ...current, widthIn: value }))}
              />
              <NumberField
                label="Thickness (in)"
                value={input.thicknessIn}
                step={0.01}
                onChange={(value) => setInput((current) => ({ ...current, thicknessIn: value }))}
              />
              <NumberField
                label="Quantity"
                value={input.quantity}
                onChange={(value) => setInput((current) => ({ ...current, quantity: value }))}
              />
              <NumberField
                label="Hardware count"
                value={input.hardwareCount}
                onChange={(value) => setInput((current) => ({ ...current, hardwareCount: value }))}
              />

              <Select
                label="Finish type"
                value={input.finishType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    finishType: event.target.value as CarpentryInput["finishType"],
                  }))
                }
              >
                <option value="none">None</option>
                <option value="paint">Paint</option>
                <option value="stain">Stain</option>
                <option value="polyurethane">Polyurethane</option>
              </Select>

              <Select
                label="Complexity"
                value={input.complexity}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    complexity: event.target.value as CarpentryInput["complexity"],
                  }))
                }
              >
                <option value="basic">Basic</option>
                <option value="medium">Medium</option>
                <option value="complex">Complex</option>
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
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-sm text-cyan-100">
              <strong>Note:</strong> MDF and exterior-style pieces should be sealed and described clearly in the quote.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate carpentry"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Hammer size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the carpentry flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Board feet</Badge>
                    <Badge variant="info">Hardware</Badge>
                    <Badge variant="warn">Finish</Badge>
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
