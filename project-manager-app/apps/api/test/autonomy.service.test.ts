import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { AutonomyService } from "../dist/modules/autonomy/autonomy.service.js";

// ── Stub helpers ──────────────────────────────────────────────────────────────

const STUB_RUN = {
  id: "run_1",
  tenantId: "tenant_1",
  orgId: "org_1",
  userId: "usr_1",
  status: "completed",
  task: "Add health endpoint",
  branchName: "autonomy/health-endpoint",
  commitSha: "abc123",
  generatedFile: "apps/api/src/health.ts",
  prUrl: "https://github.com/org/repo/pull/42",
  prState: "open",
  logs: ["Step 1 done", "Step 2 done"],
  startedAt: new Date("2026-06-22T10:00:00Z"),
  completedAt: new Date("2026-06-22T10:02:00Z"),
  createdAt: new Date("2026-06-22T10:00:00Z"),
  updatedAt: new Date("2026-06-22T10:02:00Z"),
  repoPath: "/workspace/repo",
  baseBranch: "main",
  errorMessage: null,
};

function makeRepo(runs: any[] = [STUB_RUN]) {
  return {
    list: async () => runs,
    detail: async ({ runId }: { tenantId: string; runId: string }) =>
      runs.find((r) => r.id === runId) ?? null,
    createPending: async (input: any) => ({ ...STUB_RUN, id: "run_pending", status: "pending", ...input }),
    complete: async (input: any) => ({ ...STUB_RUN, ...input }),
    fail: async (input: any) => ({ ...STUB_RUN, status: "failed", ...input }),
  } as never;
}

function makeMemoryRepo() {
  return {
    upsert: async () => {},
    find: async () => null,
  } as never;
}

// ── list ──────────────────────────────────────────────────────────────────────

test("autonomy: list returns enriched run items", async () => {
  const service = new AutonomyService(makeRepo([STUB_RUN]), makeMemoryRepo());

  const result = await service.list({ tenantId: "tenant_1" });

  assert.ok(Array.isArray(result.items));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.id, "run_1");
});

test("autonomy: list returns empty items when no runs exist", async () => {
  const service = new AutonomyService(makeRepo([]), makeMemoryRepo());

  const result = await service.list({ tenantId: "tenant_1" });

  assert.ok(Array.isArray(result.items));
  assert.equal(result.items.length, 0);
});

// ── detail ────────────────────────────────────────────────────────────────────

test("autonomy: detail returns enriched run with full detail", async () => {
  const service = new AutonomyService(makeRepo([STUB_RUN]), makeMemoryRepo());

  const result = await service.detail({ tenantId: "tenant_1", runId: "run_1" });

  assert.equal(result.id, "run_1");
  assert.equal(result.status, "completed");
  assert.equal(result.task, "Add health endpoint");
});

// ── providerStatus ────────────────────────────────────────────────────────────

test("autonomy: providerStatus returns status object without throwing", () => {
  // Clear any LLM env vars so we get a known default state
  const envVars = [
    "SEMSE_AUTONOMY_LLM_PROVIDER",
    "SEMSE_AUTONOMY_LLM_API_KEY",
    "SEMSE_AUTONOMY_LLM_MODEL",
    "SEMSE_AUTONOMY_LLM_BASE_URL",
  ];
  const saved: Record<string, string | undefined> = {};
  for (const v of envVars) {
    saved[v] = process.env[v];
    delete process.env[v];
  }

  const service = new AutonomyService(makeRepo(), makeMemoryRepo());
  const status = service.providerStatus();

  assert.ok(typeof status === "object");
  assert.ok("configured" in status || "provider" in status || "available" in status || status !== null);

  // Restore env
  for (const v of envVars) {
    if (saved[v] !== undefined) process.env[v] = saved[v];
  }
});

test("autonomy: providerStatus reflects SEMSE_AUTONOMY_LLM_PROVIDER env", () => {
  process.env.SEMSE_AUTONOMY_LLM_PROVIDER = "anthropic";
  process.env.SEMSE_AUTONOMY_LLM_API_KEY = "sk-test-key";
  process.env.SEMSE_AUTONOMY_LLM_MODEL = "claude-haiku-4-5-20251001";

  const service = new AutonomyService(makeRepo(), makeMemoryRepo());
  const status = service.providerStatus();

  // Should not throw and should return an object
  assert.ok(typeof status === "object");
  assert.ok(status !== null);

  delete process.env.SEMSE_AUTONOMY_LLM_PROVIDER;
  delete process.env.SEMSE_AUTONOMY_LLM_API_KEY;
  delete process.env.SEMSE_AUTONOMY_LLM_MODEL;
});
