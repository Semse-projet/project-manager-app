"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Home } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type ShingleType = "3-tab" | "architectural" | "metal" | "tile" | "flat-tpo" | "flat-modified";
type DeckCondition = "good" | "fair" | "poor" | "unknown";

type RoofingInput = {
  roofAreaSqFt: number;
  pitch: number;
  shingleType: ShingleType;
  removeOldRoof: boolean;
  layers: number;
  underlayment: boolean;
  iceBarrier: boolean;
  vents: number;
  skylightCount: number;
  flashingReplace: boolean;
  deckCondition: DeckCondition;
  guttersIncluded: boolean;
  warrantyYears: 20 | 30 | 50;
  mode: ToolMode;
};

const INITIAL_INPUT: RoofingInput = {
  roofAreaSqFt: 2400,
  pitch: 6,
  shingleType: "architectural",
  removeOldRoof: true,
  layers: 1,
  underlayment: true,
  iceBarrier: false,
  vents: 2,
  skylightCount: 0,
  flashingReplace: false,
  deckCondition: "fair",
  guttersIncluded: false,
  warrantyYears: 30,
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

export function RoofingToolClient() {
  const [input, setInput] = useState<RoofingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof RoofingInput>(k: K, v: RoofingInput[K]) {
    setInput((cur) => ({ ...cur, [k]: v }));
  }

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await calculateSemseTool({ tool: "roofing", mode: input.mode, input }));
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">Roofing Estimator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Full replacement and new-install estimates with material selection, deck risk, skylight flashing, warranty, confidence scoring, and AI assistant.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                <Calculator size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Roof specs</h2>
                <p className="text-sm text-muted">Inspect deck condition before finalizing price.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Roof area (sq ft)" type="number" min={100} value={input.roofAreaSqFt}
                  onChange={(e) => set("roofAreaSqFt", Number(e.target.value))} />
                <Input label="Pitch (x/12)" type="number" min={1} max={18} value={input.pitch}
                  onChange={(e) => set("pitch", Number(e.target.value))} hint="1–18" />
              </div>

              <Select label="Shingle type" value={input.shingleType}
                onChange={(e) => set("shingleType", e.target.value as ShingleType)}>
                <option value="3-tab">3-tab asphalt</option>
                <option value="architectural">Architectural / dimensional</option>
                <option value="metal">Metal panels</option>
                <option value="tile">Tile (clay/concrete)</option>
                <option value="flat-tpo">Flat — TPO membrane</option>
                <option value="flat-modified">Flat — Modified bitumen</option>
              </Select>

              <Select label="Deck condition" value={input.deckCondition}
                onChange={(e) => set("deckCondition", e.target.value as DeckCondition)}>
                <option value="good">Good — solid, no visible issues</option>
                <option value="fair">Fair — some wear, minor concerns</option>
                <option value="poor">Poor — rot, delamination, soft spots</option>
                <option value="unknown">Unknown — not inspected yet</option>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Existing layers" type="number" min={1} max={3} value={input.layers}
                  onChange={(e) => set("layers", Number(e.target.value))} />
                <Input label="Roof vents" type="number" min={0} value={input.vents}
                  onChange={(e) => set("vents", Number(e.target.value))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Skylights" type="number" min={0} value={input.skylightCount}
                  onChange={(e) => set("skylightCount", Number(e.target.value))} />
                <Select label="Warranty (years)" value={String(input.warrantyYears)}
                  onChange={(e) => set("warrantyYears", Number(e.target.value) as 20 | 30 | 50)}>
                  <option value="20">20-year</option>
                  <option value="30">30-year</option>
                  <option value="50">50-year (premium)</option>
                </Select>
              </div>

              <Toggle label="Remove old roof (tear-off)" checked={input.removeOldRoof}
                onChange={(v) => set("removeOldRoof", v)} />
              <Toggle label="Synthetic underlayment" checked={input.underlayment}
                onChange={(v) => set("underlayment", v)} />
              <Toggle label="Ice & water shield" checked={input.iceBarrier}
                onChange={(v) => set("iceBarrier", v)} hint="Eaves, valleys — freeze-thaw climates" />
              <Toggle label="Replace all flashing" checked={input.flashingReplace}
                onChange={(v) => set("flashingReplace", v)} />
              <Toggle label="Include gutters & downspouts" checked={input.guttersIncluded}
                onChange={(v) => set("guttersIncluded", v)} />

              <Select label="Mode" value={input.mode}
                onChange={(e) => set("mode", e.target.value as ToolMode)}>
                <option value="client">Client</option>
                <option value="professional">Professional</option>
                <option value="admin">Admin</option>
              </Select>
            </div>

            {(input.deckCondition === "poor" || input.deckCondition === "unknown") && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-sm text-amber-200">
                ⚠ {input.deckCondition === "unknown" ? "Inspect deck before finalizing price — hidden damage risk." : "Poor deck condition: budget for sheathing replacement and include change-order clause."}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
            )}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate roofing estimate"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <Home size={24} />
                  </div>
                  <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                  <p className="max-w-xl text-sm text-muted">
                    Configure roof specs on the left to generate a full estimate with deck risk analysis, price bands, scope, and AI assistant.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Materials</Badge>
                    <Badge variant="info">Deck risk</Badge>
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
