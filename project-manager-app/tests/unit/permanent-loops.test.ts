/**
 * SPEC-AUT-001 — tests de Permanent Loops v1 (fase mecánica).
 * Cubre los criterios de aceptación del spec:
 *   1. maxOpenProposals alcanzado → ciclo se salta y queda auditado
 *   2. hallazgo rechazado no vuelve a proponerse dentro del cooldown
 *   4. kill switch detiene un ciclo en curso (re-check entre etapas)
 *   5. cero merges automáticos: no existe capability de merge en los loops
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AUTONOMY_LOOPS_QUEUE,
  dedupAbstractionsLoop,
  specDriftLoop,
  getLoopDefinition,
  permanentLoops,
} from "../../packages/autonomy/src/loops/loop-definitions.ts";
import { runPermanentLoopCycle } from "../../packages/autonomy/src/loops/loop-runner.ts";
import * as runnerModule from "../../packages/autonomy/src/loops/loop-runner.ts";
import * as dedupModule from "../../packages/autonomy/src/loops/dedup-loop.ts";
import * as driftModule from "../../packages/autonomy/src/loops/spec-drift-loop.ts";
import { buildExportInventory, findDuplicateCandidates } from "../../packages/autonomy/src/loops/dedup-loop.ts";
import { analyzeSpecDrift, buildSpecHealthReport } from "../../packages/autonomy/src/loops/spec-drift-loop.ts";
import { loopCycleReportSchema } from "../../packages/schemas/src/autonomy-loops.schema.ts";

function makeControl(overrides: Partial<{ enabled: boolean; paused: boolean; open: number }> = {}) {
  return {
    isEnabled: () => overrides.enabled ?? true,
    isPaused: () => overrides.paused ?? false,
    openProposalCount: () => overrides.open ?? 0,
  };
}

const emptyMemory = { recentlyRejectedTargets: () => [] as string[] };

/** Repo sintético con specs con drift y dos packages con exports duplicados. */
function buildFixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "semse-loops-"));

  // package.json raíz con scripts conocidos
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { build: "tsc", "test:unit": "node --test" } }));

  // dos packages con la misma función exportada (candidato dedup)
  for (const pkg of ["alpha", "beta"]) {
    mkdirSync(join(root, "packages", pkg, "src"), { recursive: true });
    writeFileSync(
      join(root, "packages", pkg, "src", "utils.ts"),
      `export function formatMoney(cents: number): string {\n  return String(cents / 100);\n}\n`
    );
  }

  // spec con drift: related_files inexistente + IMPLEMENTED sin tests + comando fantasma
  mkdirSync(join(root, "docs", "specs", "api"), { recursive: true });
  writeFileSync(
    join(root, "docs", "specs", "api", "ghost.spec.md"),
    [
      "---",
      "id: ghost",
      'status: "IMPLEMENTED"',
      "related_files:",
      "  - apps/api/src/modules/ghost/ghost.service.ts",
      "related_tests: []",
      "---",
      "",
      "# Ghost spec",
      "",
      "Validación: `pnpm run comando:inexistente`",
      ""
    ].join("\n")
  );

  // spec sano
  writeFileSync(
    join(root, "docs", "specs", "api", "healthy.spec.md"),
    ["---", "id: healthy", 'status: "DRAFT"', "---", "", "# Healthy", ""].join("\n")
  );

  return root;
}

// ── Criterio 1: backpressure humano ──────────────────────────────────────────

test("cycle is skipped and audited when openProposals >= maxOpenProposals", async () => {
  const report = await runPermanentLoopCycle(dedupAbstractionsLoop, {
    control: makeControl({ open: dedupAbstractionsLoop.stopCriteria.maxOpenProposals }),
    memory: emptyMemory,
    repoRoot: "/nonexistent",
  });

  assert.equal(report.status, "skipped_backpressure");
  assert.ok(report.auditEvents.some((e) => e.type === "loop.skipped.backpressure"));
  assert.equal(report.findings.length, 0);
});

