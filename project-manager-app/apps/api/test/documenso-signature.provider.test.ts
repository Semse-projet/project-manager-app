import test from "node:test";
import assert from "node:assert/strict";
import { DocumensoSignatureProvider } from "../dist/modules/contracts/documenso-signature.provider.js";

const pdf = new Uint8Array(Buffer.from("%PDF-1.7\n%%EOF"));
const signer = {
  name: "Test Signer",
  email: "signer@example.com",
  role: "client" as const,
  fields: [{ page: 1, positionX: 10, positionY: 70, width: 25, height: 8 }],
};
const input = {
  tenantId: "tenant_a",
  connectionId: "connection_a",
  contractId: "contract_1",
  idempotencyKey: "request_1",
  title: "Test Agreement",
  documentText: "Not used for Documenso",
  documentPdf: pdf,
  signers: [signer],
};

function config(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; url: string; init?: RequestInit }> = [];
  const steps: string[] = [];
  const outbox = {
    async reserve() { steps.push("reserve"); },
    async created() { steps.push("created"); },
    async sent() { steps.push("sent"); },
    async assertOwned() { steps.push("owned"); },
  };
  const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", url: String(url), init });
    if (String(url).endsWith("/envelope/create")) {
      return Response.json({ id: "envelope_123" });
    }
    if (String(url).endsWith("/envelope/distribute")) {
      return Response.json({ id: "envelope_123", success: true });
    }
    return Response.json({
      id: "envelope_123", status: "PENDING", recipients: [],
    });
  };
  return {
    calls,
    steps,
    options: {
      tenantId: "tenant_a",
      connectionId: "connection_a",
      instanceUrl: "https://documenso.example/",
      apiToken: "api_test-only",
      webhookSecret: "test-webhook-secret",
      outbox,
      async assertSendAuthorized() { steps.push("authorize"); },
      async assertStatusAuthorized() { steps.push("authorizeRead"); },
      fetchImpl,
      ...overrides,
    },
  };
}

test("Documenso fails closed on missing approval and never reaches its network", async () => {
  const c = config({
    async assertSendAuthorized() { throw new Error("approval denied"); },
  });
  const adapter = new DocumensoSignatureProvider(c.options);
  await assert.rejects(adapter.createRequest(input), /approval denied/);
  assert.equal(c.calls.length, 0);
  assert.deepEqual(c.steps, []);
});

test("Documenso rejects cross-tenant and non-PDF requests without network access", async () => {
  const c = config();
  const adapter = new DocumensoSignatureProvider(c.options);
  await assert.rejects(adapter.createRequest({ ...input, tenantId: "tenant_b" }), /tenant-scoped PDF/);
  await assert.rejects(adapter.createRequest({ ...input, connectionId: "connection_b" }), /tenant-scoped PDF/);
  await assert.rejects(adapter.createRequest({ ...input, documentPdf: undefined }), /tenant-scoped PDF/);
  await assert.rejects(adapter.createRequest({
    ...input, signers: [{ ...signer, fields: [] }],
  }), /signer positions/);
  assert.equal(c.calls.length, 0);
});

test("Documenso creates real V2 envelope before authorized distribution, preserving outbox ordering", async () => {
  const c = config();
  const adapter = new DocumensoSignatureProvider(c.options);
  const receipt = await adapter.createRequest(input);
  assert.deepEqual(receipt, {
    provider: "documenso",
    externalRequestId: "envelope_123",
    status: "sent",
    completedDocumentRef: null,
  });
  assert.deepEqual(c.steps, ["authorize", "reserve", "created", "authorize", "sent"]);
  assert.equal(c.calls.length, 2);
  assert.ok(c.calls[0]?.url.endsWith("/api/v2/envelope/create"));
  assert.ok(c.calls[1]?.url.endsWith("/api/v2/envelope/distribute"));
  assert.equal(c.calls[0]?.init?.headers && (c.calls[0].init.headers as Record<string, string>).Authorization, "api_test-only");
  const form = c.calls[0]?.init?.body;
  assert.ok(form instanceof FormData);
  const payload = JSON.parse(String(form.get("payload")));
  assert.equal(payload.type, "DOCUMENT");
  assert.match(payload.externalId, /^semse-[a-f0-9]{64}$/);
  assert.equal(payload.recipients[0].fields[0].type, "SIGNATURE");
  assert.ok(form.get("files") instanceof Blob);
});

test("Documenso does not distribute without a persisted draft", async () => {
  const c = config({
    outbox: {
      async reserve() {},
      async created() { throw new Error("db unavailable"); },
      async sent() {},
      async assertOwned() {},
    },
  });
  const adapter = new DocumensoSignatureProvider(c.options);
  await assert.rejects(adapter.createRequest(input), /db unavailable/);
  assert.equal(c.calls.length, 1);
});

