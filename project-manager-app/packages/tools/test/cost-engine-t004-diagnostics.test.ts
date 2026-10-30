// T-004 — diagnostic tests for the 24 trade engines (docs/specs/api/cost-engine.tasks.md).
//
// Scope: DIAGNOSTIC ONLY. No production logic is changed. The tests copy the built `dist/` to a temp directory and
// wrap `buildCostSummary` THERE so every call (materials, labor, options, output) can be captured exactly as the
// engine made it. Nothing under packages/tools/src or the real dist is modified.
//
// What this proves: mathematical reproducibility of each engine's cost summary, and the precision lost when
// effective rates are re-derived from already-rounded amounts. It does NOT prove that any price, yield,
// multiplier or margin is commercially correct (that is a separate, market-data question: spec §11).
//
// No arbitrary tolerances: equality checks are strict. The only bound used is analytic (a cent of rounding on the
// inputs propagated through the formula), derived below.
//
// Set T004_REPORT=<path> to write the markdown report.

import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SCENARIOS } from "./fixtures/cost-engine-scenarios.ts";

type Options = {
  overhead?: number;
  profit?: number;
  semseFeeRate?: number;
  taxRate?: number;
  perUnitDivisor?: number;
};
type Costs = {
  materials: number;
  labor: number;
  overhead: number;
  profit: number;
  semseFee: number;
  taxes: number;
  total: number;
  perUnit?: number;
  currency: string;
};
type Call = { materials: number; labor: number; options: Options; out: Costs };

const here = fileURLToPath(new URL(".", import.meta.url));
const realDist = resolve(here, "..", "dist");

// Defaults mirrored from packages/tools/src/core/cost-engine.ts (asserted against the real exports below).
const DEFAULTS = { overhead: 0.15, profit: 0.2, semseFeeRate: 0.05, taxRate: 0.07 };

const tmp = mkdtempSync(join(tmpdir(), "t004-tools-"));
cpSync(realDist, tmp, { recursive: true });

const costFile = join(tmp, "core", "cost-engine.js");
const original = readFileSync(costFile, "utf8");
const marker = "export function buildCostSummary(materials, labor, options = {}) {";
assert.ok(original.includes(marker), "cost-engine.js no longer has the expected buildCostSummary signature");
const instrumented =
  original.replace(marker, "function __buildCostSummaryOriginal(materials, labor, options = {}) {") +
  `
export function buildCostSummary(materials, labor, options = {}) {
  const out = __buildCostSummaryOriginal(materials, labor, options);
  (globalThis.__bcsCalls ??= []).push({ materials, labor, options: { ...options }, out });
  return out;
}
`;
writeFileSync(costFile, instrumented);

const instrumentedTools = (await import(pathToFileURL(join(tmp, "index.js")).href)) as Record<string, unknown>;
const realTools = (await import(pathToFileURL(join(realDist, "index.js")).href)) as Record<string, unknown>;
const realBuild = realTools.buildCostSummary as (m: number, l: number, o?: Options) => Costs;

test.after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const cents = (n: number) => Math.round(n * 100);

function effective(options: Options) {
  return {
    overhead: options.overhead ?? DEFAULTS.overhead,
    profit: options.profit ?? DEFAULTS.profit,
    semseFeeRate: options.semseFeeRate ?? DEFAULTS.semseFeeRate,
    taxRate: options.taxRate ?? DEFAULTS.taxRate,
  };
}

type Row = {
  trade: string;
  kind: string;
  fn: string;
  isValid: boolean;
  calls: number;
  costsEqualLastCall: boolean;
  args: Call | null;
  rates: ReturnType<typeof effective> | null;
  hasPerUnit: boolean;
  baseRoundingCents: { materials: number; labor: number } | null;
  // difference rebuilt - original, in cents, by field
  naive: Record<string, number> | null; // rates re-derived from rounded amounts (the v0.2 spec's first-check method)
  roundedBaseExactRates: Record<string, number> | null; // rounded base + the engine's real rates
  withinAnalyticBound: boolean | null;
  rateDerivationError: { overhead: number; profit: number; fee: number; tax: number } | null;
  divisorDerived: number | null;
  divisorActual: number | null;
};

const rows: Row[] = [];

