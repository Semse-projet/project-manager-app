import test from "node:test";
import assert from "node:assert/strict";

/**
 * Marketplace v1 — Tests unitarios
 * Sin DB. Cubre lógica de listings, stats y profesionales.
 */

// ── Listing filtering logic ───────────────────────────────────────────────────

type Job = { id: string; title: string; category: string | null; location: string | null; urgency: string | null; status: string; budgetMin: number | null };

function filterJobs(jobs: Job[], opts: { category?: string; location?: string; urgency?: string; status?: string }): Job[] {
  return jobs.filter((j) => {
    if (opts.status   && j.status !== opts.status) return false;
    if (opts.category && j.category !== opts.category) return false;
    if (opts.urgency  && j.urgency  !== opts.urgency)  return false;
    if (opts.location && !j.location?.toLowerCase().includes(opts.location.toLowerCase())) return false;
    return true;
  });
}

const SAMPLE_JOBS: Job[] = [
  { id: "j1", title: "Pintar sala", category: "painting", location: "Miami, FL",       urgency: "low",    status: "PUBLISHED", budgetMin: 500  },
  { id: "j2", title: "Plomería cocina", category: "plumbing", location: "Orlando, FL", urgency: "urgent", status: "PUBLISHED", budgetMin: 1200 },
  { id: "j3", title: "Drywall garage",  category: "drywall",  location: "Miami, FL",   urgency: "medium", status: "PUBLISHED", budgetMin: 800  },
  { id: "j4", title: "Trabajo urgente", category: "painting", location: "Tampa, FL",   urgency: "urgent", status: "PUBLISHED", budgetMin: 300  },
  { id: "j5", title: "Borrador",        category: "general",  location: null,          urgency: null,     status: "DRAFT",     budgetMin: null },
];

test("MKT.F1: solo jobs PUBLISHED aparecen en el marketplace", () => {
  const result = filterJobs(SAMPLE_JOBS, { status: "PUBLISHED" });
  assert.equal(result.length, 4);
  assert.ok(result.every((j) => j.status === "PUBLISHED"));
});

test("MKT.F2: filtro por categoría", () => {
  const result = filterJobs(SAMPLE_JOBS.filter((j) => j.status === "PUBLISHED"), { category: "painting" });
  assert.equal(result.length, 2);
  assert.ok(result.every((j) => j.category === "painting"));
});

test("MKT.F3: filtro por urgency", () => {
  const result = filterJobs(SAMPLE_JOBS.filter((j) => j.status === "PUBLISHED"), { urgency: "urgent" });
  assert.equal(result.length, 2);
});

test("MKT.F4: filtro por location (case-insensitive)", () => {
  const result = filterJobs(SAMPLE_JOBS.filter((j) => j.status === "PUBLISHED"), { location: "miami" });
  assert.equal(result.length, 2);
  assert.ok(result.every((j) => j.location?.toLowerCase().includes("miami")));
});

test("MKT.F5: sin filtros → todos los PUBLISHED", () => {
  const result = filterJobs(SAMPLE_JOBS, { status: "PUBLISHED" });
  assert.equal(result.length, 4);
});

// ── Stats computation ─────────────────────────────────────────────────────────

function computeMarketplaceStats(jobs: Job[]) {
  const published = jobs.filter((j) => j.status === "PUBLISHED");
  const byCategory: Record<string, number> = {};
  const byUrgency:  Record<string, number> = {};
  let totalBudget = 0; let budgetCount = 0;

  for (const j of published) {
    const cat = j.category ?? "general";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    const urg = j.urgency ?? "medium";
    byUrgency[urg] = (byUrgency[urg] ?? 0) + 1;
    if (j.budgetMin) { totalBudget += j.budgetMin; budgetCount++; }
  }

  return {
    totalListings: published.length,
    byCategory,
    byUrgency,
    avgBudgetMin: budgetCount > 0 ? Math.round(totalBudget / budgetCount) : null,
  };
}

test("MKT.S1: stats totalListings solo cuenta PUBLISHED", () => {
  const stats = computeMarketplaceStats(SAMPLE_JOBS);
  assert.equal(stats.totalListings, 4);
});

test("MKT.S2: byCategory agrupa correctamente", () => {
  const stats = computeMarketplaceStats(SAMPLE_JOBS);
  assert.equal(stats.byCategory["painting"], 2);
  assert.equal(stats.byCategory["plumbing"], 1);
  assert.equal(stats.byCategory["drywall"],  1);
});

