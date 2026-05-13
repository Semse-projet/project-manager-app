"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChefHat, Calculator } from "lucide-react";
import { Badge, Button, Card, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type KitchenScope    = "cabinet_update" | "countertops" | "flooring" | "full_remodel";
type KitchenSize     = "small" | "medium" | "large" | "extra_large";
type Appliances      = "no_appliances" | "basic_appliances" | "premium_appliances";
type MaterialQuality = "budget" | "standard" | "premium";
type PlumbingElec    = "no" | "minor" | "relocate";

type KitchenInput = {
  scope: KitchenScope;
  kitchenSize: KitchenSize;
  appliances: Appliances;
  materialQuality: MaterialQuality;
  plumbingElectrical: PlumbingElec;
  clientProvidesMaterials: boolean;
  mode: ToolMode;
};

const INITIAL: KitchenInput = {
  scope: "full_remodel",
  kitchenSize: "medium",
  appliances: "basic_appliances",
  materialQuality: "standard",
  plumbingElectrical: "no",
  clientProvidesMaterials: false,
  mode: "professional",
};

const SCOPE_LABELS: Record<KitchenScope, string> = {
  cabinet_update: "Cabinet paint / update",
  countertops:    "Countertop replacement",
  flooring:       "New floor / tile",
  full_remodel:   "Full kitchen renovation",
};

const SIZE_LABELS: Record<KitchenSize, string> = {
  small:       "Small (< 100 sqft)",
  medium:      "Medium (100–200 sqft)",
  large:       "Large (200–350 sqft)",
  extra_large: "Extra large (350+ sqft)",
};

const APPLIANCE_LABELS: Record<Appliances, string> = {
  no_appliances:       "No appliances",
  basic_appliances:    "Basic appliances",
  premium_appliances:  "Premium appliances",
};

const MATERIAL_LABELS: Record<MaterialQuality, string> = {
  budget:   "Budget — laminate / melamine",
  standard: "Standard — wood / basic granite",
  premium:  "Premium — quartz / solid wood",
};

const PLUMBING_LABELS: Record<PlumbingElec, string> = {
  no:      "No changes needed",
  minor:   "Minor changes only",
  relocate: "Relocate pipes / electrical",
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

export function KitchenToolClient() {
  const [input, setInput] = useState<KitchenInput>(INITIAL);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const res = await calculateSemseTool({ tool: "kitchen", mode: input.mode, input });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error calculating kitchen estimate");
    } finally {
      setLoading(false);
    }
  }

  const set = <K extends keyof KitchenInput>(key: K, value: KitchenInput[K]) =>
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
            <ChefHat size={28} className="text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Kitchen Remodel Tool</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Estimate cabinets, countertops, appliances, plumbing, labor, risk, milestones and evidence
            for kitchen cabinet updates through full renovations.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Calculator size={16} /> Inputs
            </div>

            {/* Scope */}
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Kitchen scope</label>
              <div className="grid gap-2">
                {(Object.keys(SCOPE_LABELS) as KitchenScope[]).map(s => (
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
              label="Kitchen size"
              value={input.kitchenSize}
              onChange={e => set("kitchenSize", e.target.value as KitchenSize)}
            >
              {(Object.entries(SIZE_LABELS) as [KitchenSize, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Appliances */}
            <Select
              label="Appliances"
              value={input.appliances}
              onChange={e => set("appliances", e.target.value as Appliances)}
            >
              {(Object.entries(APPLIANCE_LABELS) as [Appliances, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Materials */}
            <Select
              label="Material quality (cabinets / countertops)"
              value={input.materialQuality}
              onChange={e => set("materialQuality", e.target.value as MaterialQuality)}
            >
              {(Object.entries(MATERIAL_LABELS) as [MaterialQuality, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Plumbing / electrical */}
            <Select
              label="Plumbing / electrical changes"
              value={input.plumbingElectrical}
              onChange={e => set("plumbingElectrical", e.target.value as PlumbingElec)}
            >
              {(Object.entries(PLUMBING_LABELS) as [PlumbingElec, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            <Toggle
              label="Client provides cabinets / materials"
              checked={input.clientProvidesMaterials}
              onChange={v => set("clientProvidesMaterials", v)}
            />

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

            {input.plumbingElectrical === "relocate" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
                ⚠️ Plumbing / electrical relocation requires licensed professionals and may require permits.
              </div>
            )}

            {input.appliances === "premium_appliances" && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-950/40 px-4 py-3 text-xs text-blue-200">
                ℹ️ Premium appliances: confirm space dimensions and dedicated circuits before ordering cabinets.
              </div>
            )}

            <Button onClick={calculate} disabled={loading} className="w-full">
              {loading ? "Calculating…" : "Calculate kitchen estimate"}
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