function diffFields(a: Costs, b: Costs): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of ["materials", "labor", "overhead", "profit", "semseFee", "taxes", "total"] as const) {
    out[k] = cents(a[k]) - cents(b[k]);
  }
  out.perUnit = a.perUnit === undefined || b.perUnit === undefined ? 0 : cents(a.perUnit) - cents(b.perUnit);
  return out;
}

test("the 72 initial scenarios cover 24 engines x normal/complex/limit", () => {
  assert.equal(SCENARIOS.length, 72);
  assert.equal(new Set(SCENARIOS.map((s) => s.trade)).size, 24);
  for (const trade of new Set(SCENARIOS.map((s) => s.trade))) {
    assert.deepEqual(
      SCENARIOS.filter((s) => s.trade === trade).map((s) => s.kind),
      ["normal", "complex", "limit"],
    );
  }
});

test("the defaults assumed by this harness match the real cost-engine constants", () => {
  assert.equal(realTools.DEFAULT_OVERHEAD, DEFAULTS.overhead);
  assert.equal(realTools.DEFAULT_PROFIT, DEFAULTS.profit);
  assert.equal(realTools.SEMSE_FEE_RATE, DEFAULTS.semseFeeRate);
  assert.equal(realTools.DEFAULT_TAX, DEFAULTS.taxRate);
});

for (const s of SCENARIOS) {
  test(`${s.trade} / ${s.kind}: engine output is a faithful, reproducible buildCostSummary call`, () => {
    const fn = instrumentedTools[s.fn] as (input: unknown) => Record<string, unknown>;
    assert.equal(typeof fn, "function", `${s.fn} is not exported`);

    (globalThis as Record<string, unknown>).__bcsCalls = [];
    const result = fn(s.input) as { isValid: boolean; costs: Costs };
    const calls = ((globalThis as Record<string, unknown>).__bcsCalls as Call[]).slice();

    const row: Row = {
      trade: s.trade,
      kind: s.kind,
      fn: s.fn,
      isValid: result.isValid,
      calls: calls.length,
      costsEqualLastCall: false,
      args: null,
      rates: null,
      hasPerUnit: result.costs.perUnit !== undefined,
      baseRoundingCents: null,
      naive: null,
      roundedBaseExactRates: null,
      withinAnalyticBound: null,
      rateDerivationError: null,
      divisorDerived: null,
      divisorActual: null,
    };
    rows.push(row);

    // Invariant 1: the scenario is valid and every monetary field is finite.
    assert.equal(result.isValid, true, `${s.trade}/${s.kind}: scenario is not valid input for the engine`);
    for (const [k, v] of Object.entries(result.costs)) {
      if (typeof v === "number") assert.ok(Number.isFinite(v), `${s.trade}/${s.kind}: costs.${k} is not finite`);
    }

    // Invariant 2: the engine builds its summary with buildCostSummary, and costs IS that call's output.
    assert.ok(calls.length >= 1, `${s.trade}/${s.kind}: engine never called buildCostSummary (incompatible)`);
    const last = calls[calls.length - 1]!;
    row.args = last;
    row.costsEqualLastCall = JSON.stringify(result.costs) === JSON.stringify(last.out);
    assert.equal(row.costsEqualLastCall, true, `${s.trade}/${s.kind}: costs differ from the last buildCostSummary output`);

    // Invariant 3 (strict, zero tolerance): re-running the REAL buildCostSummary with the captured arguments
    // reproduces the engine's costs exactly.
    assert.deepEqual(realBuild(last.materials, last.labor, last.options), result.costs);

    const rates = effective(last.options);
    row.rates = rates;

    // Rounding of the base: costs.materials/labor are round2() of what the engine passed in.
    row.baseRoundingCents = {
      materials: cents(result.costs.materials) - Math.round(last.materials * 100),
      labor: cents(result.costs.labor) - Math.round(last.labor * 100),
    };

    // (A) v0.2 first-check method: re-derive rates by dividing the already-rounded amounts, then rebuild.
    const base = result.costs.materials + result.costs.labor;
    const derivedOverhead = result.costs.overhead / base;
    const derivedProfit = result.costs.profit / (base + result.costs.overhead);
    const preTax = base + result.costs.overhead + result.costs.profit + result.costs.semseFee;
    const derivedFee = result.costs.semseFee / base;
    const derivedTax = result.costs.taxes / preTax;
    const divisorDerived = result.costs.perUnit && result.costs.perUnit > 0 ? result.costs.total / result.costs.perUnit : undefined;
    row.divisorDerived = divisorDerived ?? null;
    row.divisorActual = last.options.perUnitDivisor ?? null;
    row.rateDerivationError = {
      overhead: derivedOverhead - rates.overhead,
      profit: derivedProfit - rates.profit,
      fee: derivedFee - rates.semseFeeRate,
      tax: derivedTax - rates.taxRate,
    };
    const naive = realBuild(result.costs.materials, result.costs.labor, {
      overhead: derivedOverhead,
      profit: derivedProfit,
      semseFeeRate: derivedFee,
      taxRate: derivedTax,
      perUnitDivisor: divisorDerived,
    });
    row.naive = diffFields(naive, result.costs);

    // (B) rounded base + the engine's REAL rates and divisor: isolates the effect of base rounding alone.
    const roundedBaseRealRates = realBuild(result.costs.materials, result.costs.labor, last.options);
    row.roundedBaseExactRates = diffFields(roundedBaseRealRates, result.costs);

    // Analytic bound for (B): the rounded base differs from the real base by at most 0.01 (0.005 each).
    // subtotal error e <= 0.01 propagates through the formula; two round2() calls add <= 0.01.
    const { overhead: o, profit: p, semseFeeRate: f, taxRate: t } = rates;
    const k0 = (1 + o) * (1 + p) + f; // preTax / subtotal
    const bound = {
      overhead: 0.01 * o + 0.01,
      profit: 0.01 * (1 + o) * p + 0.01,
      semseFee: 0.01 * f + 0.01,
      taxes: 0.01 * k0 * t + 0.01,
      total: 0.01 * k0 * (1 + t) + 0.01,
    };
    const d = row.roundedBaseExactRates;
    const within =
      d.materials === 0 &&
      d.labor === 0 &&
      Math.abs(d.overhead) / 100 <= bound.overhead + 1e-9 &&
      Math.abs(d.profit) / 100 <= bound.profit + 1e-9 &&
      Math.abs(d.semseFee) / 100 <= bound.semseFee + 1e-9 &&
      Math.abs(d.taxes) / 100 <= bound.taxes + 1e-9 &&
      Math.abs(d.total) / 100 <= bound.total + 1e-9;
    row.withinAnalyticBound = within;
    assert.equal(within, true, `${s.trade}/${s.kind}: rounded-base rebuild differs by more than rounding can explain`);
  });
}

