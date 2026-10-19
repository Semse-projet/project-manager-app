/**
 * Regression coverage for the bilingual operational panels.
 * Run: node --experimental-strip-types --test tests/unit/operational-panels-i18n.test.ts
 *
 * Static dictionary checks cannot translate API-generated prose. Those
 * responses require separate, locale-aware backend handling.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(path.join(root, "apps/web/lib/language-context.tsx"), "utf8");

function keysBetween(start: string, end: string): Set<string> {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "language dictionaries not found");
  return new Set(
    [...src.slice(a, b).matchAll(/"([A-Za-z0-9_.-]+)":/g)].map((m) => m[1]),
  );
}

const es = keysBetween("\n  es: {", "\n  en: {");
const en = keysBetween("\n  en: {", "\nconst LanguageContext");

test("Spanish and English translation dictionaries remain in full key parity", () => {
  assert.ok(es.size > 0);
  assert.deepEqual([...es].filter((k) => !en.has(k)), []);
  assert.deepEqual([...en].filter((k) => !es.has(k)), []);
});

test("all static operational panel translation keys exist in both languages", () => {
  const files = [
    "apps/web/components/milestones/MilestoneGovernancePanel.tsx",
    "apps/web/components/buildops/BuildOpsProjectHealthPanel.tsx",
    "apps/web/components/change-orders/ChangeOrderImpactCard.tsx",
    "apps/web/components/semse/CrowdDecisionBadge.tsx",
    "apps/web/app/(app)/client/dashboard/page.tsx",
    "apps/web/app/(app)/worker/dashboard/page.tsx",
    "apps/web/app/(app)/admin/dashboard/page.tsx",
    "apps/web/app/(app)/admin/mission-control/page.tsx",
  ];
  const required = new Set(["nav.workspace"]);
  for (const filename of files) {
    const panel = readFileSync(path.join(root, filename), "utf8");
    assert.match(panel, /useLanguage/, `${filename} must access locale context`);
    for (const match of panel.matchAll(/\bt\(["']([A-Za-z0-9_.-]+)["']\)/g)) {
      required.add(match[1]);
    }
  }
  for (const status of ["ready", "blocked", "needs_review", "released", "disputed"]) {
    required.add(`governance.status.${status}`);
  }
  for (const risk of ["low", "medium", "high", "critical"]) {
    required.add(`risk.${risk}`);
  }
  for (const status of ["draft", "posted", "reserved", "accepted", "in_progress", "review", "dispute", "completed", "cancelled"]) {
    required.add(`clientDash.status.${status}`);
  }
  for (const tier of ["nuevo", "confiable", "preferido", "elite"]) {
    required.add(`clientDash.tier.${tier}`);
  }
  for (const status of ["submitted", "accepted", "rejected"]) {
    required.add(`workerDash.bid.${status}`);
  }
  for (const tier of ["emerging", "growing", "established", "trusted"]) {
    required.add(`workerDash.tier.${tier}`);
  }
  for (const status of ["locked", "pending_review", "released", "disputed"]) {
    required.add(`crowd.status.${status}`);
  }
  for (const source of ["signal", "event", "agent_run", "approval", "loop", "incident", "service_health", "worker_queue"]) {
    required.add(`mc.source.${source}`);
  }
  for (const severity of ["critical", "high", "medium", "low", "info"]) {
    required.add(`mc.severity.${severity}`);
  }
  for (const status of ["open", "acknowledged", "failed", "dead_letter", "pending_approval"]) {
    required.add(`mc.status.${status}`);
  }
  for (const status of ["HEALTHY", "ATTENTION", "DEGRADED"]) {
    required.add(`mc.pageStatus.${status}`);
  }
  for (const state of ["connected", "degraded"]) {
    required.add(`mc.live.${state}`);
  }
  for (const action of ["ACKNOWLEDGE", "RESOLVE", "DISMISS", "PAUSE", "RESUME", "RETRY", "REQUEUE", "REPLAY", "ESCALATE"]) {
    required.add(`mc.action.${action}`);
  }
  for (const status of ["RUNNING", "SUCCEEDED", "FAILED", "NO_OP"]) {
    required.add(`mc.receiptStatus.${status}`);
  }
  for (const key of required) {
    assert.ok(es.has(key), `Missing Spanish translation: ${key}`);
    assert.ok(en.has(key), `Missing English translation: ${key}`);
  }
});

test("admin demo fallbacks and Mission Control actions remain safely localized", () => {
  const admin = readFileSync(path.join(root, "apps/web/app/(app)/admin/dashboard/page.tsx"), "utf8");
  const mission = readFileSync(path.join(root, "apps/web/app/(app)/admin/mission-control/page.tsx"), "utf8");

  assert.match(
    admin,
    /NEXT_PUBLIC_SEMSE_DEMO_LOGIN_ENABLED === "true"/,
    "demo alerts require an explicit public demo-mode signal",
  );
  assert.match(
    admin,
    /apiError && explicitDemoMode \? demoAlerts\(t\) : \[\]/,
    "API errors alone must never fabricate sample alerts",
  );
  assert.match(
    admin,
    /!loading && !apiError && disputeJobs\.length === 0/,
    "the clean empty-alert state must not render while loading",
  );
  assert.match(
    mission,
    /t\(`mc\.action\.\$\{draft\.action\}`\)/,
    "governed-action headings must localize the enum for display",
  );
  assert.match(
    mission,
    /action: draft\.action/,
    "the raw action enum must still be submitted unchanged to the API",
  );
});

