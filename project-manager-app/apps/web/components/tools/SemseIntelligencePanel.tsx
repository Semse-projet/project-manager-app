"use client";

/**
 * SEMSE Intelligence Panel — reusable across all ProTools.
 *
 * Constitution principle: "user must see where they are, what's missing,
 * what's next, what's approved, what's blocked, what has risk, what impacts money."
 *
 * Shows: risk score, confidence, readiness, dispute risk, price bands,
 * safe-to-proceed gates, scope summary, warnings, and algorithm version.
 */

import { AlertTriangle, Calendar, CheckCircle, Clock, DollarSign, Info, Lightbulb, TrendingUp, XCircle, Zap } from "lucide-react";
import type { SemseToolResult } from "@/app/lib/semse-tools-api";

type ExtendedResult = SemseToolResult & {
  confidenceScore?:       { score: number; level: string; missingFactors?: string[] };
  readinessScore?:        { score: number; level: string; blockers?: string[] };
  disputeRisk?:           { score: number; level: string; reasons?: string[]; mitigations?: string[] };
  priceBands?:            { low: number; mid: number; high: number; currency: string; notes?: { low: string; mid: string; high: string } };
  safeToProceed?:         { canEstimate: boolean; canPublish: boolean; canCreateBuildOpsPlan: boolean; canCreateContract: boolean; canRequestPayment: boolean; reasons?: string[] };
  scope?:                 { included?: string[]; excluded?: string[]; assumptions?: string[]; changeOrderTriggers?: string[] };
  explained?:             { clientSummary?: string; professionalNotes?: string[] };
  algorithmTrace?:        { algorithmVersion?: string; rulesTriggered?: Array<{ label: string; reason: string; points?: number }> };
  recurringPricing?:      { oneTimePrice: number; options: Array<{ frequency: string; label: string; pricePerVisit: number; discountPercent: number; monthlyValue: number }> };
  taskMatrix?:            { tasks: Array<{ task: string; phase: string; required: boolean }>; complexity: string };
  inspectionGate?:        { required: boolean; trigger: string; description: string; evidenceRequired: string[] };
  productionSchedule?:    { totalDaysMin: number; totalDaysMax: number; crewSizeRecommended: number; phases: Array<{ name: string; daysMin: number; daysMax: number; crew: number; description: string }> };
  scheduleRisk?:          { delayProbability: string; bufferDaysRecommended: number; delayFactors: string[] };
  hiddenDamageAssessment?:{ probability: string; score: number; drivers: string[]; recommendation: string };
  upsells?:               Array<{ service: string; reason: string; additionalCostRange?: { min: number; max: number } }>;
  roi?:                   { investmentAmount: number; estimatedValueAdded: number; roiPercent: number; notes: string };
};

function RiskBadge({ level, score }: { level: string; score: number }) {
  const colors = {
    critical: "border-red-500/50 bg-red-950/40 text-red-300",
    high:     "border-orange-500/40 bg-orange-950/30 text-orange-300",
    medium:   "border-yellow-500/40 bg-yellow-950/30 text-yellow-300",
    low:      "border-green-500/40 bg-green-950/30 text-green-300",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${colors[level as keyof typeof colors] ?? colors.medium}`}>
      <div className="text-lg font-bold">{score}</div>
      <div className="text-xs opacity-70">Risk</div>
      <div className="text-xs font-semibold">{level.toUpperCase()}</div>
    </div>
  );
}

function ScoreBadge({ label, score, level }: { label: string; score: number; level?: string }) {
  const color = score >= 75 ? "text-green-400" : score >= 45 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-center">
      <div className={`text-lg font-bold ${color}`}>{score}</div>
      <div className="text-xs text-muted">{label}</div>
      {level && <div className={`text-xs font-semibold ${color}`}>{level.toUpperCase()}</div>}
    </div>
  );
}

function GateBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${ok ? "bg-green-950/40 text-green-400" : "bg-slate-900 text-slate-500"}`}>
      {ok ? <CheckCircle size={10} /> : <XCircle size={10} />}
      <span>{label}</span>
    </div>
  );
}