test("finding: wastePercent has different units in concrete (percent points) and masonry (fraction)", () => {
  // Same field name, different meaning. Documented as a CURRENT behavior; changing it is outside this diagnostic task.
  const concrete = instrumentedTools.runConcreteEngine as (i: Record<string, unknown>) => { isValid: boolean };
  const masonry = instrumentedTools.calculateMasonry as (i: Record<string, unknown>) => { isValid: boolean; validationIssues: { field: string }[] };
  const c = SCENARIOS.find((x) => x.trade === "concrete" && x.kind === "normal")!.input;
  const m = SCENARIOS.find((x) => x.trade === "masonry" && x.kind === "normal")!.input;
  assert.equal(concrete({ ...c, wastePercent: 10 }).isValid, true, "concrete accepts 10 as ten percent");
  assert.equal(masonry({ ...m, wastePercent: 10 }).isValid, false, "masonry rejects 10 because it expects a fraction");
  assert.ok(masonry({ ...m, wastePercent: 10 }).validationIssues.some((i) => i.field === "wastePercent"));
  assert.equal(masonry({ ...m, wastePercent: 0.1 }).isValid, true, "masonry accepts 0.1 as ten percent");
});

test("report: engine-specific margins, rounding and reconstruction precision", () => {
  assert.equal(rows.length, 72, "the per-scenario tests must run before the report");

  const byTrade = new Map<string, Row[]>();
  for (const r of rows) byTrade.set(r.trade, [...(byTrade.get(r.trade) ?? []), r]);

  const exactNaive = rows.filter((r) => Object.values(r.naive!).every((v) => v === 0)).length;
  const exactRoundedBase = rows.filter((r) => Object.values(r.roundedBaseExactRates!).every((v) => v === 0)).length;
  const maxNaiveTotal = Math.max(...rows.map((r) => Math.abs(r.naive!.total!)));
  const maxRoundedBaseTotal = Math.max(...rows.map((r) => Math.abs(r.roundedBaseExactRates!.total!)));
  const multiCall = rows.filter((r) => r.calls > 1);
  const nonDefaultFee = rows.filter((r) => r.rates!.semseFeeRate !== DEFAULTS.semseFeeRate);
  const nonDefaultTax = rows.filter((r) => r.rates!.taxRate !== DEFAULTS.taxRate);
  const inputDependentMargins = [...byTrade.entries()].filter(([, rs]) => new Set(rs.map((r) => `${r.rates!.overhead}/${r.rates!.profit}`)).size > 1);
  const perUnitRows = rows.filter((r) => r.hasPerUnit);
  const perUnitDivisorMismatch = perUnitRows.filter((r) => r.divisorActual !== null && r.divisorDerived !== null && Math.abs(r.divisorDerived - r.divisorActual) > 0);

  const fmt = (n: number) => (Math.abs(n) < 1e-12 ? "0" : n.toExponential(2));
  const lines: string[] = [];
  lines.push("# T-004 — Diagnóstico de los 24 motores de costos");
  lines.push("");
  lines.push("> Generado por `packages/tools/test/cost-engine-t004-diagnostics.test.ts`. **Solo diagnóstico**: no cambia lógica productiva ni precios.");
  lines.push("> Demuestra estabilidad matemática; **no** demuestra que ningún precio, rendimiento, multiplicador o margen sea comercialmente correcto.");
  lines.push("");
  lines.push("## Resumen");
  lines.push("");
  lines.push(`- Escenarios: ${rows.length} (24 motores × normal, complejo y límite). Todos válidos y con montos finitos.`);
  lines.push(`- Todos los motores llaman a \`buildCostSummary\` y \`costs\` es exactamente la salida de esa llamada: ${rows.every((r) => r.costsEqualLastCall) ? "sí" : "NO"}.`);
  lines.push(`- Reejecutar \`buildCostSummary\` con los **argumentos capturados** reproduce \`costs\` byte a byte (tolerancia cero): ${rows.length}/${rows.length}.`);
  lines.push(`- Motores con más de una llamada a \`buildCostSummary\` en un escenario: ${multiCall.length === 0 ? "ninguno" : multiCall.map((r) => `${r.trade}/${r.kind}(${r.calls})`).join(", ")}.`);
  lines.push(`- Escenarios con \`perUnit\`: ${perUnitRows.length}.`);
  lines.push("");
  lines.push("## Reconstrucción por división de importes redondeados (método de la spec v0.2)");
  lines.push("");
  lines.push(`- Reconstrucciones exactas (0 centavos en todos los campos): **${exactNaive}/${rows.length}**.`);
  lines.push(`- Mayor diferencia en \`total\`: **${maxNaiveTotal} centavo(s)**.`);
  lines.push(`- Con la base redondeada pero las **tasas reales** del motor: exactas ${exactRoundedBase}/${rows.length}; mayor diferencia en \`total\`: ${maxRoundedBaseTotal} centavo(s). Todas dentro de la cota analítica (un centavo de redondeo de la base propagado por la fórmula, más dos redondeos de salida).`);
  lines.push(`- Divisor de \`perUnit\` recuperado como \`total / perUnit\` que difiere del real: ${perUnitDivisorMismatch.length}/${perUnitRows.length} escenarios.`);
  lines.push("");
  const baseAlwaysInCents = rows.every((r) => r.baseRoundingCents!.materials === 0 && r.baseRoundingCents!.labor === 0);
  lines.push(`**Lectura:** la base (materiales y mano de obra) ya llega en centavos exactos en ${baseAlwaysInCents ? "todos" : "no todos"} los escenarios, así que el redondeo de la base no explica las diferencias.`);
  lines.push(`Las ${rows.length - exactNaive} reconstrucciones inexactas se deben solo a **re-derivar las tasas dividiendo importes ya redondeados**: el motor no expone sus tasas ni su divisor. Con las tasas reales la reconstrucción es exacta (${exactRoundedBase}/${rows.length}).`);
  lines.push("Recomendación: que los motores expongan directamente `effectiveRates` (overhead, ganancia, comisión, impuesto), la base y `perUnitDivisor`, manteniendo la respuesta actual, en vez de reconstruirlos por división. No se usan tolerancias para ocultar estas diferencias.");
  lines.push("");
  lines.push("## Tasas efectivas por motor (capturadas, no derivadas)");
  lines.push("");
  lines.push("| Motor | normal (OH / ganancia / fee / impuesto) | complejo | límite |");
  lines.push("|---|---|---|---|");
  for (const [trade, rs] of byTrade) {
    const cell = (kind: string) => {
      const r = rs.find((x) => x.kind === kind)!;
      const e = r.rates!;
      return `${(e.overhead * 100).toFixed(1)} / ${(e.profit * 100).toFixed(1)} / ${(e.semseFeeRate * 100).toFixed(1)} / ${(e.taxRate * 100).toFixed(1)}`;
    };
    lines.push(`| ${trade} | ${cell("normal")} | ${cell("complex")} | ${cell("limit")} |`);
  }
  lines.push("");
  lines.push(`- Motores cuyo overhead o ganancia **cambia según la entrada**: ${inputDependentMargins.length === 0 ? "ninguno" : inputDependentMargins.map(([t]) => t).join(", ")}.`);
  lines.push(`- Escenarios con comisión distinta del 5 % por defecto: ${nonDefaultFee.length}. Con impuesto distinto del 7 % por defecto: ${nonDefaultTax.length}.`);
  lines.push("");
  lines.push("**Implicación para el diseño:** sustituir los márgenes por valores globales borraría las reglas propias de cada oficio. El servicio debe partir de las tasas efectivas del motor y sobrescribir solo lo que una capa defina.");
  lines.push("");
  lines.push("## Redondeo de la base (importes que el motor pasa vs. `costs.materials`/`costs.labor`)");
  lines.push("");
  lines.push("| Motor | escenario | materiales (centavos) | mano de obra (centavos) |");
  lines.push("|---|---|---|---|");
  for (const r of rows.filter((x) => x.baseRoundingCents!.materials !== 0 || x.baseRoundingCents!.labor !== 0)) {
    lines.push(`| ${r.trade} | ${r.kind} | ${r.baseRoundingCents!.materials} | ${r.baseRoundingCents!.labor} |`);
  }
  if (!rows.some((x) => x.baseRoundingCents!.materials !== 0 || x.baseRoundingCents!.labor !== 0)) lines.push("| — | — | 0 | 0 |");
  lines.push("");
  lines.push("## Error de las tasas re-derivadas (relativo a la tasa real)");
  lines.push("");
  lines.push("| Motor | escenario | overhead | ganancia | fee | impuesto | Δtotal (¢) |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of rows.filter((x) => Object.values(x.naive!).some((v) => v !== 0))) {
    const e = r.rateDerivationError!;
    lines.push(`| ${r.trade} | ${r.kind} | ${fmt(e.overhead)} | ${fmt(e.profit)} | ${fmt(e.fee)} | ${fmt(e.tax)} | ${r.naive!.total} |`);
  }
  if (exactNaive === rows.length) lines.push("| — | — | 0 | 0 | 0 | 0 | 0 |");
  lines.push("");
  lines.push("## Hallazgos colaterales");
  lines.push("");
  lines.push("- **`wastePercent` con unidades distintas:** `concrete` lo trata como puntos porcentuales (rango 0–30, divide entre 100) y `masonry` como fracción (rango 0–0.35). Pasar `10` a mampostería da error de validación; pasar `0.1` a concreto da 0.1 % de desperdicio. Un adaptador que mapee respuestas a entradas debe conocer la unidad de cada motor, o los motores deben normalizarse.");
  lines.push("- **Límites de validación que rechazan entradas plausibles:** `project-manager` limita `crewSize` a 1–20; un proyecto multi-oficio grande queda fuera de rango.");
  lines.push("");
  lines.push("## Qué NO demuestra este informe");
  lines.push("");
  lines.push("- Que los precios de materiales, rendimientos, multiplicadores regionales o márgenes por oficio coincidan con el mercado.");
  lines.push("- Que el 7 % de impuesto sea correcto (ver spec §1.2 y Q10) ni que la conversión PPI sea correcta.");
  lines.push("- Que `quote-engine` y `contractor-estimate` den el mismo total (se verifica en tareas posteriores).");

  const path = process.env.T004_REPORT;
  if (path) writeFileSync(path, lines.join("\n") + "\n", "utf8");

  // Strict facts the report relies on.
  assert.ok(rows.every((r) => r.isValid && r.costsEqualLastCall && r.withinAnalyticBound));
});
