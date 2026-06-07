/**
 * Unit tests for BehavioralObserverService — pure logic only (alert generation, score).
 * Run: node --experimental-strip-types --test tests/unit/behavioral-observer.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline pure functions from behavioral-observer.service.ts ─────────────────

type TrustRisk = { low: number; medium: number; high: number; critical: number };
type Verification = { unverified: number; pending: number; verified: number; suspended: number };
type TierDist = { emerging: number; growing: number; established: number; trusted: number };

type AlertSignals = {
  verification: Verification;
  trustRisk: TrustRisk;
  flagged: number;
  openDisputeRate: number;
  recentDisputeSurge: boolean;
  disputeResolutionRate: number;
  openDisputes: number;
  staleJobs: number;
  tierDistribution: TierDist;
  scored: number;
};

type BehavioralAlert = {
  level: "critical" | "high" | "medium" | "info";
  area: string;
  signal: string;
  recommendation: string;
};

function generateAlerts(signals: AlertSignals): BehavioralAlert[] {
  const alerts: BehavioralAlert[] = [];

  if (signals.trustRisk.critical > 0) {
    alerts.push({ level: "critical", area: "User Trust", signal: `${signals.trustRisk.critical} usuario(s) con riesgo crítico activo`, recommendation: "Revisar cuentas en riesgo crítico" });
  }
  if (signals.flagged > 5) {
    alerts.push({ level: "high", area: "User Trust", signal: `${signals.flagged} usuario(s) con flags activos`, recommendation: "Auditar flags" });
  }
  if (signals.trustRisk.high > 10) {
    alerts.push({ level: "medium", area: "User Trust", signal: `${signals.trustRisk.high} usuarios con riesgo alto`, recommendation: "Considerar revisión manual" });
  }
  if (signals.verification.pending > 20) {
    alerts.push({ level: "medium", area: "Verification", signal: `${signals.verification.pending} usuarios en estado pending`, recommendation: "Revisar backlog de verificación" });
  }
  if (signals.recentDisputeSurge) {
    alerts.push({ level: "high", area: "Governance", signal: "Surge de disputas detectado", recommendation: "Investigar causa" });
  }
  if (signals.openDisputeRate > 0.15) {
    alerts.push({ level: "high", area: "Governance", signal: `Tasa de disputas: ${Math.round(signals.openDisputeRate * 100)}%`, recommendation: "Alta tasa sugiere problemas sistémicos" });
  } else if (signals.openDisputeRate > 0.08) {
    alerts.push({ level: "medium", area: "Governance", signal: `Tasa de disputas: ${Math.round(signals.openDisputeRate * 100)}%`, recommendation: "Monitorear tendencia" });
  }
  if (signals.disputeResolutionRate < 0.5 && signals.openDisputes > 3) {
    alerts.push({ level: "medium", area: "Governance", signal: `Tasa de resolución: ${Math.round(signals.disputeResolutionRate * 100)}%`, recommendation: "Acelerar resolución" });
  }
  if (signals.staleJobs > 10) {
    alerts.push({ level: "medium", area: "Market Health", signal: `${signals.staleJobs} jobs sin actividad >30 días`, recommendation: "Revisar jobs estancados" });
  }
  if (signals.scored > 10 && signals.tierDistribution.emerging / signals.scored > 0.7) {
    alerts.push({ level: "info", area: "Reputation Economy", signal: "Más del 70% en tier emerging", recommendation: "Aumentar incentivos de primeros trabajos" });
  }
  return alerts;
}

function computeScore(signals: {
  trustRisk: TrustRisk;
  flagged: number;
  totalActive: number;
  openDisputeRate: number;
  disputeResolutionRate: number;
  recentDisputeSurge: boolean;
  staleJobs: number;
  activeJobs: number;
}): number {
  let score = 100;
  score -= signals.trustRisk.critical * 20;
  score -= signals.trustRisk.high * 3;
  score -= Math.min(signals.flagged * 2, 15);
  score -= Math.round(signals.openDisputeRate * 100) * 2;
  if (signals.recentDisputeSurge) score -= 15;
  if (signals.disputeResolutionRate < 0.5) score -= 10;
  score -= Math.min(signals.staleJobs, 20);
  return Math.max(0, Math.min(100, score));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthy(): AlertSignals {
  return {
    verification: { unverified: 5, pending: 2, verified: 93, suspended: 0 },
    trustRisk: { low: 100, medium: 0, high: 0, critical: 0 },
    flagged: 0,
    openDisputeRate: 0.0,
    recentDisputeSurge: false,
    disputeResolutionRate: 0.9,
    openDisputes: 1,
    staleJobs: 0,
    tierDistribution: { emerging: 5, growing: 20, established: 40, trusted: 35 },
    scored: 100,
  };
}

// ── Alert generation — healthy platform ──────────────────────────────────────

test("healthy platform generates no alerts", () => {
  const alerts = generateAlerts(healthy());
  assert.equal(alerts.length, 0, `expected 0 alerts, got: ${JSON.stringify(alerts.map(a => a.signal))}`);
});

// ── Critical user trust ───────────────────────────────────────────────────────

test("critical riskLevel user triggers critical alert", () => {
  const signals = { ...healthy(), trustRisk: { low: 90, medium: 5, high: 4, critical: 1 } };
  const alerts = generateAlerts(signals);
  const crit = alerts.find((a) => a.level === "critical" && a.area === "User Trust");
  assert.ok(crit, "expected critical User Trust alert");
});

test("no critical user trust when critical count is 0", () => {
  const alerts = generateAlerts(healthy());
  assert.equal(alerts.filter((a) => a.level === "critical").length, 0);
});

// ── Flagged users ─────────────────────────────────────────────────────────────

test("6 flagged users triggers high User Trust alert", () => {
  const signals = { ...healthy(), flagged: 6 };
  const alerts = generateAlerts(signals);
  assert.ok(alerts.some((a) => a.level === "high" && a.area === "User Trust"));
});

test("5 flagged users does NOT trigger flagged alert", () => {
  const signals = { ...healthy(), flagged: 5 };
  const alerts = generateAlerts(signals);
  assert.ok(!alerts.some((a) => a.area === "User Trust" && a.signal.includes("flags activos")));
});

// ── Verification backlog ──────────────────────────────────────────────────────

test("21 pending verifications triggers medium alert", () => {
  const signals = { ...healthy(), verification: { unverified: 5, pending: 21, verified: 70, suspended: 0 } };
  const alerts = generateAlerts(signals);
  assert.ok(alerts.some((a) => a.area === "Verification"));
});

// ── Dispute alerts ────────────────────────────────────────────────────────────

test("openDisputeRate > 0.15 triggers high Governance alert", () => {
  const signals = { ...healthy(), openDisputeRate: 0.20, openDisputes: 10 };
  const alerts = generateAlerts(signals);
  assert.ok(alerts.some((a) => a.level === "high" && a.area === "Governance"));
});

test("openDisputeRate 0.10 triggers medium (not high) Governance alert", () => {
  const signals = { ...healthy(), openDisputeRate: 0.10, openDisputes: 5 };
  const alerts = generateAlerts(signals);
  const govAlerts = alerts.filter((a) => a.area === "Governance");
  assert.ok(govAlerts.length > 0);
  assert.equal(govAlerts[0]?.level, "medium");
});

test("dispute surge triggers high Governance alert", () => {
  const signals = { ...healthy(), recentDisputeSurge: true };
  const alerts = generateAlerts(signals);
  assert.ok(alerts.some((a) => a.level === "high" && a.area === "Governance" && a.signal.includes("Surge")));
});

test("low resolution rate with open disputes triggers medium alert", () => {
  const signals = { ...healthy(), disputeResolutionRate: 0.3, openDisputes: 8 };
  const alerts = generateAlerts(signals);
  assert.ok(alerts.some((a) => a.area === "Governance" && a.signal.includes("resolución")));
});

// ── Market health ─────────────────────────────────────────────────────────────

test("11 stale jobs triggers medium Market Health alert", () => {
  const signals = { ...healthy(), staleJobs: 11 };
  const alerts = generateAlerts(signals);
  assert.ok(alerts.some((a) => a.area === "Market Health"));
});

// ── Reputation economy ────────────────────────────────────────────────────────

test("70%+ emerging tier triggers info alert", () => {
  const signals = { ...healthy(), tierDistribution: { emerging: 75, growing: 15, established: 5, trusted: 5 }, scored: 100 };
  const alerts = generateAlerts(signals);
  assert.ok(alerts.some((a) => a.level === "info" && a.area === "Reputation Economy"));
});

test("no info alert when scored <= 10 (insufficient sample)", () => {
  const signals = { ...healthy(), tierDistribution: { emerging: 9, growing: 0, established: 0, trusted: 0 }, scored: 10 };
  const alerts = generateAlerts(signals);
  assert.ok(!alerts.some((a) => a.area === "Reputation Economy"));
});

// ── Behavioral score ──────────────────────────────────────────────────────────

test("healthy platform score is 100", () => {
  const score = computeScore({ ...healthy(), totalActive: 100, activeJobs: 30 });
  assert.equal(score, 100);
});

test("critical user subtracts 20 points", () => {
  const base = computeScore({ ...healthy(), totalActive: 100, activeJobs: 30 });
  const withCrit = computeScore({ ...healthy(), trustRisk: { low: 99, medium: 0, high: 0, critical: 1 }, totalActive: 100, activeJobs: 30 });
  assert.equal(base - withCrit, 20);
});

test("dispute surge subtracts 15 points", () => {
  const base = computeScore({ ...healthy(), totalActive: 100, activeJobs: 30 });
  const withSurge = computeScore({ ...healthy(), recentDisputeSurge: true, totalActive: 100, activeJobs: 30 });
  assert.equal(base - withSurge, 15);
});

test("score is clamped to 0 minimum under catastrophic conditions", () => {
  const score = computeScore({
    trustRisk: { low: 0, medium: 0, high: 50, critical: 10 },
    flagged: 100, totalActive: 200,
    openDisputeRate: 0.8, disputeResolutionRate: 0.1,
    recentDisputeSurge: true, staleJobs: 100, activeJobs: 50,
  });
  assert.equal(score, 0);
});

test("score is clamped to 100 maximum", () => {
  const score = computeScore({ ...healthy(), totalActive: 100, activeJobs: 30 });
  assert.ok(score <= 100);
});
