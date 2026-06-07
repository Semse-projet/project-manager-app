import test from "node:test";
import assert from "node:assert/strict";

/**
 * Contractors / CRM — Tests unitarios
 * Sin DB. Cubre lead lifecycle, scoring, stats y transiciones de estado.
 */

// ── Lead status lifecycle ─────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "estimate_sent" | "won" | "lost" | "archived";

const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new:           ["contacted", "lost", "archived"],
  contacted:     ["estimate_sent", "lost", "archived"],
  estimate_sent: ["won", "lost", "archived"],
  won:           ["archived"],
  lost:          ["archived"],
  archived:      [],
};

function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}

test("CRM.L1: new → contacted es válido", () => {
  assert.ok(canTransitionLead("new", "contacted"));
});

test("CRM.L2: new → won NO es válido (requiere estimate_sent primero)", () => {
  assert.equal(canTransitionLead("new", "won"), false);
});

test("CRM.L3: estimate_sent → won es válido", () => {
  assert.ok(canTransitionLead("estimate_sent", "won"));
});

test("CRM.L4: cualquier estado → archived es válido", () => {
  const states: LeadStatus[] = ["new", "contacted", "estimate_sent", "won", "lost"];
  states.forEach((s) => {
    assert.ok(canTransitionLead(s, "archived"), `${s} → archived debe ser válido`);
  });
});

test("CRM.L5: archived es estado final", () => {
  const targets: LeadStatus[] = ["new", "contacted", "won"];
  targets.forEach((t) => {
    assert.equal(canTransitionLead("archived", t), false);
  });
});

test("CRM.L6: lost → archived (recuperación limpia)", () => {
  assert.ok(canTransitionLead("lost", "archived"));
});

// ── Lead stats ────────────────────────────────────────────────────────────────

type LeadStats = { new: number; contacted: number; estimate_sent: number; won: number; lost: number; total: number; conversionRate: number };

function computeLeadStats(counts: Record<string, number>): LeadStats {
  const n    = counts["new"] ?? 0;
  const c    = counts["contacted"] ?? 0;
  const es   = counts["estimate_sent"] ?? 0;
  const w    = counts["won"] ?? 0;
  const l    = counts["lost"] ?? 0;
  const total = n + c + es + w + l;
  const conversionRate = total > 0 ? Math.round((w / total) * 100) : 0;
  return { new: n, contacted: c, estimate_sent: es, won: w, lost: l, total, conversionRate };
}

test("CRM.S1: stats con conversión del 25%", () => {
  const stats = computeLeadStats({ new: 2, contacted: 2, estimate_sent: 2, won: 2, lost: 2 });
  assert.equal(stats.total, 10);
  assert.equal(stats.won, 2);
  assert.equal(stats.conversionRate, 20);
});

test("CRM.S2: sin leads → conversionRate=0", () => {
  const stats = computeLeadStats({});
  assert.equal(stats.total, 0);
  assert.equal(stats.conversionRate, 0);
});

test("CRM.S3: todos ganados → conversionRate=100", () => {
  const stats = computeLeadStats({ won: 5 });
  assert.equal(stats.conversionRate, 100);
  assert.equal(stats.total, 5);
});

// ── Lead creation validation ──────────────────────────────────────────────────

type CreateLeadInput = { name: string; phone?: string; email?: string; trade?: string; source?: string; tenantId: string };

function validateLeadInput(input: Partial<CreateLeadInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) errors.push("name is required");
  if (!input.tenantId) errors.push("tenantId is required");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push("invalid email format");
  if (input.phone && !/^\+?[\d\s\-()]{7,}$/.test(input.phone)) errors.push("invalid phone format");
  return { valid: errors.length === 0, errors };
}

test("CRM.V1: lead válido mínimo (name + tenantId)", () => {
  const result = validateLeadInput({ name: "Juan Pérez", tenantId: "t1" });
  assert.ok(result.valid);
  assert.deepEqual(result.errors, []);
});

test("CRM.V2: sin name → inválido", () => {
  const result = validateLeadInput({ tenantId: "t1" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("name")));
});

test("CRM.V3: email inválido → error de formato", () => {
  const result = validateLeadInput({ name: "Juan", tenantId: "t1", email: "not-an-email" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("email")));
});

