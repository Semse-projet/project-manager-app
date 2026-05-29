"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, CheckCircle2, ClipboardList, FileText, Hammer, ShieldAlert } from "lucide-react";
import { Badge, Card, MetricCard } from "@/components/ui";
import type { SemseToolResult } from "@/app/lib/semse-tools-api";
import { createBuildOpsProjectFromToolResult } from "@/app/lib/buildops-api";
import { SemseIntelligencePanel } from "@/components/tools/SemseIntelligencePanel";
import { ToolAIPanel } from "@/components/tools/ToolAIPanel";

const RISK_LABELS: Record<SemseToolResult["risk"]["level"], string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  critical: "Critical risk",
};

const RISK_VARIANTS: Record<SemseToolResult["risk"]["level"], "default" | "info" | "warn" | "error" | "brand"> = {
  low: "default",
  medium: "info",
  high: "warn",
  critical: "error",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <MetricCard label={label} value={value} sub={sub} className="min-h-[112px]" />
  );
}

export function ToolResultPanel({ result }: { result: SemseToolResult }) {
  const riskVariant = RISK_VARIANTS[result.risk.level];
  const safetyCritical = result.trade === "electrical" || result.risk.level === "critical";
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSaveToBuildOps() {
    setSaving(true);
    setSaveError(null);

    try {
      const project = await createBuildOpsProjectFromToolResult({
        sourceTool: result.toolId,
        sourceToolInput: result.inputs,
        sourceToolResult: result,
        title: `${result.projectType} estimate`,
        trade: result.trade,
        projectType: result.projectType,
        clientName: "Client",
        location: "TBD",
      });
      setSavedProjectId(project.id);
      router.push(`/buildops/projects/${project.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar en BuildOps.");
    } finally {
      setSaving(false);
    }
  }

  // Show Intelligence Panel when extended metrics are present (Algorithm Engine v2+)
  const hasExtended = !!(
    (result as any).confidenceScore ||
    (result as any).priceBands ||
    (result as any).safeToProceed
  );

  return (
    <div className="grid gap-6">
      {/* SEMSE Intelligence Panel — shown for all v2 engines */}
      {hasExtended && (
        <SemseIntelligencePanel result={result} />
      )}

      <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={riskVariant}>{RISK_LABELS[result.risk.level]}</Badge>
              {safetyCritical ? <Badge variant="error">Safety critical</Badge> : null}
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-ink">
              {result.projectType}
            </h3>
            <p className="text-sm text-muted">
              {result.trade} · {result.mode} · {result.isValid ? "valid input" : "validation issues detected"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Total estimate</p>
            <p className="text-3xl font-bold text-brand">{formatCurrency(result.costs.total)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveToBuildOps()}
            disabled={saving}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save to BuildOps"}
          </button>
          {savedProjectId ? <Badge variant="info">Saved: {savedProjectId}</Badge> : null}
          {saveError ? <span className="text-sm text-rose-300">{saveError}</span> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Materials" value={formatCurrency(result.costs.materials)} />
          <Metric label="Labor" value={formatCurrency(result.costs.labor)} />
          <Metric label="Risk score" value={`${result.risk.score}/100`} sub="SEMSE risk engine" />
          <Metric
            label="Deposit / escrow"
            value={formatCurrency(result.costs.total * 0.35)}
            sub="Approximate starting point"
          />
        </div>
      </Card>

      {result.validationIssues.length > 0 && (
        <Card className="grid gap-3 border-amber-500/20 bg-amber-500/[0.05]">
          <SectionTitle
            icon={<ShieldAlert size={18} />}
            title="Validation issues"
            description="The engine returned validation warnings or errors that should be reviewed."
          />
          <ul className="grid gap-2 text-sm text-amber-100">
            {result.validationIssues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`} className="rounded-lg border border-amber-500/20 bg-black/10 px-3 py-2">
                <span className="font-semibold uppercase tracking-wide">{issue.severity}</span>
                {" · "}
                <span>{issue.field}</span>
                {" — "}
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="grid gap-4">
        <SectionTitle
          icon={<Hammer size={18} />}
          title="Materials"
          description="A deterministic material takeoff generated by the tools engine."
        />
        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-4 py-3 text-left font-medium">Qty</th>
                <th className="px-4 py-3 text-left font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {result.materials.map((item) => (
                <tr key={`${item.name}-${item.category}`} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{item.name}</div>
                    <div className="text-xs text-muted">{item.category}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-ink">{formatCurrency(item.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="grid gap-4">
        <SectionTitle
          icon={<ClipboardList size={18} />}
          title="Milestones"
          description="Suggested payment checkpoints suitable for escrow and release control."
        />
        <div className="grid gap-3">
          {result.milestones.map((milestone) => (
            <div key={`${milestone.sequence}-${milestone.title}`} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {milestone.sequence}. {milestone.title}
                  </div>
                  <div className="text-sm text-muted">{milestone.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-brand">{milestone.percentage}%</div>
                  <div className="text-xs text-muted">{formatCurrency(milestone.amount)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {milestone.evidenceRequired.map((item) => (
                  <Badge key={item} variant="info">
                    {item}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">{milestone.releaseTrigger}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="grid gap-4">
        <SectionTitle
          icon={<FileText size={18} />}
          title="Evidence checklist"
          description="Artifacts the field team should capture before release."
        />
        <div className="grid gap-2 md:grid-cols-2">
          {result.evidenceRequired.map((item) => (
            <div key={`${item.type}-${item.description}`} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="mt-0.5 text-brand">
                {item.required ? <BadgeCheck size={16} /> : <CheckCircle2 size={16} />}
              </div>
              <div>
                <div className="text-sm font-medium text-ink">{item.description}</div>
                <div className="text-xs uppercase tracking-wide text-muted">
                  {item.type}{item.milestone ? ` · milestone ${item.milestone}` : ""}
                  {item.required ? " · required" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {(result.warnings.length > 0 || result.recommendations.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {result.warnings.length > 0 && (
            <Card className="grid gap-3 border-amber-500/20 bg-amber-500/[0.05]">
              <SectionTitle
                icon={<AlertTriangle size={18} />}
                title="Warnings"
                description="Operational alerts from the engine."
              />
              <ul className="grid gap-2 text-sm text-amber-100">
                {result.warnings.map((warning) => (
                  <li key={warning} className="rounded-lg border border-amber-500/20 bg-black/10 px-3 py-2">
                    {warning}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result.recommendations.length > 0 && (
            <Card className="grid gap-3 border-emerald-500/20 bg-emerald-500/[0.05]">
              <SectionTitle
                icon={<BadgeCheck size={18} />}
                title="Recommendations"
                description="Suggested operational follow-up."
              />
              <ul className="grid gap-2 text-sm text-emerald-100">
                {result.recommendations.map((recommendation) => (
                  <li key={recommendation} className="rounded-lg border border-emerald-500/20 bg-black/10 px-3 py-2">
                    {recommendation}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* AI Assistant — Ollama-powered, available for all tools */}
      <ToolAIPanel result={result} />
    </div>
  );
}
