import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DocumensoArtifactDownloader } from "../dist/modules/contracts/documenso-artifact-downloader.js";

const pdf = Buffer.from("%PDF-1.7\nsealed\n%%EOF");
const cert = Buffer.from("%PDF-1.7\ncompletion certificate\n%%EOF");
const audit = Buffer.from("%PDF-1.7\naudit trail\n%%EOF");
const scope = {
  tenantId: "tenant_a", connectionId: "conn_a",
  contractId: "contract_a", externalRequestId: "envelope_123",
};
const envelope = {
  id: "envelope_123", status: "COMPLETED",
  envelopeItems: [{ id: "item_123" }],
  recipients: [
    { id: 1, role: "SIGNER", email: "client@example.com",
      signingStatus: "SIGNED", signedAt: "2026-10-01T12:01:00Z" },
    { id: 2, role: "SIGNER", email: "professional@example.com",
      signingStatus: "SIGNED", signedAt: "2026-10-01T12:02:00Z" },
  ],
};
function mock(opts: {
  envelope?: Record<string, unknown>;
  missing?: string;
  badPdf?: string;
  oversized?: string;
  ownerReject?: boolean;
} = {}) {
  const requests: Array<{ path: string; auth?: string; redirect?: string }> = [];
  let ownershipChecks = 0;
  const downloads = new DocumensoArtifactDownloader({
    tenantId: "tenant_a", connectionId: "conn_a",
    instanceOrigin: "https://documenso.test/",
    apiToken: "api_test",
    outbox: {
      async assertOwned(value) {
        ownershipChecks++;
        assert.deepEqual(value, scope);
        if (opts.ownerReject) throw Error("outbox owner mismatch");
      },
    },
    fetchImpl: async (url, init) => {
      const path = new URL(String(url)).pathname + new URL(String(url)).search;
      requests.push({
        path, auth: (init?.headers as Record<string, string>)?.Authorization,
        redirect: init?.redirect,
      });
      if (opts.missing && path.includes(opts.missing)) {
        return new Response("missing", { status: 404 });
      }
      if (opts.oversized && path.includes(opts.oversized)) {
        return new Response(pdf, { headers: { "content-length": String(30 * 1024 * 1024) } });
      }
      if (path === "/api/v2/envelope/envelope_123") {
        return Response.json(opts.envelope ?? envelope);
      }
      let body: Uint8Array = pdf;
      if (path.includes("certificate/download")) body = cert;
      if (path.includes("audit-log/download")) body = audit;
      if (opts.badPdf && path.includes(opts.badPdf)) body = Buffer.from("NOT A PDF");
      return new Response(body, { status: 200 });
    },
  });
  return { downloads, requests, ownershipChecks: () => ownershipChecks };
}

test("downloads only scoped completed Documenso PDF, certificate and audit log", async () => {
  const h = mock();
  const evidence = await h.downloads.download(scope);
  assert.equal(evidence.status, "UNVERIFIED_PROVIDER_BYTES");
  assert.equal(evidence.signedPdfSha256, createHash("sha256").update(pdf).digest("hex"));
  assert.equal(evidence.certificateSha256, createHash("sha256").update(cert).digest("hex"));
  assert.equal(evidence.auditLogSha256, createHash("sha256").update(audit).digest("hex"));
  assert.equal(evidence.recipients.length, 2);
  assert.deepEqual(h.requests.map(r => r.path), [
    "/api/v2/envelope/envelope_123",
    "/api/v2/envelope/item/item_123/download?version=signed",
    "/api/v2/envelope/envelope_123/certificate/download",
    "/api/v2/envelope/envelope_123/audit-log/download",
  ]);
  assert.ok(h.requests.every(r => r.auth === "api_test" && r.redirect === "error"));
  assert.equal(h.ownershipChecks(), 1);
});

test("does not allow client-supplied tenant, connection or envelope injection", async () => {
  for (const patch of [
    { tenantId: "tenant_b" }, { connectionId: "conn_b" },
    { externalRequestId: "../other" }, { contractId: "" },
  ]) {
    const h = mock();
    await assert.rejects(h.downloads.download({ ...scope, ...patch }), /canonical scope/);
    assert.equal(h.requests.length, 0);
    assert.equal(h.ownershipChecks(), 0);
  }
});

test("outbox ownership check prevents every network request on mismatched envelope", async () => {
  const h = mock({ ownerReject: true });
  await assert.rejects(h.downloads.download(scope), /outbox owner mismatch/);
  assert.equal(h.requests.length, 0);
});

test("rejects incomplete or forged envelope and recipient records before downloading", async () => {
  for (const patch of [
    { status: "PENDING" }, { id: "envelope_attack" },
    { envelopeItems: [] }, { envelopeItems: [{ id: "../attacker" }] },
    { recipients: [{ ...envelope.recipients[0] }] },
    { recipients: envelope.recipients.map(x => ({ ...x, signingStatus: "NOT_SIGNED" })) },
    { recipients: envelope.recipients.map(x => ({ ...x, email: "same@example.com" })) },
  ]) {
    const h = mock({ envelope: { ...envelope, ...patch } });
    await assert.rejects(h.downloads.download(scope),
      /not canonical and completed|exactly one|identifier is invalid|exactly two|not fully signed|duplicated signer/);
    assert.equal(h.requests.length, 1);
  }
});

test("refuses missing or malformed signed PDF, certificate and audit trail", async () => {
  for (const part of [
    "download?version=signed",
    "certificate/download",
    "audit-log/download",
  ]) {
    const missing = mock({ missing: part });
    await assert.rejects(missing.downloads.download(scope), /HTTP 404/);
    const malformed = mock({ badPdf: part });
    await assert.rejects(malformed.downloads.download(scope), /not a PDF/);
  }
});

test("download limits prevent oversized evidence bodies", async () => {
  const h = mock({ oversized: "download?version=signed" });
  await assert.rejects(h.downloads.download(scope), /size limit/);
});

test("untrusted origin, tokens and userinfo are rejected before network", () => {
  for (const origin of ["http://documenso.test/", "https://user@documenso.test/",
    "https://documenso.test/path", "https://documenso.test/?token=x"]) {
    assert.throws(() => new DocumensoArtifactDownloader({
      tenantId: "tenant_a", connectionId: "conn_a", instanceOrigin: origin,
      apiToken: "token", outbox: { assertOwned: async () => {} },
    }), /pinned HTTPS origin/);
  }
});
