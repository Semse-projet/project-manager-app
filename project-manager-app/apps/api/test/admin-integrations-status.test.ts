import assert from "node:assert/strict";
import test from "node:test";
import { adminSettingsSchema } from "@semse/schemas";
import {
  AdminIntegrationsService,
  resolveAdminIntegrationState,
} from "../dist/modules/admin/admin-integrations.service.js";
import { AdminService } from "../dist/modules/admin/admin.service.js";

function createAdminServiceWithStore(initial: Record<string, unknown>) {
  let stored: Record<string, unknown> = initial;
  const prisma = {
    tenantSettings: {
      findUnique: async () => ({ settingsJson: stored }),
      upsert: async ({ update }: { update: { settingsJson: Record<string, unknown> } }) => {
        stored = update.settingsJson;
      },
    },
    auditLog: { create: async () => ({}) },
  };
  return { service: new AdminService(prisma as never), read: () => stored };
}

const VERIFIED_CHECK = { state: "VERIFIED", checkedAt: "2026-09-25T00:00:00.000Z", message: "ok" } as const;

test("admin integration settings remain backward compatible", () => {
  const parsed = adminSettingsSchema.parse({ integrations: { openai: true, github: false } });
  assert.deepEqual(parsed.integrations.checks, {});
});

test("admin integration status distinguishes the five trust states", () => {
  assert.equal(resolveAdminIntegrationState({ simulation: true, missingVariables: [] }), "SIMULATION");
  assert.equal(resolveAdminIntegrationState({ simulation: false, missingVariables: ["TOKEN"] }), "UNCONFIGURED");
  assert.equal(resolveAdminIntegrationState({ simulation: false, missingVariables: [] }), "CONFIGURED_UNVERIFIED");
  assert.equal(resolveAdminIntegrationState({
    simulation: false,
    missingVariables: [],
    check: { state: "VERIFIED", checkedAt: "2026-09-25T00:00:00.000Z", message: "ok" },
  }), "VERIFIED");
  assert.equal(resolveAdminIntegrationState({
    simulation: false,
    missingVariables: [],
    check: { state: "ERROR", checkedAt: "2026-09-25T00:00:00.000Z", message: "failed" },
  }), "ERROR");
});

test("missing configuration invalidates a historical verification", () => {
  const state = resolveAdminIntegrationState({
    simulation: false,
    missingVariables: ["TOKEN"],
    check: { state: "VERIFIED", checkedAt: "2026-09-25T00:00:00.000Z", message: "ok" },
  });
  assert.equal(state, "UNCONFIGURED");
});

test("runtime status separates simulation from configured but unverified", async () => {
  const settings = adminSettingsSchema.parse({});
  const variables: Record<string, string> = {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_private",
    STRIPE_WEBHOOK_SECRET: "whsec_private",
  };
  const service = new AdminIntegrationsService(
    { getSettings: async () => settings } as never,
    { get: (name: string) => variables[name] } as never,
  );
  const byId = Object.fromEntries((await service.list("tenant-test")).map((item) => [item.id, item]));
  assert.equal(byId.openai.state, "UNCONFIGURED");
  assert.equal(byId.github.state, "SIMULATION");
  assert.equal(byId.whatsapp.state, "SIMULATION");
  assert.equal(byId.stripe.state, "CONFIGURED_UNVERIFIED");
  assert.equal(byId.hellosign.state, "SIMULATION");
  assert.deepEqual(byId.stripe.missingVariables, []);
  assert.doesNotMatch(JSON.stringify(byId), /sk_test_private|whsec_private/);
});

test("verification stores a sanitized read-only success result", async () => {
  const settings = adminSettingsSchema.parse({});
  let saved = settings;
  const apiKey = "openai-private-value";
  const service = new AdminIntegrationsService(
    {
      getSettings: async () => saved,
      recordIntegrationCheck: async (_tenantId: string, id: string, check: Record<string, unknown>) => {
        saved = adminSettingsSchema.parse({
          ...saved,
          integrations: { ...saved.integrations, checks: { ...saved.integrations.checks, [id]: check } },
        });
        return saved;
      },
    } as never,
    { get: (name: string) => name === "OPENAI_API_KEY" ? apiKey : undefined } as never,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/models");
    assert.equal(init?.method, "GET");
    assert.equal((init?.headers as Record<string, string>).authorization, `Bearer ${apiKey}`);
    return new Response(null, { status: 200 });
  };

  try {
    const status = await service.verify("tenant-test", "openai", {
      userId: "admin-test",
      requestId: "request-test",
    });
    assert.equal(status.state, "VERIFIED");
    assert.ok(status.checkedAt);
    assert.doesNotMatch(JSON.stringify(status), /openai-private-value/);
    assert.equal(saved.integrations.checks.openai?.state, "VERIFIED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("settings writes keep server-owned verification history", async () => {
  const { service, read } = createAdminServiceWithStore({
    integrations: { openai: false, github: false, checks: { stripe: VERIFIED_CHECK } },
  });
  // A stale client copy (loaded before the verification) must not erase it.
  await service.updateSettings(
    "tenant-test",
    { integrations: { openai: true, github: false, checks: {} } },
    { userId: "admin-test", requestId: "request-test" },
  );
  const next = adminSettingsSchema.parse(read());
  assert.equal(next.integrations.openai, true);
  assert.deepEqual(next.integrations.checks.stripe, VERIFIED_CHECK);
});

test("settings writes cannot forge a verification", async () => {
  const { service, read } = createAdminServiceWithStore({});
  await service.updateSettings(
    "tenant-test",
    { integrations: { openai: false, github: false, checks: { stripe: VERIFIED_CHECK } } },
    { userId: "admin-test", requestId: "request-test" },
  );
  assert.deepEqual(adminSettingsSchema.parse(read()).integrations.checks, {});
});

test("recordIntegrationCheck persists a single provider result", async () => {
  const { service, read } = createAdminServiceWithStore({
    integrations: { openai: true, github: false, checks: { stripe: VERIFIED_CHECK } },
  });
  const errorCheck = { state: "ERROR", checkedAt: "2026-09-26T00:00:00.000Z", message: "HTTP 401" } as const;
  await service.recordIntegrationCheck("tenant-test", "openai", errorCheck, {
    userId: "admin-test",
    requestId: "request-test",
  });
  const next = adminSettingsSchema.parse(read());
  assert.equal(next.integrations.openai, true);
  assert.deepEqual(next.integrations.checks, { stripe: VERIFIED_CHECK, openai: errorCheck });
});
