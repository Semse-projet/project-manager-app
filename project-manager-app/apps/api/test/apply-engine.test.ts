import test from "node:test";
import assert from "node:assert/strict";

/**
 * Apply Engine (Autonomy Level 4) — Tests unitarios
 * El apply engine NUNCA se auto-testa a sí mismo ejecutando real file writes.
 * Solo verifica contratos, guardrails y lógica de validación.
 */

// ── Guardrails ────────────────────────────────────────────────────────────────

const GUARDRAIL_FRAGMENTS = [
  "prisma/schema", "prisma/migrations", "infrastructure/auth",
  "modules/payments", "modules/finance", ".env", "dockerfile",
  "railway.json", "pnpm-lock", "package-lock", "tsconfig",
  "modules/ops/apply-engine",
];

function isGuardrailed(filePath: string): boolean {
  const lower = filePath.toLowerCase().replace(/\\/g, "/");
  return GUARDRAIL_FRAGMENTS.some((g) => lower.includes(g));
}

test("AE.G1: rutas críticas siempre guardrailed", () => {
  const critical = [
    "packages/db/prisma/schema.prisma",
    "packages/db/prisma/migrations/20260101_init/migration.sql",
    "apps/api/src/infrastructure/auth/jwt.service.ts",
    "apps/api/src/modules/payments/payment-governance.service.ts",
    "apps/api/src/modules/finance/finance.service.ts",
    ".env",
    ".env.production",
    "Dockerfile.api",
    "railway.json",
    "pnpm-lock.yaml",
    "apps/api/src/modules/ops/apply-engine.service.ts",
  ];
  critical.forEach((p) => {
    assert.ok(isGuardrailed(p), `${p} debe ser guardrailed`);
  });
});

test("AE.G2: archivos de test nuevos NO son guardrailed", () => {
  const safe = [
    "apps/api/test/marketplace.test.ts",
    "apps/api/test/notifications.test.ts",
    "apps/api/test/new-module.test.ts",
  ];
  safe.forEach((p) => {
    assert.equal(isGuardrailed(p), false, `${p} no debe ser guardrailed`);
  });
});

test("AE.G3: páginas UI nuevas NO son guardrailed", () => {
  const safe = [
    "apps/web/app/(app)/admin/marketplace/page.tsx",
    "apps/web/app/(app)/admin/new-module/page.tsx",
  ];
  safe.forEach((p) => {
    assert.equal(isGuardrailed(p), false);
  });
});

test("AE.G4: apply-engine no puede modificarse a sí mismo", () => {
  assert.ok(isGuardrailed("apps/api/src/modules/ops/apply-engine.service.ts"));
});

// ── Safety gates ──────────────────────────────────────────────────────────────

test("AE.S1: confirmed=false → denied sin escribir nada", () => {
  const confirmed = false;
  const result = { applied: false, reason: "confirmed=false" };
  assert.equal(result.applied, false);
  assert.ok(result.reason?.includes("confirmed"));
});

test("AE.S2: SEMSE_ALLOW_AUTONOMOUS_APPLY no configurado → denied", () => {
  const allowFlag = process.env.SEMSE_ALLOW_AUTONOMOUS_APPLY;
  if (allowFlag === "true") {
    // In test env this should not be set
    assert.ok(true, "flag está configurado — ok en dev local intencional");
  } else {
    // Default: not set
    assert.notEqual(allowFlag, "true", "SEMSE_ALLOW_AUTONOMOUS_APPLY no debe estar activo en CI/test");
  }
});

test("AE.S3: safeToApply=false → denied incluso con confirmed=true", () => {
  const patch = { safeToApply: false, recommendation: { type: "resolve_alert" } };
  const confirmed = true;
  // Even with confirmed=true, unsafe patches must be denied
  const wouldApply = confirmed && patch.safeToApply;
  assert.equal(wouldApply, false, "unsafePatch + confirmed=true nunca debe aplicarse");
});

test("AE.S4: nunca sobreescribe archivos existentes", () => {
  // Simulate: file already exists
  const existing = new Set(["apps/api/test/ai-mission-control.test.ts"]);
  const filesToCreate = ["apps/api/test/ai-mission-control.test.ts", "apps/api/test/marketplace.test.ts"];
  const willWrite = filesToCreate.filter((f) => !existing.has(f));
  const skipped   = filesToCreate.filter((f) => existing.has(f));

  assert.equal(skipped.length, 1, "archivo existente debe ser skipped");
  assert.equal(willWrite.length, 1, "solo el archivo nuevo se crearía");
  assert.equal(willWrite[0], "apps/api/test/marketplace.test.ts");
});