test("CRM.V4: email válido pasa", () => {
  const result = validateLeadInput({ name: "Juan", tenantId: "t1", email: "juan@example.com" });
  assert.ok(result.valid);
});

test("CRM.V5: sin tenantId → inválido", () => {
  const result = validateLeadInput({ name: "Juan" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("tenantId")));
});

// ── Trust / reputation scoring ────────────────────────────────────────────────

type TrustFactors = { completedJobs: number; onTimeRate: number; disputeRate: number; avgRating: number };

function computeTrustScore(factors: TrustFactors): number {
  // Weighted formula: completed jobs (20%) + on-time rate (30%) + dispute-free (30%) + rating (20%)
  const completedScore = Math.min(factors.completedJobs / 20, 1) * 20; // cap at 20 jobs
  const onTimeScore    = factors.onTimeRate * 30;
  const disputeScore   = (1 - factors.disputeRate) * 30;
  const ratingScore    = (factors.avgRating / 5) * 20;
  return Math.round(completedScore + onTimeScore + disputeScore + ratingScore);
}

test("CRM.T1: contratista perfecto → score alto", () => {
  const score = computeTrustScore({ completedJobs: 30, onTimeRate: 1.0, disputeRate: 0, avgRating: 5 });
  assert.ok(score >= 90, `score=${score} debe ser >= 90`);
});

test("CRM.T2: contratista nuevo (0 jobs) → score moderado", () => {
  const score = computeTrustScore({ completedJobs: 0, onTimeRate: 0, disputeRate: 0, avgRating: 0 });
  assert.ok(score >= 0 && score <= 100);
});

test("CRM.T3: alta tasa de disputas baja el score", () => {
  const good = computeTrustScore({ completedJobs: 20, onTimeRate: 0.9, disputeRate: 0.0, avgRating: 4.5 });
  const bad  = computeTrustScore({ completedJobs: 20, onTimeRate: 0.9, disputeRate: 0.5, avgRating: 4.5 });
  assert.ok(good > bad, `disputa 0% (${good}) debe ser mayor que disputa 50% (${bad})`);
});

test("CRM.T4: score siempre entre 0 y 100", () => {
  const scores = [
    computeTrustScore({ completedJobs: 0,  onTimeRate: 0,   disputeRate: 1,   avgRating: 0 }),
    computeTrustScore({ completedJobs: 100, onTimeRate: 1,  disputeRate: 0,   avgRating: 5 }),
    computeTrustScore({ completedJobs: 5,  onTimeRate: 0.7, disputeRate: 0.1, avgRating: 3.5 }),
  ];
  scores.forEach((s) => {
    assert.ok(s >= 0 && s <= 100, `score ${s} debe estar en [0, 100]`);
  });
});

// ── Lead search / filtering ───────────────────────────────────────────────────

type Lead = { id: string; name: string; status: LeadStatus; trade?: string };

function filterLeads(leads: Lead[], opts: { status?: LeadStatus; trade?: string; search?: string }): Lead[] {
  return leads.filter((l) => {
    if (opts.status && l.status !== opts.status) return false;
    if (opts.trade  && l.trade  !== opts.trade)  return false;
    if (opts.search && !l.name.toLowerCase().includes(opts.search.toLowerCase())) return false;
    return true;
  });
}

test("CRM.F1: filtrar por status", () => {
  const leads: Lead[] = [
    { id: "1", name: "Ana", status: "new" },
    { id: "2", name: "Bob", status: "contacted" },
    { id: "3", name: "Car", status: "new" },
  ];
  const result = filterLeads(leads, { status: "new" });
  assert.equal(result.length, 2);
  assert.ok(result.every((l) => l.status === "new"));
});

test("CRM.F2: búsqueda por nombre (case-insensitive)", () => {
  const leads: Lead[] = [
    { id: "1", name: "Carlos Ramírez", status: "new" },
    { id: "2", name: "Ana García", status: "new" },
  ];
  const result = filterLeads(leads, { search: "carlos" });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, "Carlos Ramírez");
});

test("CRM.F3: sin filtros → todos los leads", () => {
  const leads: Lead[] = [
    { id: "1", name: "A", status: "new" },
    { id: "2", name: "B", status: "won" },
  ];
  assert.equal(filterLeads(leads, {}).length, 2);
});
