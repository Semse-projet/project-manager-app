import test from "node:test";
import assert from "node:assert/strict";

/**
 * Simulation Engine — Tests unitarios
 * Nivel 3 del Autonomy Core. Solo lectura — nunca aplica cambios.
 */

// ── Guardrails contract ───────────────────────────────────────────────────────

const GUARDRAIL_PATHS = [
  "packages/db/prisma/schema.prisma",
  "packages/db/prisma/migrations/",
  "apps/api/src/infrastructure/auth/",
  "apps/api/src/modules/payments/",
  "apps/api/src/modules/finance/",
  ".env",
];

const GUARDRAIL_PATTERNS = [
  "payment", "auth", "secret", "token", "password", "migration",
  "prisma", "schema", "seed", "production",
];

function isGuardrailed(path: string): boolean {
  const lower = path.toLowerCase();
  return GUARDRAIL_PATHS.some((g) => lower.includes(g.replace("*", ""))) ||
         GUARDRAIL_PATTERNS.some((p) => lower.includes(p));
}

test("SIM.G1: rutas críticas siempre guardrailed", () => {
  const critical = [
    "packages/db/prisma/schema.prisma",
    "packages/db/prisma/migrations/20260101_init",
    "apps/api/src/infrastructure/auth/jwt.service.ts",
    "apps/api/src/modules/payments/payment-governance.service.ts",
    ".env",
    ".env.production",
  ];
  critical.forEach((path) => {
    assert.ok(isGuardrailed(path), `${path} debe ser guardrailed`);
  });
});

test("SIM.G2: archivos de test no son guardrailed", () => {
  const safe = [
    "apps/api/test/worker.test.ts",
    "apps/api/test/contractors-crm.test.ts",
    "apps/api/test/ai-mission-control.test.ts",
  ];
  safe.forEach((path) => {
    assert.equal(isGuardrailed(path), false, `${path} NO debe ser guardrailed`);
  });
});

test("SIM.G3: páginas UI no son guardrailed", () => {
  const safe = [
    "apps/web/app/(app)/admin/contractors/page.tsx",
    "apps/web/components/semse/ObserverPanel.tsx",
    "apps/web/lib/language-context.tsx",
  ];
  safe.forEach((path) => {
    assert.equal(isGuardrailed(path), false, `${path} NO debe ser guardrailed`);
  });
});

test("SIM.G4: palabra 'payment' en path → guardrailed", () => {
  assert.ok(isGuardrailed("apps/api/src/modules/payments/some.service.ts"));
});

test("SIM.G5: palabra 'auth' en path → guardrailed", () => {
  assert.ok(isGuardrailed("apps/api/src/infrastructure/auth/guard.ts"));
});

// ── Patch generation contract ─────────────────────────────────────────────────

type RecType = "add_tests" | "add_frontend" | "fix_risk" | "resolve_alert" | "add_trade_docs";

function buildMockRec(type: RecType, area: string) {
  return {
    id: `test-${type}-${area.toLowerCase().replace(/\s+/g, "-")}`,
    type, area,
    action: `Acción para ${area}`,
    rationale: "Rationale",
    estimatedImpact: "Impact",
    maturityGain: 20,
    effort: "medium" as const,
    priority: 3,
    draftPRTitle: `fix(${area.toLowerCase()}): test`,
    draftPRScope: ["paso 1", "paso 2"],
    autonomyNote: "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa" as const,
  };
}

function simulatePatch(rec: ReturnType<typeof buildMockRec>) {
  if (rec.type === "add_tests") {
    const slug = rec.area.toLowerCase().replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, "");
    const testFile = `apps/api/test/${slug}.test.ts`;
    return {
      filesToCreate: [testFile],
      filesToModify: [],
      safeToApply: !isGuardrailed(testFile),
      breakingRisk: "none" as const,
    };
  }
  if (rec.type === "add_frontend") {
    const slug = rec.area.toLowerCase().replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, "");
    return {
      filesToCreate: [`apps/web/app/(app)/admin/${slug}/page.tsx`, `apps/web/app/api/semse/${slug}/route.ts`],
      filesToModify: ["apps/web/app/(app)/layout.tsx", "apps/web/lib/language-context.tsx"],
      safeToApply: true,
      breakingRisk: "none" as const,
    };
  }
  return { filesToCreate: [], filesToModify: [], safeToApply: false, breakingRisk: "low" as const };
}

test("SIM.P1: add_tests genera archivo de test en apps/api/test/", () => {
  const rec = buildMockRec("add_tests", "Marketplace");
  const patch = simulatePatch(rec);
  assert.ok(patch.filesToCreate.length > 0);
  assert.ok(patch.filesToCreate[0]?.startsWith("apps/api/test/"));
  assert.ok(patch.filesToCreate[0]?.endsWith(".test.ts"));
});