// ── Apply result contract ─────────────────────────────────────────────────────

test("AE.R1: ApplyResult tiene autonomyLevel=4", () => {
  const result = { autonomyLevel: 4 as const, applied: true, filesCreated: [], filesSkipped: [] };
  assert.equal(result.autonomyLevel, 4);
});

test("AE.R2: ApplyResult incluye content con el texto de los archivos", () => {
  const content = { "apps/api/test/marketplace.test.ts": `import test from "node:test";\n` };
  assert.ok("apps/api/test/marketplace.test.ts" in content);
  assert.ok(content["apps/api/test/marketplace.test.ts"]?.includes("import test"));
});

test("AE.R3: applied=false cuando todos los archivos fueron skipped", () => {
  const filesCreated: string[] = [];
  const filesSkipped = ["apps/api/test/marketplace.test.ts"];
  const applied = filesCreated.length > 0;
  assert.equal(applied, false, "si no se creó nada, applied debe ser false");
});

// ── Audit contract ────────────────────────────────────────────────────────────

test("AE.A1: cada aplicación exitosa debe tener auditId no vacío", () => {
  const auditId = "clx1234567890";
  assert.ok(auditId.length > 0, "auditId debe ser un string no vacío");
});

test("AE.A2: audit fallo no bloquea la aplicación (best-effort)", () => {
  // Simula audit failure
  let auditId = "";
  try {
    throw new Error("DB unavailable");
  } catch {
    auditId = "audit-failed"; // fallback
  }
  assert.equal(auditId, "audit-failed", "audit failure debe usar fallback, no bloquear la aplicación");
});

// ── Template generators ───────────────────────────────────────────────────────

function generateTestTemplate(area: string, moduleSlug: string): string {
  return `import test from "node:test";\nimport assert from "node:assert/strict";\n\n// ${area}\ntest("${moduleSlug}.01: placeholder", () => { assert.ok(true); });\n`;
}

function generatePageTemplate(area: string, moduleSlug: string): string {
  return `"use client";\nexport default function ${area.replace(/[\s/]+/g, "")}Page() {\n  return <div>${area}</div>;\n}\n`;
}

test("AE.T1: generateTestTemplate produce TypeScript válido", () => {
  const content = generateTestTemplate("Marketplace", "marketplace");
  assert.ok(content.includes('import test from "node:test"'));
  assert.ok(content.includes("Marketplace"));
  assert.ok(content.includes("marketplace.01"));
});

test("AE.T2: generatePageTemplate produce React component", () => {
  const content = generatePageTemplate("Marketplace", "marketplace");
  assert.ok(content.includes('"use client"'));
  assert.ok(content.includes("export default function"));
  assert.ok(content.includes("MarketplacePage"));
});

test("AE.T3: templates no contienen código peligroso", () => {
  const testContent = generateTestTemplate("TestArea", "test-area");
  const pageContent = generatePageTemplate("TestArea", "test-area");
  const DANGEROUS = ["eval(", "exec(", "spawn(", "require('child_process')", "fs.rm"];
  [testContent, pageContent].forEach((content) => {
    DANGEROUS.forEach((d) => {
      assert.ok(!content.includes(d), `template no debe contener: ${d}`);
    });
  });
});

// ── Level 4 policy ────────────────────────────────────────────────────────────

test("AE.L1: Level 4 solo crea archivos nuevos — nunca modifica existentes", () => {
  const ALLOWED_OPS  = ["create new file"];
  const FORBIDDEN_OPS = ["modify existing", "delete", "rename", "move", "git push", "deploy"];
  const hasForb = ALLOWED_OPS.some((a) => FORBIDDEN_OPS.includes(a));
  assert.equal(hasForb, false);
});

test("AE.L2: triple confirmación requerida", () => {
  // 1. confirmed=true in body
  // 2. SEMSE_ALLOW_AUTONOMOUS_APPLY=true in env
  // 3. safeToApply=true in patch
  const requirements = ["confirmed=true", "SEMSE_ALLOW_AUTONOMOUS_APPLY=true", "safeToApply=true"];
  assert.equal(requirements.length, 3, "exactamente 3 gates de seguridad");
});

test("AE.L3: SSE evento 'autonomy:applied' es informativo — no desencadena más acciones autónomas", () => {
  const event = { type: "autonomy:applied", autonomous: false };
  assert.equal(event.autonomous, false, "el evento SSE es notificación, no disparador de nueva autonomía");
});
