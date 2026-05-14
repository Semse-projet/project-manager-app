"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Home, Calculator, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type SidingMaterial = "vinyl" | "insulated_vinyl" | "fiber_cement" | "wood" | "engineered_wood" | "metal";
type FlashingCondition = "good" | "poor" | "unknown";
type Stories = 1 | 2 | 3;

type SidingInput = {
  wallSqFt: number;
  stories: Stories;
  sidingType: SidingMaterial;
  removeOldSiding: boolean;
  windowCount: number;
  doorCount: number;
  corners: number;
  visibleWaterDamage: boolean;
  houseWrapIncluded: boolean;
  flashingCondition: FlashingCondition;
  soffitFasciaIncluded: boolean;
  clientProvidesMaterials: boolean;
  mode: ToolMode;
};

const INITIAL: SidingInput = {
  wallSqFt: 1800, stories: 1, sidingType: "vinyl",
  removeOldSiding: false, windowCount: 8, doorCount: 2,
  corners: 4, visibleWaterDamage: false, houseWrapIncluded: true,
  flashingCondition: "good", soffitFasciaIncluded: false,
  clientProvidesMaterials: false, mode: "professional",
};

const MATERIAL_LABELS: Record<SidingMaterial, string> = {
  vinyl:           "Vinyl siding",
  insulated_vinyl: "Insulated vinyl",
  fiber_cement:    "Fiber cement (Hardie)",
  wood:            "Wood siding",
  engineered_wood: "Engineered wood",
  metal:           "Metal / aluminum",
};

const FLASHING_LABELS: Record<FlashingCondition, string> = {
  good:    "Good condition",
  poor:    "Poor / failing",
  unknown: "Unknown — not inspected",
};

function Toggle({ label, subtitle, checked, onChange }: { label: string; subtitle?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${checked ? "border-cyan-400/50 bg-cyan-400/8" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]"}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-400 flex-shrink-0" />
      <div>
        <div className="text-sm text-ink">{label}</div>
        {subtitle && <div className="text-xs text-muted mt-0.5">{subtitle}</div>}
      </div>
    </label>
  );
}

function NumberField({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <Input label={label} type="number" min={min} value={value}
      onChange={e => onChange(Math.max(min, Number(e.target.value)))} />
  );
}

