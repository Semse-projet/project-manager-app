"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bath, Calculator } from "lucide-react";
import { Badge, Button, Card, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type BathroomScope = "cosmetic" | "tile_floor" | "tub_shower" | "full_remodel";
type BathroomSize  = "small" | "medium" | "large" | "extra_large";
type PlumbingWork  = "no_move" | "fixtures_only" | "relocate";
type MaterialQuality = "budget" | "standard" | "premium";

type BathroomInput = {
  scope: BathroomScope;
  bathroomSqFt: BathroomSize;
  plumbingWork: PlumbingWork;
  materialQuality: MaterialQuality;
  includesShower: boolean;
  includesTub: boolean;
  demoRequired: boolean;
  clientProvidesMaterials: boolean;
  mode: ToolMode;
};

const INITIAL: BathroomInput = {
  scope: "full_remodel",
  bathroomSqFt: "medium",
  plumbingWork: "no_move",
  materialQuality: "standard",
  includesShower: true,
  includesTub: false,
  demoRequired: true,
  clientProvidesMaterials: false,
  mode: "professional",
};

const SCOPE_LABELS: Record<BathroomScope, string> = {
  cosmetic:     "Cosmetic update (paint, fixtures)",
  tile_floor:   "Tile / floor replacement",
  tub_shower:   "Tub or shower replacement",
  full_remodel: "Full remodel",
};

const SIZE_LABELS: Record<BathroomSize, string> = {
  small:       "Small / half bath (< 40 sqft)",
  medium:      "Full bath (40–80 sqft)",
  large:       "Master bath (80–120 sqft)",
  extra_large: "Luxury bath (120+ sqft)",
};

const PLUMBING_LABELS: Record<PlumbingWork, string> = {
  no_move:       "No — same location",
  fixtures_only: "Replace fixtures only",
  relocate:      "Yes — relocate pipes",
};

const MATERIAL_LABELS: Record<MaterialQuality, string> = {
  budget:   "Budget — functional",
  standard: "Standard — good quality",
  premium:  "Premium — high end",
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:border-white/[0.14]">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 accent-cyan-400"
      />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

export function BathroomToolClient() {
  const [input, setInput] = useState<BathroomInput>(INITIAL);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const res = await calculateSemseTool({ tool: "bathroom", mode: input.mode, input });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error calculating bathroom estimate");
    } finally {
      setLoading(false);
    }
  }

  const set = <K extends keyof BathroomInput>(key: K, value: BathroomInput[K]) =>
    setInput(prev => ({ ...prev, [key]: value }));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} /> Back to tools hub
          </Link>
          <Badge variant="brand">SEMSE Pro Tools</Badge>
        </div>

        <section className="grid gap-3">
          <div className="flex items-center gap-3">
            <Bath size={28} className="text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Bathroom Remodel Tool</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Estimate labor, materials, risk, milestones and evidence for bathroom cosmetic updates through full remodels.
            Includes plumbing, tile, waterproofing, and scope protection.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Calculator size={16} /> Inputs
            </div>

            {/* Scope */}
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Remodel scope</label>
              <div className="grid gap-2">
                {(Object.keys(SCOPE_LABELS) as BathroomScope[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("scope", s)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      input.scope === s
                        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                        : "border-white/[0.08] bg-white/[0.02] text-ink hover:border-white/[0.14]"
                    }`}
                  >
                    {SCOPE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <Select
              label="Bathroom size"
              value={input.bathroomSqFt}
              onChange={e => set("bathroomSqFt", e.target.value as BathroomSize)}
            >
              {(Object.entries(SIZE_LABELS) as [BathroomSize, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Plumbing */}
            <Select
              label="Plumbing changes"
              value={input.plumbingWork}
              onChange={e => set("plumbingWork", e.target.value as PlumbingWork)}
            >
              {(Object.entries(PLUMBING_LABELS) as [PlumbingWork, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Materials */}
            <Select
              label="Material quality"
              value={input.materialQuality}
              onChange={e => set("materialQuality", e.target.value as MaterialQuality)}
            >
              {(Object.entries(MATERIAL_LABELS) as [MaterialQuality, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Toggles */}
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Scope options</label>
              <Toggle label="Includes shower work" checked={input.includesShower} onChange={v => set("includesShower", v)} />
              <Toggle label="Includes tub work"    checked={input.includesTub}    onChange={v => set("includesTub", v)} />
              <Toggle label="Demo required"         checked={input.demoRequired}   onChange={v => set("demoRequired", v)} />
              <Toggle label="Client provides materials" checked={input.clientProvidesMaterials} onChange={v => set("clientProvidesMaterials", v)} />
            </div>

            {/* Mode */}
            <Select
              label="Calculation mode"
              value={input.mode}
              onChange={e => set("mode", e.target.value as ToolMode)}
            >
              <option value="client">Client</option>
              <option value="professional">Professional</option>
              <option value="admin">Admin</option>
            </Select>

            {input.plumbingWork === "relocate" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
                ⚠️ Plumbing relocation requires a licensed plumber and may require a permit.
              </div>
            )}

            <Button onClick={calculate} disabled={loading} className="w-full">
              {loading ? "Calculating…" : "Calculate bathroom estimate"}
            </Button>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </Card>

          {result && (
            <div className="grid gap-4 self-start">
              <ToolResultPanel result={result} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