export function SemseIntelligencePanel({ result, className = "" }: { result: SemseToolResult; className?: string }) {
  const r = result as ExtendedResult;
  const hasExtended = !!(r.confidenceScore || r.priceBands || r.safeToProceed);
  if (!hasExtended) return null;

  return (
    <div className={`grid gap-3 ${className}`}>
      {/* Intelligence header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
          SEMSE Intelligence
          {r.algorithmTrace?.algorithmVersion && (
            <span className="ml-2 text-slate-600 normal-case tracking-normal">v{r.algorithmTrace.algorithmVersion.split("-v")[1]}</span>
          )}
        </span>
      </div>

      {/* 4-metric row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <RiskBadge level={r.risk.level} score={r.risk.score} />
        {r.confidenceScore && <ScoreBadge label="Confidence" score={r.confidenceScore.score} level={r.confidenceScore.level} />}
        {r.readinessScore  && <ScoreBadge label="Readiness"  score={r.readinessScore.score}  level={r.readinessScore.level} />}
        {r.disputeRisk     && <ScoreBadge label="Dispute Risk" score={r.disputeRisk.score}  level={r.disputeRisk.level} />}
      </div>

      {/* Safe-to-proceed gates */}
      {r.safeToProceed && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GateBadge label="Estimate"  ok={r.safeToProceed.canEstimate} />
          <GateBadge label="Publish"   ok={r.safeToProceed.canPublish} />
          <GateBadge label="BuildOps"  ok={r.safeToProceed.canCreateBuildOpsPlan} />
          <GateBadge label="Contract"  ok={r.safeToProceed.canCreateContract} />
        </div>
      )}

      {/* Price bands */}
      {r.priceBands && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="text-xs text-muted mb-2">Price range</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-white/[0.02] p-2">
              <div className="text-sm font-bold text-slate-400">${r.priceBands.low.toLocaleString()}</div>
              <div className="text-xs text-muted">Low</div>
            </div>
            <div className="rounded border border-cyan-500/20 bg-cyan-950/20 p-2">
              <div className="text-sm font-bold text-cyan-300">${r.priceBands.mid.toLocaleString()}</div>
              <div className="text-xs text-cyan-400/70">Recommended</div>
            </div>
            <div className="rounded bg-white/[0.02] p-2">
              <div className="text-sm font-bold text-slate-400">${r.priceBands.high.toLocaleString()}</div>
              <div className="text-xs text-muted">High</div>
            </div>
          </div>
        </div>
      )}

      {/* Client summary */}
      {r.explained?.clientSummary && (
        <div className="rounded-xl border border-blue-500/15 bg-blue-950/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Info size={12} className="text-blue-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-400">Summary</span>
          </div>
          <p className="text-xs text-blue-100 leading-relaxed">{r.explained.clientSummary}</p>
        </div>
      )}

      {/* Risk factors */}
      {(r.risk.reasons ?? []).length > 0 && (
        <div className="rounded-xl border border-orange-500/15 bg-orange-950/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={12} className="text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">Risk factors</span>
          </div>
          <ul className="space-y-0.5">
            {(r.risk.reasons ?? []).map((reason: string, i: number) => (
              <li key={i} className="text-xs text-orange-200 flex gap-1.5">
                <span className="opacity-40 flex-shrink-0">·</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Inspection gate */}
      {r.inspectionGate?.required && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-xs font-semibold text-red-400">Inspection gate required</span>
          </div>
          <p className="text-xs text-red-200">{r.inspectionGate.description}</p>
          {r.inspectionGate.evidenceRequired.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {r.inspectionGate.evidenceRequired.map((ev, i) => (
                <li key={i} className="text-xs text-red-300 flex gap-1.5">
                  <span className="opacity-50">□</span>{ev}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Scope: included + excluded */}
      {r.scope && (r.scope.included?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-green-400 mb-1.5">Included</div>
            <ul className="space-y-0.5">
              {(r.scope.included ?? []).map((item, i) => (
                <li key={i} className="text-xs text-slate-300 flex gap-1.5">
                  <span className="text-green-500 flex-shrink-0">✓</span>{item}
                </li>
              ))}
            </ul>
          </div>
          {(r.scope.excluded ?? []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1.5">Not included</div>
              <ul className="space-y-0.5">
                {(r.scope.excluded ?? []).slice(0, 6).map((item, i) => (
                  <li key={i} className="text-xs text-slate-500 flex gap-1.5">
                    <span className="flex-shrink-0">✗</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recurring pricing (cleaning) */}
      {r.recurringPricing && r.recurringPricing.options.length > 0 && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-3">
          <div className="text-xs font-semibold text-purple-400 mb-2">Recurring pricing options</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {r.recurringPricing.options.map(opt => (
              <div key={opt.frequency} className="rounded bg-white/[0.02] border border-white/[0.06] p-2 text-center">
                <div className="text-sm font-bold text-slate-300">${opt.pricePerVisit}</div>
                <div className="text-xs text-muted">{opt.label.replace(" service", "")}</div>
                <div className="text-xs text-purple-400">−{opt.discountPercent}%</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-purple-300/70 mt-2">{r.recurringPricing.options[0]?.frequency && `Save up to ${r.recurringPricing.options[0]?.discountPercent}% vs one-time pricing.`}</p>
        </div>
      )}

      {/* Task matrix (cleaning, demolition) */}
      {r.taskMatrix && r.taskMatrix.tasks.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="text-xs font-semibold text-slate-400 mb-2">
            Task checklist <span className="text-slate-600 font-normal">({r.taskMatrix.complexity})</span>
          </div>
          <ul className="space-y-0.5">
            {r.taskMatrix.tasks.map((t, i) => (
              <li key={i} className="text-xs text-slate-300 flex gap-2 items-start">
                <span className="text-slate-600 flex-shrink-0 mt-0.5">□</span>
                <span>{t.task}</span>
                {(t as any).evidenceRequired && <span className="text-xs text-yellow-600 flex-shrink-0">📷</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Professional notes */}
      {(r.explained?.professionalNotes ?? []).length > 0 && (
        <details className="rounded-xl border border-white/[0.06]">
          <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-300">
            Professional notes ↓
          </summary>
          <ul className="px-4 pb-3 space-y-1">
            {(r.explained!.professionalNotes!).map((note, i) => (
              <li key={i} className="text-xs text-slate-400 flex gap-2">
                <span className="opacity-40 flex-shrink-0">·</span>{note}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Production schedule */}
      {r.productionSchedule && (r.productionSchedule.phases ?? []).length > 0 && (
        <details className="rounded-xl border border-white/[0.06]">
          <summary className="cursor-pointer px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Calendar size={14} className="text-brand" />
              Production schedule
            </div>
            <span className="text-xs text-slate-500">
              {r.productionSchedule.totalDaysMin}–{r.productionSchedule.totalDaysMax} days · {r.productionSchedule.crewSizeRecommended}-person crew
            </span>
          </summary>
          <div className="px-4 pb-4 grid gap-2">
            {r.productionSchedule.phases.map((phase, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-md bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-300">{phase.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{phase.description}</div>
                </div>
                <div className="text-xs text-slate-600 flex-shrink-0 flex items-center gap-1">
                  <Clock size={10} />{phase.daysMin === phase.daysMax ? `${phase.daysMin}d` : `${phase.daysMin}–${phase.daysMax}d`}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Schedule risk */}
      {r.scheduleRisk && r.scheduleRisk.delayFactors.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 ${
          r.scheduleRisk.delayProbability === "high"   ? "border-orange-500/30 bg-orange-950/20" :
          r.scheduleRisk.delayProbability === "medium" ? "border-yellow-500/30 bg-yellow-950/20" :
          "border-green-500/20 bg-green-950/10"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Clock size={14} className="text-amber-400" /> Schedule risk
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              r.scheduleRisk.delayProbability === "high"   ? "text-orange-300 bg-orange-900/40" :
              r.scheduleRisk.delayProbability === "medium" ? "text-yellow-300 bg-yellow-900/40" :
              "text-green-300 bg-green-900/40"
            }`}>
              {r.scheduleRisk.delayProbability.toUpperCase()} · +{r.scheduleRisk.bufferDaysRecommended}d buffer
            </span>
          </div>
          <ul className="space-y-1">
            {r.scheduleRisk.delayFactors.map((f, i) => (
              <li key={i} className="text-xs text-slate-400 flex gap-2">
                <span className="text-amber-600 flex-shrink-0">·</span>{f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hidden damage assessment */}
      {r.hiddenDamageAssessment && r.hiddenDamageAssessment.score > 10 && (
        <div className={`rounded-xl border px-4 py-3 ${
          r.hiddenDamageAssessment.probability === "high"   ? "border-red-500/30 bg-red-950/20" :
          r.hiddenDamageAssessment.probability === "medium" ? "border-orange-500/30 bg-orange-950/20" :
          "border-slate-500/20 bg-white/[0.02]"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-400" /> Hidden damage probability
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              r.hiddenDamageAssessment.probability === "high"   ? "text-red-300 bg-red-900/40" :
              r.hiddenDamageAssessment.probability === "medium" ? "text-orange-300 bg-orange-900/40" :
              "text-slate-400 bg-slate-800/40"
            }`}>
              {r.hiddenDamageAssessment.probability.toUpperCase()} · {r.hiddenDamageAssessment.score}/100
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2">{r.hiddenDamageAssessment.recommendation}</p>
          {r.hiddenDamageAssessment.drivers.length > 0 && (
            <ul className="space-y-1">
              {r.hiddenDamageAssessment.drivers.map((d, i) => (
                <li key={i} className="text-xs text-slate-500 flex gap-2">
                  <span className="text-orange-700 flex-shrink-0">·</span>{d}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Upsells */}
      {r.upsells && r.upsells.length > 0 && (
        <details className="rounded-xl border border-brand/20 bg-brand/[0.03]">
          <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 text-sm font-semibold text-brand">
            <Lightbulb size={14} /> Revenue opportunities ({r.upsells.length})
          </summary>
          <div className="px-4 pb-4 grid gap-2">
            {r.upsells.map((u, i) => (
              <div key={i} className="rounded-lg border border-brand/15 bg-brand/[0.04] px-3 py-2.5">
                <div className="text-sm font-semibold text-brand">{u.service}</div>
                <div className="text-xs text-slate-400 mt-0.5">{u.reason}</div>
                {u.additionalCostRange && (
                  <div className="text-xs text-slate-500 mt-1">
                    +${u.additionalCostRange.min.toLocaleString()}–${u.additionalCostRange.max.toLocaleString()} additional
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ROI */}
      {r.roi && r.roi.roiPercent > 0 && (
        <div className="rounded-xl border border-green-500/20 bg-green-950/10 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-green-300 flex items-center gap-2">
              <TrendingUp size={14} /> Return on investment
            </span>
            <span className="text-sm font-bold text-green-400">
              {r.roi.roiPercent}% ROI · +${(r.roi.estimatedValueAdded - r.roi.investmentAmount).toLocaleString()} value
            </span>
          </div>
          <p className="text-xs text-slate-400">{r.roi.notes}</p>
        </div>
      )}

      {/* Algorithm trace (admin view) */}
      {r.algorithmTrace && (r.algorithmTrace.rulesTriggered ?? []).length > 0 && (
        <details className="rounded-xl border border-white/[0.04]">
          <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-500">
            Algorithm trace ↓
          </summary>
          <ul className="px-4 pb-3 space-y-1">
            {(r.algorithmTrace.rulesTriggered ?? []).map((rule, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-2">
                <span className="text-slate-700 flex-shrink-0">[+{rule.points ?? 0}]</span>
                <span>{rule.label} — {rule.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
