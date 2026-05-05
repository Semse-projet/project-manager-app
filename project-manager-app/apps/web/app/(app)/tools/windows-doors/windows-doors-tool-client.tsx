"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, DoorOpen, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type WindowsDoorsInput = {
  windows: number;
  doors: number;
  installType:
    | "replacement"
    | "newConstruction"
    | "exteriorDoor"
    | "interiorDoor"
    | "slidingDoor";
  windowCost: number;
  doorCost: number;
  laborPerUnit: number;
  exteriorWork: boolean;
  flashingRequired: boolean;
  trimIncluded: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: WindowsDoorsInput = {
  windows: 4,
  doors: 1,
  installType: "replacement",
  windowCost: 280,
  doorCost: 450,
  laborPerUnit: 160,
  exteriorWork: true,
  flashingRequired: true,
  trimIncluded: true,
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

export function WindowsDoorsToolClient() {
  const [input, setInput] = useState<WindowsDoorsInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "windowsDoors",
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Windows / Doors calculator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Estimate replacement windows, doors, flashing, trim, labor, risk, evidence and escrow-ready closeout.
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
                  Exterior / interior openings with strong weatherproofing controls.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <NumberField
                label="Windows"
                value={input.windows}
                onChange={(value) => setInput((current) => ({ ...current, windows: value }))}
              />
              <NumberField
                label="Doors"
                value={input.doors}
                onChange={(value) => setInput((current) => ({ ...current, doors: value }))}
              />

              <Select
                label="Install type"
                value={input.installType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    installType: event.target.value as WindowsDoorsInput["installType"],
                  }))
                }
              >
                <option value="replacement">Replacement</option>
                <option value="newConstruction">New construction</option>
                <option value="exteriorDoor">Exterior door</option>
                <option value="interiorDoor">Interior door</option>
                <option value="slidingDoor">Sliding door</option>
              </Select>

              <NumberField
                label="Window cost"
                value={input.windowCost}
                onChange={(value) => setInput((current) => ({ ...current, windowCost: value }))}
              />
              <NumberField
                label="Door cost"
                value={input.doorCost}
                onChange={(value) => setInput((current) => ({ ...current, doorCost: value }))}
              />
              <NumberField
                label="Labor per unit"
                value={input.laborPerUnit}
                onChange={(value) => setInput((current) => ({ ...current, laborPerUnit: value }))}
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
                <span>Exterior work</span>
                <input
                  type="checkbox"
                  checked={input.exteriorWork}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      exteriorWork: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Flashing required</span>
                <input
                  type="checkbox"
                  checked={input.flashingRequired}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      flashingRequired: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                <span>Trim included</span>
                <input
                  type="checkbox"
                  checked={input.trimIncluded}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      trimIncluded: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
              <strong>Note:</strong> exterior installs should always document flashing, sealant, plumb / level checks and final weatherproofing.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate Windows / Doors"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <DoorOpen size={24} />
                  </div>
                  <div className="grid gap-1">
                    <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                    <p className="max-w-xl text-sm text-muted">
                      Fill the fields on the left and run the windows / doors flow through the tools API.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Openings</Badge>
                    <Badge variant="info">Weatherproofing</Badge>
                    <Badge variant="warn">Escrow</Badge>
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
