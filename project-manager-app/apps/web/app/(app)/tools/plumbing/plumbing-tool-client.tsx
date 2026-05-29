"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Droplets } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type PipeType        = "pex" | "cpvc" | "copper" | "galvanized";
type WaterHeaterType = "tank-gas" | "tank-electric" | "tankless-gas" | "tankless-electric" | "heat-pump-wh";
type PlumbingScope   = "fixture-service" | "partial-repipe" | "full-repipe" | "new-rough-in";
type PipeCondition   = "good" | "fair" | "poor" | "unknown";

type PlumbingInput = {
  scope: PlumbingScope;
  fixtureCount: number;
  pipeType: PipeType;
  supplyLineFeet: number;
  drainLineFeet: number;
  waterHeaterReplace: boolean;
  waterHeaterType: WaterHeaterType;
  waterHeaterGallons: number;
  slabAccess: boolean;
  crawlspaceAccess: boolean;
  gasWork: boolean;
  outdoorWork: boolean;
  backflowPreventer: boolean;
  existingPipeCondition: PipeCondition;
  mode: ToolMode;
};

const INITIAL_INPUT: PlumbingInput = {
  scope: "fixture-service",
  fixtureCount: 3,
  pipeType: "pex",
  supplyLineFeet: 60,
  drainLineFeet: 30,
  waterHeaterReplace: false,
  waterHeaterType: "tank-gas",
  waterHeaterGallons: 40,
  slabAccess: false,
  crawlspaceAccess: false,
  gasWork: false,
  outdoorWork: false,
  backflowPreventer: false,
  existingPipeCondition: "fair",
  mode: "professional",
};

function Toggle({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink cursor-pointer">
      <div>
        <div>{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function PlumbingToolClient() {
  const [input, setInput] = useState<PlumbingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PlumbingInput>(k: K, v: PlumbingInput[K]) {
    setInput((cur) => ({ ...cur, [k]: v }));
  }

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await calculateSemseTool({ tool: "plumbing", mode: input.mode, input }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calculation error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} /> Back to tools hub
          </Link>
          <Badge variant="brand">SEMSE Pro Tools</Badge>
        </div>

        <section className="grid gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Plumbing Estimator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Full plumbing estimates with pipe type, water heater, slab access, gas work, hidden damage risk, confidence scoring, and AI assistant.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                <Calculator size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Project specs</h2>
                <p className="text-sm text-muted">Camera inspect pipes if condition is unknown.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <Select label="Scope" value={input.scope}
                onChange={(e) => set("scope", e.target.value as PlumbingScope)}>
                <option value="fixture-service">Fixture service / repair</option>
                <option value="partial-repipe">Partial repipe</option>
                <option value="full-repipe">Full repipe</option>
                <option value="new-rough-in">New rough-in</option>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Fixtures" type="number" min={1} value={input.fixtureCount}
                  onChange={(e) => set("fixtureCount", Number(e.target.value))} />
                <Select label="Pipe type" value={input.pipeType}
                  onChange={(e) => set("pipeType", e.target.value as PipeType)}>
                  <option value="pex">PEX</option>
                  <option value="cpvc">CPVC</option>
                  <option value="copper">Copper</option>
                  <option value="galvanized">Galvanized (end-of-life)</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Supply line (ft)" type="number" min={0} value={input.supplyLineFeet}
                  onChange={(e) => set("supplyLineFeet", Number(e.target.value))} />
                <Input label="Drain line (ft)" type="number" min={0} value={input.drainLineFeet}
                  onChange={(e) => set("drainLineFeet", Number(e.target.value))} />
              </div>

              <Select label="Existing pipe condition" value={input.existingPipeCondition}
                onChange={(e) => set("existingPipeCondition", e.target.value as PipeCondition)}>
                <option value="good">Good — no issues</option>
                <option value="fair">Fair — some wear</option>
                <option value="poor">Poor — corrosion/scale present</option>
                <option value="unknown">Unknown — camera inspection needed</option>
              </Select>

              {/* Water heater */}
              <Toggle label="Water heater replacement" checked={input.waterHeaterReplace}
                onChange={(v) => set("waterHeaterReplace", v)} />

              {input.waterHeaterReplace && (
                <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-brand/20">
                  <Select label="WH type" value={input.waterHeaterType}
                    onChange={(e) => set("waterHeaterType", e.target.value as WaterHeaterType)}>
                    <option value="tank-gas">Tank — gas</option>
                    <option value="tank-electric">Tank — electric</option>
                    <option value="tankless-gas">Tankless — gas</option>
                    <option value="tankless-electric">Tankless — electric</option>
                    <option value="heat-pump-wh">Heat pump WH</option>
                  </Select>
                  <Input label="Gallons" type="number" min={20} value={input.waterHeaterGallons}
                    onChange={(e) => set("waterHeaterGallons", Number(e.target.value))} />
                </div>
              )}

              {/* Access & extras */}
              <Toggle label="Slab access (concrete cut)" checked={input.slabAccess}
                onChange={(v) => set("slabAccess", v)} hint="Significant cost and schedule impact" />
              <Toggle label="Crawlspace access" checked={input.crawlspaceAccess}
                onChange={(v) => set("crawlspaceAccess", v)} />
              <Toggle label="Gas line work" checked={input.gasWork}
                onChange={(v) => set("gasWork", v)} hint="Requires gas certification" />
              <Toggle label="Backflow preventer" checked={input.backflowPreventer}
                onChange={(v) => set("backflowPreventer", v)} />

              <Select label="Mode" value={input.mode}
                onChange={(e) => set("mode", e.target.value as ToolMode)}>
                <option value="client">Client</option>
                <option value="professional">Professional</option>
                <option value="admin">Admin</option>
              </Select>
            </div>

            {input.slabAccess && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                ⚠ Slab access: confirm no post-tension cables before cutting. Concrete restoration costs are included.
              </div>
            )}
            {input.existingPipeCondition === "unknown" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-sm text-amber-200">
                ⚠ Unknown pipe condition: camera inspection recommended before finalizing slab or repipe pricing.
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
            )}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate plumbing estimate"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Droplets size={24} />
                  </div>
                  <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                  <p className="max-w-xl text-sm text-muted">
                    Configure project specs on the left to generate a full plumbing estimate with pipe risk, slab surcharge, price bands, and AI assistant.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Pipe type</Badge>
                    <Badge variant="info">Slab risk</Badge>
                    <Badge variant="warn">Milestones</Badge>
                    <Badge variant="success">AI assistant</Badge>
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
