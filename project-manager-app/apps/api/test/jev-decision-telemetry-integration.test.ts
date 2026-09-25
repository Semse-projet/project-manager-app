import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaDecisionTelemetry } from "../dist/modules/ai-models/decision/decision-telemetry.repository.js";

// Jev Decision Layer telemetry against a real Postgres (spec: prometeo/jev-decision-layer §6).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(path.resolve(__dirname, "..", "..", ".."), "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;
const TENANT = `tenant_jev_${Date.now()}`;

test.after(async () => {
  if (process.env.DATABASE_URL) await prisma.jevDecisionEvent.deleteMany({ where: { tenantId: { startsWith: TENANT } } });
  await prisma.$disconnect();
});

dbTest("records decision vs final action, and outcomes are tenant-scoped", async () => {
  const telemetry = new PrismaDecisionTelemetry(prisma as any);
  const id = await telemetry.record({
    tenantId: TENANT,
    userId: "u1",
    feature: "vision_gate",
    decision: "SHOW_ALTERNATIVES",
    confidence: 0.91,
    reasonCode: "AMBIGUOUS_VISUAL_MATCH",
    source: "jev",
    fallbackUsed: false,
    latencyMs: 42,
    model: "jev-fast@2026.09",
    finalSystemAction: "SHOW_ALTERNATIVES",
    provider: "jev",
    mode: "shadow",
    canary: "tenant",
    deterministicDecision: "ASK_USER",
    jevDecision: "SHOW_ALTERNATIVES",
    jevConfidence: 0.91,
    jevReasonCode: "AMBIGUOUS_VISUAL_MATCH",
    agreement: false,
    invariantsViolated: [],
    inputClass: "status:uncertain",
    correlationId: "req_abc",
    costUsd: 0.0001,
  });
  assert.ok(id);

  await telemetry.recordOutcome({ eventId: id!, tenantId: `${TENANT}_other`, outcome: "user_saved" });
  let row = await prisma.jevDecisionEvent.findUnique({ where: { id: id! } });
  assert.equal(row?.outcome, null, "another tenant cannot annotate this event");

  await telemetry.recordOutcome({ eventId: id!, tenantId: TENANT, outcome: "user_corrected" });
  row = await prisma.jevDecisionEvent.findUnique({ where: { id: id! } });
  assert.equal(row?.outcome, "user_corrected");
  assert.equal(row?.decision, "SHOW_ALTERNATIVES");
  assert.equal(row?.finalSystemAction, "SHOW_ALTERNATIVES");
  assert.equal(row?.fallbackUsed, false);
  // Wave 0 columns: baseline vs. Jev vs. final, reconstructable by correlation id.
  assert.equal(row?.mode, "shadow");
  assert.equal(row?.canary, "tenant");
  assert.equal(row?.deterministicDecision, "ASK_USER");
  assert.equal(row?.jevDecision, "SHOW_ALTERNATIVES");
  assert.equal(row?.agreement, false);
  assert.equal(row?.correlationId, "req_abc");
  assert.equal(row?.costUsd, 0.0001);
  const disagreements = await prisma.jevDecisionEvent.count({ where: { tenantId: TENANT, feature: "vision_gate", mode: "shadow", agreement: false } });
  assert.equal(disagreements, 1);
});
