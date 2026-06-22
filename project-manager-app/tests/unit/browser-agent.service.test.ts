import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BrowserAgentService, isUrlSafe } from "../../apps/api/dist/modules/browser-agent/browser-agent.service.js";

// ── URL Safety Tests ──────────────────────────────────────────────────────────

test("browser-agent: isUrlSafe allows https public domain", () => {
  assert.equal(isUrlSafe("https://example.com"), true);
  assert.equal(isUrlSafe("https://www.github.com/path"), true);
});

test("browser-agent: isUrlSafe allows http public domain", () => {
  assert.equal(isUrlSafe("http://example.com"), true);
});

test("browser-agent: isUrlSafe blocks localhost variants", () => {
  assert.equal(isUrlSafe("http://localhost"), false);
  assert.equal(isUrlSafe("http://localhost:3000"), false);
  assert.equal(isUrlSafe("http://dev.localhost"), false);
});

test("browser-agent: isUrlSafe blocks loopback IPs", () => {
  assert.equal(isUrlSafe("http://127.0.0.1"), false);
  assert.equal(isUrlSafe("http://127.0.0.2"), false);
  assert.equal(isUrlSafe("http://::1"), false);
  assert.equal(isUrlSafe("http://0.0.0.0"), false);
});

test("browser-agent: isUrlSafe blocks private IPv4 ranges", () => {
  // Class A: 10.x.x.x
  assert.equal(isUrlSafe("http://10.0.0.1"), false);
  assert.equal(isUrlSafe("http://10.255.255.255"), false);

  // Class B: 172.16.0.0/12
  assert.equal(isUrlSafe("http://172.16.0.1"), false);
  assert.equal(isUrlSafe("http://172.31.255.255"), false);

  // Class C: 192.168.x.x
  assert.equal(isUrlSafe("http://192.168.1.1"), false);
  assert.equal(isUrlSafe("http://192.168.0.1"), false);

  // Link-local: 169.254.x.x
  assert.equal(isUrlSafe("http://169.254.1.1"), false);

  // Shared space: 100.64.0.0/10
  assert.equal(isUrlSafe("http://100.64.0.1"), false);
  assert.equal(isUrlSafe("http://100.127.255.255"), false);
});

test("browser-agent: isUrlSafe blocks IPv6 private prefixes", () => {
  assert.equal(isUrlSafe("http://fe80::1"), false);
  assert.equal(isUrlSafe("http://fc00::1"), false);
  assert.equal(isUrlSafe("http://fd00::1"), false);
});

test("browser-agent: isUrlSafe rejects non-http protocols", () => {
  assert.equal(isUrlSafe("ftp://example.com"), false);
  assert.equal(isUrlSafe("file:///etc/passwd"), false);
  assert.equal(isUrlSafe("javascript:void(0)"), false);
});

test("browser-agent: isUrlSafe handles malformed URLs gracefully", () => {
  assert.equal(isUrlSafe("not a url"), false);
  assert.equal(isUrlSafe(""), false);
  assert.equal(isUrlSafe("://invalid"), false);
});

// ── Service Tests ────────────────────────────────────────────────────────────

const STUB_RUN = {
  id: "ar_123",
  status: "pending",
  agentType: "browser-agent",
  input: { url: "https://example.com" },
  output: null,
  createdAt: new Date(),
  endedAt: null,
};

const STUB_RUN_COMPLETED = {
  id: "ar_124",
  status: "completed",
  agentType: "browser-agent",
  input: {
    url: "https://example.com",
    projectId: "proj_1",
    includeAiSummary: true,
  },
  output: {
    result: {
      success: true,
      finalUrl: "https://example.com",
      title: "Example",
      status: 200,
      severity: "low",
      loadTimeMs: 250,
      consoleErrors: [],
      networkFailures: [],
      visibleTextSample: "Welcome to example.com",
      screenshotBase64: "data:image/png;base64,abc123",
    },
  },
  createdAt: new Date("2026-06-22T10:00:00Z"),
  endedAt: new Date("2026-06-22T10:00:05Z"),
};