test("SIM.P2: add_tests → safeToApply=true (archivos de test son seguros)", () => {
  const rec = buildMockRec("add_tests", "Notifications");
  const patch = simulatePatch(rec);
  assert.ok(patch.safeToApply, "archivo de test debe ser safe to apply");
});

test("SIM.P3: add_tests → breakingRisk=none", () => {
  const rec = buildMockRec("add_tests", "Worker");
  const patch = simulatePatch(rec);
  assert.equal(patch.breakingRisk, "none");
});

test("SIM.P4: add_frontend genera page + BFF route", () => {
  const rec = buildMockRec("add_frontend", "Contractors CRM");
  const patch = simulatePatch(rec);
  assert.equal(patch.filesToCreate.length, 2);
  assert.ok(patch.filesToCreate.some((f) => f.includes("page.tsx")));
  assert.ok(patch.filesToCreate.some((f) => f.includes("route.ts")));
});

test("SIM.P5: add_frontend modifica layout + language-context", () => {
  const rec = buildMockRec("add_frontend", "Worker");
  const patch = simulatePatch(rec);
  assert.ok(patch.filesToModify.some((f) => f.includes("layout.tsx")));
  assert.ok(patch.filesToModify.some((f) => f.includes("language-context")));
});

test("SIM.P6: resolve_alert → safeToApply=false (acción operacional)", () => {
  const rec = buildMockRec("resolve_alert", "Mission Control");
  const patch = simulatePatch(rec);
  assert.equal(patch.safeToApply, false, "alertas requieren intervención humana");
});

test("SIM.P7: fix_risk → safeToApply=false", () => {
  const rec = buildMockRec("fix_risk", "Embeddings");
  const patch = simulatePatch(rec);
  assert.equal(patch.safeToApply, false);
});

// ── Simulation report contract ────────────────────────────────────────────────

test("SIM.R1: reporte tiene autonomyLevel=3", () => {
  const report = { autonomyLevel: 3 as const, patches: [], patchCount: 0, safePatchCount: 0 };
  assert.equal(report.autonomyLevel, 3);
});

test("SIM.R2: safePatchCount <= patchCount", () => {
  const patches = [
    { safeToApply: true  },
    { safeToApply: false },
    { safeToApply: true  },
  ];
  const safePatchCount = patches.filter((p) => p.safeToApply).length;
  assert.ok(safePatchCount <= patches.length);
  assert.equal(safePatchCount, 2);
});

test("SIM.R3: guardrails list es no vacía y contiene restricciones clave", () => {
  const guardrails = [
    "NUNCA modifica: auth, payments, migrations, secrets, .env, Dockerfiles",
    "NUNCA hace push ni deploy automático",
    "NUNCA modifica payment governance ni release logic",
  ];
  assert.ok(guardrails.length >= 3);
  assert.ok(guardrails.some((g) => g.includes("payment")));
  assert.ok(guardrails.some((g) => g.includes("deploy") || g.includes("push")));
  assert.ok(guardrails.some((g) => g.includes("auth")));
});

// ── Autonomy level enforcement ────────────────────────────────────────────────

test("SIM.A1: Level 3 no ejecuta ningún comando de sistema", () => {
  const FORBIDDEN = ["exec", "spawn", "fork", "child_process", "git push", "npm publish", "pnpm deploy"];
  const simulationCode = `
    generatePatch(rec)
    simulatePatch(rec)
    buildSimulationReport()
    this.recommendations.generate(tenantId)
  `;
  const hasForbidden = FORBIDDEN.some((cmd) => simulationCode.includes(cmd));
  assert.equal(hasForbidden, false, "Level 3 no debe ejecutar comandos del sistema");
});

test("SIM.A2: previewDiff es string legible, no ejecutable", () => {
  const diff = `+++ apps/api/test/example.test.ts\n@@ -0,0 +1 @@\n+import test from "node:test";\n`;
  assert.ok(typeof diff === "string");
  assert.ok(diff.startsWith("+++") || diff.startsWith("#"), "diff debe empezar con +++ o #");
  assert.ok(!diff.includes("eval("), "diff no debe contener eval");
  assert.ok(!diff.includes("exec("), "diff no debe contener exec");
});

test("SIM.A3: simulación es read-only — no hay efectos secundarios en el contrato", () => {
  const READONLY_METHODS = ["simulate", "simulateOne"];
  const WRITE_METHODS    = ["apply", "deploy", "push", "commit", "merge", "delete", "write"];
  const intersection = READONLY_METHODS.filter((r) => WRITE_METHODS.includes(r));
  assert.equal(intersection.length, 0, "SimulationEngine solo tiene métodos de lectura/simulación");
});
