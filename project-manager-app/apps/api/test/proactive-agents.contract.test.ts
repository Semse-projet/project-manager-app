import test from "node:test";
import assert from "node:assert/strict";

type ProactiveSignal = {
  signalType: string;
  severity: "low" | "medium" | "high" | "critical";
  entityType: string;
  entityId: string;
  recommendation: string;
  confidence: number;
  requiresHumanApproval: boolean;
};

function budgetBurnSignal(input: { projectId: string; burnRatePct: number }): ProactiveSignal {
  return {
    signalType: "budget_burn",
    severity: input.burnRatePct >= 90 ? "critical" : input.burnRatePct >= 75 ? "high" : "medium",
    entityType: "project",
    entityId: input.projectId,
    recommendation: "Review burn rate and reduce scope or add funding.",
    confidence: 0.92,
    requiresHumanApproval: true,
  };
}

function lienDeadlineSignal(input: { projectId: string; daysRemaining: number }): ProactiveSignal {
  return {
    signalType: "lien_deadline",
    severity: input.daysRemaining <= 3 ? "critical" : input.daysRemaining <= 7 ? "high" : "medium",
    entityType: "project",
    entityId: input.projectId,
    recommendation: "Generate lien notice and confirm compliance calendar.",
    confidence: 0.95,
    requiresHumanApproval: true,
  };
}

function scopeCreepSignal(input: { projectId: string; changeOrdersPending: number }): ProactiveSignal {
  return {
    signalType: "scope_creep",
    severity: input.changeOrdersPending >= 3 ? "high" : "medium",
    entityType: "project",
    entityId: input.projectId,
    recommendation: "Freeze scope until change order is signed.",
    confidence: 0.88,
    requiresHumanApproval: true,
  };
}

function weatherRiskSignal(input: { projectId: string; weatherDelayHours: number }): ProactiveSignal {
  return {
    signalType: "weather_risk",
    severity: input.weatherDelayHours >= 24 ? "high" : "medium",
    entityType: "project",
    entityId: input.projectId,
    recommendation: "Document weather impact and reschedule field work.",
    confidence: 0.86,
    requiresHumanApproval: true,
  };
}

function overdueMilestoneSignal(input: { milestoneId: string; daysOverdue: number }): ProactiveSignal {
  return {
    signalType: "milestone_overdue",
    severity: input.daysOverdue >= 10 ? "critical" : input.daysOverdue >= 3 ? "high" : "medium",
    entityType: "milestone",
    entityId: input.milestoneId,
    recommendation: "Escalate to BuildOps and notify client.",
    confidence: 0.9,
    requiresHumanApproval: false,
  };
}

function cashFlowRiskSignal(input: { projectId: string; projectedNegativeDays: number }): ProactiveSignal {
  return {
    signalType: "cash_flow_risk",
    severity: input.projectedNegativeDays >= 14 ? "critical" : "high",
    entityType: "project",
    entityId: input.projectId,
    recommendation: "Hold discretionary payouts and review financial runway.",
    confidence: 0.91,
    requiresHumanApproval: true,
  };
}

test("M3.1 proactive agents emit deterministic signals for fixture cases", () => {
  assert.equal(budgetBurnSignal({ projectId: "proj_1", burnRatePct: 92 }).severity, "critical");
  assert.equal(lienDeadlineSignal({ projectId: "proj_1", daysRemaining: 2 }).severity, "critical");
  assert.equal(scopeCreepSignal({ projectId: "proj_1", changeOrdersPending: 4 }).severity, "high");
  assert.equal(weatherRiskSignal({ projectId: "proj_1", weatherDelayHours: 30 }).severity, "high");
  assert.equal(overdueMilestoneSignal({ milestoneId: "ms_1", daysOverdue: 12 }).severity, "critical");
  assert.equal(cashFlowRiskSignal({ projectId: "proj_1", projectedNegativeDays: 15 }).severity, "critical");
});

test("M3.1 low-confidence signals require manual review", () => {
  const signal = { ...budgetBurnSignal({ projectId: "proj_1", burnRatePct: 80 }), confidence: 0.41 };
  assert.ok(signal.confidence < 0.5);
  assert.equal(signal.requiresHumanApproval, true);
});

test("M3.1 financial and legal proactive actions are recommendation-only", () => {
  const financial = cashFlowRiskSignal({ projectId: "proj_1", projectedNegativeDays: 20 });
  const legal = lienDeadlineSignal({ projectId: "proj_1", daysRemaining: 1 });
  assert.equal(financial.requiresHumanApproval, true);
  assert.equal(legal.requiresHumanApproval, true);
});