test("browser-agent service: createInspection rejects unsafe URLs", async () => {
  const service = new BrowserAgentService(
    {} as never,
    {
      create: async () => STUB_RUN,
      detail: async () => STUB_RUN,
    } as never,
    {} as never,
    {} as never
  );

  const context = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["user"],
    requestId: "req_1",
  };

  try {
    await service.createInspection(
      { url: "http://localhost:3000" },
      context
    );
    assert.fail("Should have thrown BadRequestException");
  } catch (err: any) {
    assert.ok(err.message.includes("blocked or unsafe"));
  }
});

test("browser-agent service: createInspection accepts safe URLs and creates run", async () => {
  const createCalls: unknown[] = [];
  const service = new BrowserAgentService(
    {} as never,
    {
      create: async (input: unknown) => {
        createCalls.push(input);
        return STUB_RUN;
      },
      detail: async () => STUB_RUN,
    } as never,
    {} as never,
    {} as never
  );

  const context = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["user"],
    requestId: "req_1",
  };

  const result = await service.createInspection(
    { url: "https://example.com", includeScreenshot: true },
    context
  );

  assert.equal(result.runId, "ar_123");
  assert.equal(result.status, "pending");
  assert.ok(result.correlationId);
  assert.ok(createCalls[0]?.agentType === "browser-agent");
  assert.ok((createCalls[0] as any)?.input?.url === "https://example.com");
});

test("browser-agent service: createInspection sets default includeScreenshot to true", async () => {
  const createCalls: unknown[] = [];
  const service = new BrowserAgentService(
    {} as never,
    {
      create: async (input: unknown) => {
        createCalls.push(input);
        return STUB_RUN;
      },
      detail: async () => STUB_RUN,
    } as never,
    {} as never,
    {} as never
  );

  const context = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["user"],
    requestId: "req_1",
  };

  await service.createInspection({ url: "https://example.com" }, context);

  const input = (createCalls[0] as any)?.input;
  assert.equal(input?.includeScreenshot, true);
  assert.equal(input?.includeText, true);
  assert.equal(input?.includeAiSummary, true);
});

test("browser-agent service: getInspectionResult returns pending run status", async () => {
  const service = new BrowserAgentService(
    {} as never,
    {
      create: async () => STUB_RUN,
      detail: async () => STUB_RUN,
    } as never,
    {} as never,
    {} as never
  );

  const context = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
  };

  const result = await service.getInspectionResult("ar_123", context);
  assert.equal(result.status, "pending");
  assert.equal(result.runId, "ar_123");
  assert.ok(!result.success);
});

test("browser-agent service: getInspectionResult returns completed inspection data", async () => {
  const service = new BrowserAgentService(
    {
      agentRun: {
        update: async () => STUB_RUN_COMPLETED,
      },
    } as never,
    {
      create: async () => STUB_RUN,
      detail: async () => STUB_RUN_COMPLETED,
    } as never,
    {} as never,
    {} as never
  );

  const context = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
  };

  const result = await service.getInspectionResult("ar_124", context);
  assert.equal(result.status, "completed");
  assert.equal(result.success, true);
  assert.equal(result.title, "Example");
  assert.equal(result.pageStatus, 200);
  assert.equal(result.severity, "low");
  assert.equal(result.loadTimeMs, 250);
});

test("browser-agent service: getInspectionResult throws NotFoundException for missing run", async () => {
  const service = new BrowserAgentService(
    {} as never,
    {
      create: async () => STUB_RUN,
      detail: async () => null,
    } as never,
    {} as never,
    {} as never
  );

  const context = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
  };

  try {
    await service.getInspectionResult("ar_nonexistent", context);
    assert.fail("Should have thrown NotFoundException");
  } catch (err: any) {
    assert.ok(err.message.includes("not found"));
  }
});

test("browser-agent service: createInspection includes projectId and milestoneId in run input", async () => {
  const createCalls: unknown[] = [];
  const service = new BrowserAgentService(
    {} as never,
    {
      create: async (input: unknown) => {
        createCalls.push(input);
        return STUB_RUN;
      },
      detail: async () => STUB_RUN,
    } as never,
    {} as never,
    {} as never
  );

  const context = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["user"],
    requestId: "req_1",
  };

  await service.createInspection(
    {
      url: "https://example.com",
      projectId: "proj_1",
      milestoneId: "ms_1",
    },
    context
  );

  const input = (createCalls[0] as any)?.input;
  assert.equal(input?.projectId, "proj_1");
  assert.equal(input?.milestoneId, "ms_1");
});
