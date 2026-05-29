"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, ThermometerSnowflake } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

type HvacSystemType = "central-ac" | "heat-pump" | "mini-split" | "furnace-only" | "package-unit";
type DuctworkScope  = "none" | "partial" | "full-replace" | "new-install";
type RefrigerantType = "R-410A" | "R-32" | "R-22" | "R-454B";

type HvacInput = {
  tonnage: number;
  systemType: HvacSystemType;
  seerRating: number;
  ductworkScope: DuctworkScope;
  ductRunFeet: number;
  zoneCount: number;
  atticInstall: boolean;
  crawlspaceInstall: boolean;
  existingEquipmentAge: number;
  refrigerantType: RefrigerantType;
  thermostatUpgrade: boolean;
  airQualityUpgrade: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: HvacInput = {
  tonnage: 3,
  systemType: "heat-pump",
  seerRating: 16,
  ductworkScope: "partial",
  ductRunFeet: 90,
  zoneCount: 1,
  atticInstall: false,
  crawlspaceInstall: false,
  existingEquipmentAge: 12,
  refrigerantType: "R-410A",
  thermostatUpgrade: true,
  airQualityUpgrade: false,
  mode: "professional",
};

function NumberField({ label, value, onChange, hint, min, step }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; min?: number; step?: number;
}) {
  return (
    <Input label={label} type="number" min={min ?? 0} step={step ?? 1}
      value={value} onChange={(e) => onChange(Number(e.target.value))} hint={hint} />
  );
}

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

export function HvacToolClient() {
  const [input, setInput] = useState<HvacInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof HvacInput>(k: K, v: HvacInput[K]) {
    setInput((cur) => ({ ...cur, [k]: v }));
  }

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await calculateSemseTool({ tool: "hvac", mode: input.mode, input }));
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">HVAC Estimator</h1>
          <p className="max-w-3xl text-sm text-muted">
            Full HVAC replacement and new-install estimates with SEER premium, ductwork scope, zoning, refrigerant type, confidence scoring, and AI assistant.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
          <Card className="grid gap-5 self-start">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                <Calculator size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">System specs</h2>
                <p className="text-sm text-muted">Manual J load calc recommended for final sizing.</p>
              </div>
            </div>

            <div className="grid gap-4">
              {/* System type */}
              <Select label="System type" value={input.systemType}
                onChange={(e) => set("systemType", e.target.value as HvacSystemType)}>
                <option value="central-ac">Central A/C</option>
                <option value="heat-pump">Heat pump</option>
                <option value="mini-split">Mini-split (ductless)</option>
                <option value="furnace-only">Furnace only</option>
                <option value="package-unit">Package unit</option>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Tonnage" value={input.tonnage} min={0.5} step={0.5}
                  onChange={(v) => set("tonnage", v)} hint="1–20 tons" />
                <NumberField label="SEER rating" value={input.seerRating} min={13} step={1}
                  onChange={(v) => set("seerRating", v)} hint="14–26" />
              </div>

              {/* Refrigerant */}
              <Select label="Refrigerant type" value={input.refrigerantType}
                onChange={(e) => set("refrigerantType", e.target.value as RefrigerantType)}>
                <option value="R-454B">R-454B (new standard 2025+)</option>
                <option value="R-410A">R-410A (current standard)</option>
                <option value="R-32">R-32</option>
                <option value="R-22">R-22 (phased out — expensive)</option>
              </Select>

              {/* Ductwork */}
              <Select label="Ductwork scope" value={input.ductworkScope}
                onChange={(e) => set("ductworkScope", e.target.value as DuctworkScope)}>
                <option value="none">None (use existing)</option>
                <option value="partial">Partial repair/extend</option>
                <option value="full-replace">Full replacement</option>
                <option value="new-install">New install (no ducts exist)</option>
              </Select>

              {input.ductworkScope !== "none" && (
                <NumberField label="Duct run (ft)" value={input.ductRunFeet}
                  onChange={(v) => set("ductRunFeet", v)} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Zones" value={input.zoneCount} min={1}
                  onChange={(v) => set("zoneCount", v)} />
                <NumberField label="Existing equip age (yrs)" value={input.existingEquipmentAge}
                  onChange={(v) => set("existingEquipmentAge", v)} />
              </div>

              {/* Access */}
              <Toggle label="Attic installation" checked={input.atticInstall}
                onChange={(v) => set("atticInstall", v)} hint="Requires staging and fall protection" />
              <Toggle label="Crawlspace installation" checked={input.crawlspaceInstall}
                onChange={(v) => set("crawlspaceInstall", v)} />
              <Toggle label="Smart thermostat upgrade" checked={input.thermostatUpgrade}
                onChange={(v) => set("thermostatUpgrade", v)} />
              <Toggle label="Air quality upgrade (UV/purifier)" checked={input.airQualityUpgrade}
                onChange={(v) => set("airQualityUpgrade", v)} />

              <Select label="Mode" value={input.mode}
                onChange={(e) => set("mode", e.target.value as ToolMode)}>
                <option value="client">Client</option>
                <option value="professional">Professional</option>
                <option value="admin">Admin</option>
              </Select>
            </div>

            {input.refrigerantType === "R-22" && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                ⚠ R-22 is phased out. Refrigerant costs are 3× higher and availability is limited. Verify before pricing.
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
            )}

            <Button onClick={() => void calculate()} loading={loading} className="w-full">
              {loading ? "Calculating..." : "Calculate HVAC estimate"}
            </Button>
          </Card>

          <div className="grid gap-6">
            {result ? (
              <ToolResultPanel result={result} />
            ) : (
              <Card className="grid min-h-[420px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                <div className="grid gap-3 p-8">
                  <div className="mx-auto rounded-full border border-brand/20 bg-brand/[0.08] p-4 text-brand">
                    <ThermometerSnowflake size={24} />
                  </div>
                  <h2 className="text-xl font-semibold text-ink">Ready to calculate</h2>
                  <p className="max-w-xl text-sm text-muted">
                    Configure system specs on the left to generate a full HVAC estimate with confidence scoring, scope, price bands, and AI assistant.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="brand">Equipment</Badge>
                    <Badge variant="info">Ductwork</Badge>
                    <Badge variant="warn">Zoning</Badge>
                    <Badge variant="success">Commissioning</Badge>
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