// ── Criterio 2: memoria de rechazos ──────────────────────────────────────────

test("rejected target within cooldown is suppressed, not re-proposed", async () => {
  const repo = buildFixtureRepo();
  try {
    const first = await runPermanentLoopCycle(dedupAbstractionsLoop, {
      control: makeControl(),
      memory: emptyMemory,
      repoRoot: repo,
    });
    assert.equal(first.status, "completed");
    assert.ok(first.proposalsPlanned.length >= 1, "fixture must produce at least one proposal");
    const rejectedTarget = first.proposalsPlanned[0].target;

    const second = await runPermanentLoopCycle(dedupAbstractionsLoop, {
      control: makeControl(),
      memory: { recentlyRejectedTargets: () => [rejectedTarget] },
      repoRoot: repo,
    });

    assert.ok(!second.proposalsPlanned.some((f) => f.target === rejectedTarget), "rejected target must not be re-proposed");
    assert.ok(second.suppressed.some((s) => s.target === rejectedTarget && s.reason === "recently_rejected"));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── Criterio 4: kill switch ──────────────────────────────────────────────────

test("kill switch: disabled loop skips with audit", async () => {
  const report = await runPermanentLoopCycle(specDriftLoop, {
    control: makeControl({ enabled: false }),
    memory: emptyMemory,
    repoRoot: "/nonexistent",
  });
  assert.equal(report.status, "skipped_disabled");
  assert.ok(report.auditEvents.some((e) => e.type === "loop.skipped.disabled"));
});

test("kill switch: paused loop skips with audit", async () => {
  const report = await runPermanentLoopCycle(specDriftLoop, {
    control: makeControl({ paused: true }),
    memory: emptyMemory,
    repoRoot: "/nonexistent",
  });
  assert.equal(report.status, "skipped_paused");
});

test("kill switch mid-cycle: pause after analysis aborts before proposing", async () => {
  const repo = buildFixtureRepo();
  try {
    let pausedCalls = 0;
    const report = await runPermanentLoopCycle(specDriftLoop, {
      control: {
        isEnabled: () => true,
        // primera consulta (inicio): activo; segunda (entre etapas): pausado
        isPaused: () => { pausedCalls += 1; return pausedCalls > 1; },
        openProposalCount: () => 0,
      },
      memory: emptyMemory,
      repoRoot: repo,
    });

    assert.equal(report.status, "skipped_paused");
    assert.ok(report.auditEvents.some((e) => e.type === "loop.aborted.paused_mid_cycle"));
    assert.equal(report.proposalsPlanned.length, 0, "no proposals may survive a mid-cycle pause");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── Criterio 5: cero merges automáticos ──────────────────────────────────────

test("loops expose no merge capability — proposals are the ceiling (P4)", () => {
  for (const mod of [runnerModule, dedupModule, driftModule]) {
    for (const exportName of Object.keys(mod)) {
      assert.ok(!/merge/i.test(exportName), `forbidden merge capability exported: ${exportName}`);
    }
  }
});

// ── Filtros de presupuesto y confianza ───────────────────────────────────────

test("findings below minConfidence are recorded but never proposed", async () => {
  const repo = buildFixtureRepo();
  try {
    // dedup fixture produce confidence 0.9 (misma aridad + mismo nombre exacto).
    // Con umbral imposible, todo queda suprimido por confianza.
    const strictLoop = {
      ...dedupAbstractionsLoop,
      stopCriteria: { ...dedupAbstractionsLoop.stopCriteria, minConfidence: 0.99 },
    };
    const report = await runPermanentLoopCycle(strictLoop, {
      control: makeControl(),
      memory: emptyMemory,
      repoRoot: repo,
    });
    assert.ok(report.findings.length >= 1);
    assert.equal(report.proposalsPlanned.length, 0);
    assert.ok(report.suppressed.every((s) => s.reason === "below_min_confidence"));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("proposals beyond maxProposals are suppressed as over_proposal_budget", async () => {
  const repo = buildFixtureRepo();
  try {
    const report = await runPermanentLoopCycle(
      { ...specDriftLoop, budgetPerCycle: { ...specDriftLoop.budgetPerCycle, maxProposals: 1 } },
      { control: makeControl(), memory: emptyMemory, repoRoot: repo }
    );
    assert.equal(report.status, "completed");
    assert.ok(report.findings.length >= 2, "fixture spec has multiple drift findings");
    assert.equal(report.proposalsPlanned.length, 1);
    assert.ok(report.suppressed.some((s) => s.reason === "over_proposal_budget"));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── Analizadores mecánicos ───────────────────────────────────────────────────

test("dedup inventory finds duplicate exports across packages", () => {
  const repo = buildFixtureRepo();
  try {
    const inventory = buildExportInventory(repo);
    assert.equal(inventory.length, 2);
    const findings = findDuplicateCandidates(inventory);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, "dedup.candidate");
    assert.ok(findings[0].confidence >= 0.8, "same name + same arity should be high confidence");
    assert.ok(findings[0].rationale.includes("formatMoney"));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("spec-drift detects missing paths, DONE-without-tests and ghost commands", () => {
  const repo = buildFixtureRepo();
  try {
    const findings = analyzeSpecDrift({ repoRoot: repo, definition: specDriftLoop });
    const kinds = findings.map((f) => f.kind);
    assert.ok(kinds.includes("drift.missing_path"), "missing related_files path must be detected");
    assert.ok(kinds.includes("drift.done_without_tests"), "IMPLEMENTED without tests must be detected");
    assert.ok(kinds.includes("drift.missing_command"), "ghost pnpm command must be detected");

    const health = buildSpecHealthReport(repo, findings);
    assert.equal(health.totalSpecs, 2);
    assert.equal(health.healthScore, 0.5); // 1 spec sano de 2
    assert.ok(health.markdown.includes("spec.health_score"));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("skipped_no_repo when the loop's readable scope does not exist", async () => {
  const report = await runPermanentLoopCycle(specDriftLoop, {
    control: makeControl(),
    memory: emptyMemory,
    repoRoot: "/nonexistent-repo-root",
  });
  assert.equal(report.status, "skipped_no_repo");
});

// ── Contratos ────────────────────────────────────────────────────────────────

test("runner report validates against the zod cycle-report mirror", async () => {
  const repo = buildFixtureRepo();
  try {
    const report = await runPermanentLoopCycle(specDriftLoop, {
      control: makeControl(),
      memory: emptyMemory,
      repoRoot: repo,
    });
    const parsed = loopCycleReportSchema.safeParse(report);
    assert.ok(parsed.success, JSON.stringify(parsed.success ? {} : parsed.error.issues, null, 2));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("queue name is BullMQ-safe — no colon allowed", () => {
  // BullMQ rechaza ":" en nombres de cola ("Queue name cannot contain :");
  // en Railway esto tumbó el scheduler silenciosamente (non-fatal warn).
  assert.ok(!AUTONOMY_LOOPS_QUEUE.includes(":"), `queue name contains ':': ${AUTONOMY_LOOPS_QUEUE}`);
});

test("loop definitions match the spec's initial configuration", () => {
  assert.equal(permanentLoops.length, 2);
  assert.equal(getLoopDefinition("loop.dedup-abstractions")?.schedule, "0 6 * * 1");
  assert.equal(getLoopDefinition("loop.spec-drift")?.schedule, "0 6 * * 2,5");
  assert.equal(dedupAbstractionsLoop.budgetPerCycle.maxProposals, 2);
  assert.equal(dedupAbstractionsLoop.stopCriteria.minConfidence, 0.8);
  assert.equal(specDriftLoop.stopCriteria.minConfidence, 0.9);
  // fase mecánica: cero tokens
  assert.equal(dedupAbstractionsLoop.budgetPerCycle.maxTokens, 0);
  assert.equal(specDriftLoop.budgetPerCycle.maxTokens, 0);
});
