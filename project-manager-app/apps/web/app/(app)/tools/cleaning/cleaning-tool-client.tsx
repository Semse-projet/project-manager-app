"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Calculator } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type ServiceType   = "standard" | "deep" | "move_inout" | "post_construction" | "commercial";
type Condition     = "light" | "moderate" | "heavy" | "post_construction";
type Frequency     = "one_time" | "weekly" | "biweekly" | "monthly";
type AddOn         = "windows" | "carpet" | "disinfection" | "laundry" | "oven" | "fridge" | "extras";

type CleaningInput = {
  serviceType: ServiceType;
  squareFt: number;
  bedrooms: number;
  bathrooms: number;
  condition: Condition;
  addOns: AddOn[];
  frequency: Frequency;
  suppliesIncluded: boolean;
  mode: ToolMode;
};

const INITIAL: CleaningInput = {
  serviceType: "deep",
  squareFt: 1200,
  bedrooms: 3,
  bathrooms: 2,
  condition: "moderate",
  addOns: [],
  frequency: "one_time",
  suppliesIncluded: true,
  mode: "professional",
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  standard:          "Standard / maintenance",
  deep:              "Deep cleaning",
  move_inout:        "Move-in / move-out",
  post_construction: "Post-construction",
  commercial:        "Commercial / office",
};

const CONDITION_LABELS: Record<Condition, string> = {
  light:             "Light — recently cleaned",
  moderate:          "Moderate — normal use",
  heavy:             "Heavy — neglected / messy",
  post_construction: "Post-construction dust",
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  one_time: "One time only",
  weekly:   "Weekly (−20%)",
  biweekly: "Bi-weekly (−15%)",
  monthly:  "Monthly (−10%)",
};

const ADDON_LABELS: Record<AddOn, string> = {
  windows:      "Window cleaning",
  carpet:       "Carpet cleaning",
  disinfection: "Disinfection",
  laundry:      "Laundry",
  oven:         "Inside oven",
  fridge:       "Inside fridge",
  extras:       "Additional extras",
};

function NumberField({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <Input
      label={label}
      type="number"
      min={min}
      value={value}
      onChange={e => onChange(Math.max(min, Number(e.target.value)))}
    />
  );
}

export function CleaningToolClient() {
  const [input, setInput] = useState<CleaningInput>(INITIAL);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const res = await calculateSemseTool({ tool: "cleaning", mode: input.mode, input });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error calculating cleaning estimate");
    } finally {
      setLoading(false);
    }
  }

  const set = <K extends keyof CleaningInput>(key: K, value: CleaningInput[K]) =>
    setInput(prev => ({ ...prev, [key]: value }));

  function toggleAddOn(ao: AddOn) {
    setInput(prev => ({
      ...prev,
      addOns: prev.addOns.includes(ao)
        ? prev.addOns.filter(a => a !== ao)
        : [...prev.addOns, ao],
    }));
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

        <section className="grid gap-3">
          <div className="flex items-center gap-3">
            <Sparkles size={28} className="text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Cleaning Service Tool</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Estimate crew size, hours, supplies, risk, milestones and evidence for residential,
            commercial, post-construction and move-out cleaning services.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Calculator size={16} /> Inputs
            </div>

            {/* Service type */}
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Service type</label>
              <div className="grid gap-2">
                {(Object.keys(SERVICE_LABELS) as ServiceType[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      set("serviceType", s);
                      if (s === "post_construction") set("condition", "post_construction");
                    }}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      input.serviceType === s
                        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                        : "border-white/[0.08] bg-white/[0.02] text-ink hover:border-white/[0.14]"
                    }`}
                  >
                    {SERVICE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Area */}
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Sqft" value={input.squareFt} onChange={v => set("squareFt", v)} min={100} />
              <NumberField label="Bedrooms" value={input.bedrooms} onChange={v => set("bedrooms", v)} />
              <NumberField label="Bathrooms" value={input.bathrooms} onChange={v => set("bathrooms", v)} />
            </div>

            {/* Condition */}
            <Select
              label="Surface condition"
              value={input.condition}
              onChange={e => set("condition", e.target.value as Condition)}
            >
              {(Object.entries(CONDITION_LABELS) as [Condition, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Frequency */}
            <Select
              label="Frequency"
              value={input.frequency}
              onChange={e => set("frequency", e.target.value as Frequency)}
            >
              {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Add-ons */}
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Add-on services</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ADDON_LABELS) as AddOn[]).map(ao => (
                  <button
                    key={ao}
                    type="button"
                    onClick={() => toggleAddOn(ao)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                      input.addOns.includes(ao)
                        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                        : "border-white/[0.08] bg-white/[0.02] text-muted hover:border-white/[0.14] hover:text-ink"
                    }`}
                  >
                    {ADDON_LABELS[ao]}
                  </button>
                ))}
              </div>
            </div>

            {/* Supplies */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:border-white/[0.14]">
              <input
                type="checkbox"
                checked={input.suppliesIncluded}
                onChange={e => set("suppliesIncluded", e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
              <span className="text-sm text-ink">Professional provides supplies</span>
            </label>

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

            {input.condition === "post_construction" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
                ⚠️ Post-construction: fine dust returns after first pass. Plan at least 2 cleaning sessions for best results.
              </div>
            )}

            {input.condition === "heavy" && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-950/40 px-4 py-3 text-xs text-orange-200">
                ⚠️ Heavy condition: final price may adjust after on-site inspection. Consider a preliminary visit.
              </div>
            )}

            <Button onClick={calculate} disabled={loading} className="w-full">
              {loading ? "Calculating…" : "Calculate cleaning estimate"}
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