test("Documenso provider errors propagate rather than generating mock signing requests", async () => {
  const c = config({
    fetchImpl: async () => new Response("denied", { status: 401 }),
  });
  const adapter = new DocumensoSignatureProvider(c.options);
  await assert.rejects(adapter.createRequest(input), /HTTP 401/);
  assert.equal(c.steps.includes("sent"), false);
});

test("Documenso status mapping never fabricates signed-document evidence", async () => {
  let status = "PENDING";
  let recipients = [{ signingStatus: "SIGNED" }];
  const c = config({
    fetchImpl: async () => Response.json({
      id: "envelope_123", status, recipients,
      completedAt: status === "COMPLETED" ? "2026-10-08T13:00:00.000Z" : null,
    }),
  });
  const adapter = new DocumensoSignatureProvider(c.options);
  assert.deepEqual(await adapter.getRequestStatus("envelope_123", { tenantId: "tenant_a", connectionId: "connection_a", contractId: "contract_1" }), {
    status: "partially_signed", verifiedAt: null, completedDocumentRef: null,
  });
  status = "COMPLETED";
  assert.deepEqual(await adapter.getRequestStatus("envelope_123", { tenantId: "tenant_a", connectionId: "connection_a", contractId: "contract_1" }), {
    status: "completed", verifiedAt: "2026-10-08T13:00:00.000Z", completedDocumentRef: null,
  });
  status = "DRAFT"; recipients = [];
  await assert.rejects(adapter.getRequestStatus("envelope_123", { tenantId: "tenant_a", connectionId: "connection_a", contractId: "contract_1" }), /draft or has an unknown status/);
});

test("Documenso webhook secret must be present and match in constant time", () => {
  const c = config();
  const adapter = new DocumensoSignatureProvider(c.options);
  assert.equal(adapter.verifyWebhookSecret("test-webhook-secret"), true);
  assert.equal(adapter.verifyWebhookSecret("test-webhook-secrex"), false);
  assert.equal(adapter.verifyWebhookSecret(null), false);
  assert.throws(() => new DocumensoSignatureProvider({
    ...c.options, instanceUrl: "http://documenso.example/",
  }), /HTTPS/);
});

test("Documenso status lookups require tenant authorization and outbox ownership", async () => {
  const c = config();
  const adapter = new DocumensoSignatureProvider(c.options);
  await assert.rejects(adapter.getRequestStatus("envelope_123", {
    tenantId: "tenant_b", connectionId: "connection_a", contractId: "contract_1",
  }), /scope mismatch/);
  assert.equal(c.calls.length, 0);
  await assert.rejects(adapter.getRequestStatus("envelope_123", {
    tenantId: "tenant_a", connectionId: "connection_b", contractId: "contract_1",
  }), /scope mismatch/);
  assert.equal(c.calls.length, 0);

  const unauthorized = config({
    async assertStatusAuthorized() { throw new Error("forbidden"); },
  });
  const locked = new DocumensoSignatureProvider(unauthorized.options);
  await assert.rejects(locked.getRequestStatus("envelope_123", {
    tenantId: "tenant_a",
  connectionId: "connection_a", contractId: "contract_1",
  }), /forbidden/);
  assert.equal(unauthorized.calls.length, 0);

  const unowned = config({
    outbox: {
      async reserve() {},
      async created() {},
      async sent() {},
      async assertOwned() { throw new Error("not an owned envelope"); },
    },
  });
  const scoped = new DocumensoSignatureProvider(unowned.options);
  await assert.rejects(scoped.getRequestStatus("envelope_123", {
    tenantId: "tenant_a",
  connectionId: "connection_a", contractId: "contract_1",
  }), /not an owned envelope/);
  assert.equal(unowned.calls.length, 0);
});

test("Documenso refuses duplicate reservation before any second network effect", async () => {
  let reserved = false;
  const c = config({
    outbox: {
      async reserve() {
        if (reserved) throw new Error("duplicate signature request");
        reserved = true;
      },
      async created() {},
      async sent() {},
      async assertOwned() {},
    },
  });
  const adapter = new DocumensoSignatureProvider(c.options);
  await adapter.createRequest(input);
  await assert.rejects(adapter.createRequest(input), /duplicate signature request/);
  assert.equal(c.calls.length, 2);
});

test("Documenso reports webhook verification as unavailable until a real receiver exists", () => {
  const c = config();
  const adapter = new DocumensoSignatureProvider(c.options);
  assert.equal(adapter.capabilities.verifiedWebhooks, false);
});