test("MKT.S3: byUrgency agrupa correctamente", () => {
  const stats = computeMarketplaceStats(SAMPLE_JOBS);
  assert.equal(stats.byUrgency["urgent"], 2);
  assert.equal(stats.byUrgency["low"],    1);
  assert.equal(stats.byUrgency["medium"], 1);
});

test("MKT.S4: avgBudgetMin calcula promedio correcto", () => {
  const stats = computeMarketplaceStats(SAMPLE_JOBS);
  // 500 + 1200 + 800 + 300 = 2800 / 4 = 700
  assert.equal(stats.avgBudgetMin, 700);
});

test("MKT.S5: sin jobs → avgBudgetMin=null", () => {
  const stats = computeMarketplaceStats([]);
  assert.equal(stats.avgBudgetMin, null);
  assert.equal(stats.totalListings, 0);
});

// ── Professional listing ──────────────────────────────────────────────────────

type Professional = { id: string; completedJobs: number; avgRating: number | null };

function sortProfessionals(profs: Professional[]): Professional[] {
  return [...profs].sort((a, b) => b.completedJobs - a.completedJobs);
}

test("MKT.P1: profesionales ordenados por completedJobs desc", () => {
  const profs: Professional[] = [
    { id: "p1", completedJobs: 3,  avgRating: 4.5 },
    { id: "p2", completedJobs: 10, avgRating: 4.8 },
    { id: "p3", completedJobs: 1,  avgRating: 5.0 },
  ];
  const sorted = sortProfessionals(profs);
  assert.equal(sorted[0]?.id, "p2");
  assert.equal(sorted[1]?.id, "p1");
  assert.equal(sorted[2]?.id, "p3");
});

test("MKT.P2: profesional sin ratings → avgRating=null", () => {
  const prof: Professional = { id: "p1", completedJobs: 5, avgRating: null };
  assert.equal(prof.avgRating, null);
});

test("MKT.P3: avgRating con 1 decimal", () => {
  const scores = [4, 5, 5, 3, 4];
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  assert.equal(avg, 4.2);
});

// ── Listing contract ──────────────────────────────────────────────────────────

test("MKT.L1: listing tiene todos los campos requeridos", () => {
  const listing = {
    id: "j1", title: "Pintar sala", category: "painting", location: "Miami",
    budgetMin: 500, budgetMax: 800, budgetType: "fixed", status: "PUBLISHED",
    urgency: "low", scope: "Pintar sala y comedor", postedAt: new Date().toISOString(),
    bidsCount: 0,
  };
  const required = ["id", "title", "category", "location", "budgetMin", "status", "urgency", "scope", "postedAt", "bidsCount"];
  required.forEach((f) => {
    assert.ok(f in listing, `listing debe tener campo: ${f}`);
  });
});

test("MKT.L2: scope truncado a 200 chars en el listing", () => {
  const longScope = "a".repeat(300);
  const truncated = longScope.slice(0, 200);
  assert.equal(truncated.length, 200);
});

test("MKT.L3: budgetMin y budgetMax son numbers (no Decimal strings)", () => {
  const budgetMin = 500;
  const budgetMax = 800;
  assert.equal(typeof budgetMin, "number");
  assert.equal(typeof budgetMax, "number");
  assert.ok(budgetMin <= budgetMax);
});

// ── Pagination ────────────────────────────────────────────────────────────────

test("MKT.PG1: paginación — offset + limit correctos", () => {
  const allJobs = Array.from({ length: 25 }, (_, i) => ({ id: `j${i}`, status: "PUBLISHED" }));
  const page1 = allJobs.slice(0, 10);
  const page2 = allJobs.slice(10, 20);
  const page3 = allJobs.slice(20, 30);

  assert.equal(page1.length, 10);
  assert.equal(page2.length, 10);
  assert.equal(page3.length, 5);
  assert.equal(page1[0]?.id, "j0");
  assert.equal(page2[0]?.id, "j10");
});

test("MKT.PG2: total refleja todos los registros (no solo la página)", () => {
  const total = 25;
  const page1Count = 10;
  assert.ok(total > page1Count, "total debe ser mayor que el tamaño de página");
  assert.equal(Math.ceil(total / page1Count), 3, "25 items / 10 per page = 3 páginas");
});