// Intelligence badges derived from the result
function IntelligenceBar({ result }: { result: SemseToolResult }) {
  const confidence  = (result as any).confidenceScore;
  const readiness   = (result as any).readinessScore;
  const disputeRisk = (result as any).disputeRisk;
  const safeTo      = (result as any).safeToProceed;

  if (!confidence) return null;

  const riskColor = result.risk.level === "critical" ? "text-red-400 border-red-500/40" :
                    result.risk.level === "high"     ? "text-orange-400 border-orange-500/40" :
                    result.risk.level === "medium"   ? "text-yellow-400 border-yellow-500/40" :
                                                       "text-green-400 border-green-500/40";

  const confColor = confidence.level === "high"   ? "text-green-400" :
                    confidence.level === "medium"  ? "text-yellow-400" : "text-red-400";

  return (
    <div className="grid gap-3">
      {/* SEMSE Intelligence Panel */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">SEMSE Intelligence</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={`rounded-lg border p-3 text-center ${riskColor}`}>
            <div className="text-lg font-bold">{result.risk.score}</div>
            <div className="text-xs opacity-70">Risk Score</div>
            <div className="text-xs font-semibold mt-0.5">{result.risk.level.toUpperCase()}</div>
          </div>
          <div className={`rounded-lg border border-white/[0.08] p-3 text-center ${confColor}`}>
            <div className="text-lg font-bold">{confidence.score}</div>
            <div className="text-xs opacity-70">Confidence</div>
            <div className="text-xs font-semibold mt-0.5">{confidence.level.toUpperCase()}</div>
          </div>
          <div className="rounded-lg border border-white/[0.08] p-3 text-center text-slate-300">
            <div className="text-lg font-bold">{readiness?.score ?? "—"}</div>
            <div className="text-xs opacity-70">Readiness</div>
            <div className="text-xs font-semibold mt-0.5">{readiness?.level?.toUpperCase() ?? "N/A"}</div>
          </div>
          <div className="rounded-lg border border-white/[0.08] p-3 text-center text-slate-300">
            <div className="text-lg font-bold">{disputeRisk?.score ?? "—"}</div>
            <div className="text-xs opacity-70">Dispute Risk</div>
            <div className="text-xs font-semibold mt-0.5">{disputeRisk?.level?.toUpperCase() ?? "N/A"}</div>
          </div>
        </div>

        {/* Safe to proceed gates */}
        {safeTo && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Estimate", ok: safeTo.canEstimate },
              { label: "Publish", ok: safeTo.canPublish },
              { label: "BuildOps", ok: safeTo.canCreateBuildOpsPlan },
              { label: "Contract", ok: safeTo.canCreateContract },
            ].map(({ label, ok }) => (
              <div key={label} className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${ok ? "bg-green-950/40 text-green-400" : "bg-red-950/40 text-red-400"}`}>
                <span>{ok ? "✓" : "✗"}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Price bands */}
      {(result as any).priceBands && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Price Bands</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/[0.03] p-2">
              <div className="text-sm font-bold text-slate-400">${(result as any).priceBands.low.toLocaleString()}</div>
              <div className="text-xs text-muted">Low</div>
            </div>
            <div className="rounded-lg bg-cyan-950/30 border border-cyan-500/20 p-2">
              <div className="text-sm font-bold text-cyan-300">${(result as any).priceBands.mid.toLocaleString()}</div>
              <div className="text-xs text-cyan-400/70">Recommended</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2">
              <div className="text-sm font-bold text-slate-400">${(result as any).priceBands.high.toLocaleString()}</div>
              <div className="text-xs text-muted">High</div>
            </div>
          </div>
        </div>
      )}

      {/* Risk reasons */}
      {(result.risk.reasons ?? []).length > 0 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">Risk factors</span>
          </div>
          <ul className="space-y-1">
            {(result.risk.reasons ?? []).map((rn: string, i: number) => (
              <li key={i} className="text-xs text-orange-200 flex gap-2"><span className="opacity-50">·</span>{rn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SidingToolClient() {
  const [input, setInput] = useState<SidingInput>(INITIAL);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true); setError(null);
    try {
      const res = await calculateSemseTool({ tool: "siding", mode: input.mode, input });
      setResult(res);
    } catch (e) { setError(e instanceof Error ? e.message : "Error calculating siding estimate"); }
    finally { setLoading(false); }
  }

  const set = <K extends keyof SidingInput>(key: K, value: SidingInput[K]) =>
    setInput(prev => ({ ...prev, [key]: value }));

  const riskIsHigh = result && (result.risk.level === "high" || result.risk.level === "critical");

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
            <Home size={28} className="text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Siding Installation Tool</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Exterior siding estimator with hidden damage detection, inspection gates, flashing risk scoring,
            change order prediction and evidence-based payment milestones.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Calculator size={16} /> Inputs
            </div>

            {/* Area + stories */}
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Wall sq ft" value={input.wallSqFt} onChange={v => set("wallSqFt", v)} min={100} />
              <Select label="Stories" value={input.stories} onChange={e => set("stories", Number(e.target.value) as Stories)}>
                <option value={1}>1 story</option>
                <option value={2}>2 stories</option>
                <option value={3}>3 stories</option>
              </Select>
            </div>

            {/* Material */}
            <Select label="Siding material" value={input.sidingType} onChange={e => set("sidingType", e.target.value as SidingMaterial)}>
              {(Object.entries(MATERIAL_LABELS) as [SidingMaterial, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Openings */}
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Windows"  value={input.windowCount} onChange={v => set("windowCount", v)} />
              <NumberField label="Doors"    value={input.doorCount}   onChange={v => set("doorCount", v)} />
              <NumberField label="Corners"  value={input.corners}     onChange={v => set("corners", v)} />
            </div>

            {/* Flashing */}
            <Select label="Existing flashing condition" value={input.flashingCondition}
              onChange={e => set("flashingCondition", e.target.value as FlashingCondition)}>
              {(Object.entries(FLASHING_LABELS) as [FlashingCondition, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>

            {/* Toggles */}
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Scope options</label>
              <Toggle label="Remove old siding" subtitle="Creates mandatory inspection gate"
                checked={input.removeOldSiding} onChange={v => set("removeOldSiding", v)} />
              <Toggle label="House wrap / weather barrier included"
                checked={input.houseWrapIncluded} onChange={v => set("houseWrapIncluded", v)} />
              <Toggle label="Soffit & fascia included"
                checked={input.soffitFasciaIncluded} onChange={v => set("soffitFasciaIncluded", v)} />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Risk conditions</label>
              <Toggle label="Visible water damage" subtitle="Raises risk — hidden damage allowance added"
                checked={input.visibleWaterDamage} onChange={v => set("visibleWaterDamage", v)} />
              <Toggle label="Client provides materials" subtitle="Reduces estimate confidence"
                checked={input.clientProvidesMaterials} onChange={v => set("clientProvidesMaterials", v)} />
            </div>

            {/* Mode */}
            <Select label="Calculation mode" value={input.mode} onChange={e => set("mode", e.target.value as ToolMode)}>
              <option value="client">Client</option>
              <option value="professional">Professional</option>
              <option value="admin">Admin</option>
            </Select>

            {/* Contextual warnings */}
            {input.flashingCondition === "unknown" && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/30 px-4 py-3 text-xs text-yellow-200">
                ⚠️ Unknown flashing condition: verify before installing. May require change order.
              </div>
            )}
            {input.visibleWaterDamage && input.removeOldSiding && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-200">
                🔴 High risk: visible water damage + removal required. Inspection gate + change order protection strongly recommended.
              </div>
            )}
            {input.sidingType === "fiber_cement" && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-950/30 px-4 py-3 text-xs text-blue-200">
                ℹ️ Fiber cement requires paint finish — budget separately. Schedule within same project window.
              </div>
            )}

            <Button onClick={calculate} disabled={loading} className="w-full">
              {loading ? "Calculating…" : "Calculate siding estimate"}
            </Button>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>
            )}
          </Card>

          <div className="grid gap-4 self-start">
            {result && (
              <>
                <IntelligenceBar result={result} />
                <ToolResultPanel result={result} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
