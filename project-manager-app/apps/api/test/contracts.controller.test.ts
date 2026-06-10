import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { ContractsController } from "../dist/modules/contracts/contracts.controller.js";

function createController() {
  const calls: Array<Record<string, unknown>> = [];
  const service = {
    async create(input: Record<string, unknown>) {
      calls.push({ method: "create", input });
      return {
        id: "ctr_1",
        jobId: String(input.jobId ?? "job_1"),
        clientOrgId: "org_client_1",
        professionalOrgId: "org_pro_1",
        signedClientAt: null,
        signedProAt: null,
        documentHash: null,
        pdfUrl: null,
        termsJson: input.termsJson ?? {},
      };
    },
    async current(input: Record<string, unknown>) {
      calls.push({ method: "current", input });
      return {
        id: "ctr_1",
        jobId: String(input.jobId ?? "job_1"),
        clientOrgId: "org_client_1",
        professionalOrgId: "org_pro_1",
        signedClientAt: "2026-06-09T10:00:00.000Z",
        signedProAt: null,
        documentHash: "abcdefabcdefabcdef",
        pdfUrl: null,
        termsJson: {},
      };
    },
    async byId(input: Record<string, unknown>) {
      calls.push({ method: "byId", input });
      return {
        id: String(input.contractId ?? "ctr_1"),
        jobId: "job_1",
        clientOrgId: "org_client_1",
        professionalOrgId: "org_pro_1",
        signedClientAt: "2026-06-09T10:00:00.000Z",
        signedProAt: null,
        documentHash: "abcdefabcdefabcdef",
        pdfUrl: null,
        termsJson: {},
      };
    },
    async sign(input: Record<string, unknown>) {
      calls.push({ method: "sign", input });
      return {
        id: String(input.contractId ?? "ctr_1"),
        jobId: "job_1",
        clientOrgId: "org_client_1",
        professionalOrgId: "org_pro_1",
        signedClientAt: "2026-06-09T10:00:00.000Z",
        signedProAt: "2026-06-09T10:05:00.000Z",
        documentHash: String(input.documentHash ?? "abcdefabcdefabcdef"),
        pdfUrl: String(input.pdfUrl ?? "https://example.com/contract.pdf"),
        termsJson: {},
      };
    },
    async createFromEstimate(input: Record<string, unknown>) {
      calls.push({ method: "createFromEstimate", input });
      return {
        id: "ctr_est_1",
        jobId: String(input.jobId ?? "job_1"),
        clientOrgId: "org_client_1",
        professionalOrgId: "org_pro_1",
        signedClientAt: null,
        signedProAt: null,
        documentHash: null,
        pdfUrl: null,
        termsJson: { trade: input.trade ?? "general" },
      };
    },
    async requestSignatures(input: Record<string, unknown>) {
      calls.push({ method: "requestSignatures", input });
      return {
        contract: {
          id: String(input.contractId ?? "ctr_1"),
          jobId: "job_1",
          clientOrgId: "org_client_1",
          professionalOrgId: "org_pro_1",
          signedClientAt: null,
          signedProAt: null,
          documentHash: null,
          pdfUrl: null,
          termsJson: {},
        },
        helloSignRequestId: "hs_req_1",
        signingUrlClient: "https://sign.example/client",
        signingUrlPro: "https://sign.example/pro",
      };
    },
  } as never;

  return { controller: new ContractsController(service), calls };
}

test("contracts controller declares permissions and wraps visible payloads", async () => {
  const expectations: Array<[string, string]> = [
    ["create", "contracts:create"],
    ["current", "contracts:read"],
    ["byId", "contracts:read"],
    ["sign", "contracts:sign"],
    ["createFromEstimate", "contracts:create"],
    ["requestSignatures", "contracts:create"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, ContractsController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }

  const { controller, calls } = createController();
  const actor = {
    headers: { "x-request-id": "req_ctr_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_client_1", userId: "usr_client_1", roles: ["CLIENT"] },
  };

  const created = await controller.create(actor as never, "job_1", { termsJson: { scope: "General construction" } });
  const current = await controller.current(actor as never, "job_1");
  const signed = await controller.sign(actor as never, "ctr_1", { documentHash: "abcdefabcdefabcdef", pdfUrl: "https://example.com/contract.pdf", signAs: "client" });
  const fromEstimate = await controller.createFromEstimate(actor as never, "job_1", { trade: "electrical", parties: { clientName: "Client", proName: "Pro", totalAmount: 1000 }, milestones: [] });
  const requested = await controller.requestSignatures(actor as never, "ctr_1", { signers: [{ name: "Client", email: "client@example.com", role: "client" }] });

  assert.equal(created.requestId, "req_ctr_1");
  assert.equal(created.data.signatureStatus, "PENDING_SIGNATURE");
  assert.equal(current.data.signatureStatus, "PARTIALLY_SIGNED");
  assert.equal(signed.data.signatureStatus, "FULLY_SIGNED");
  assert.equal(fromEstimate.data.signatureStatus, "PENDING_SIGNATURE");
  assert.equal(requested.data.contract.signatureStatus, "PENDING_SIGNATURE");
  assert.equal(requested.data.helloSignRequestId, "hs_req_1");
  assert.ok(calls.some((call) => call.method === "create"));
  assert.ok(calls.some((call) => call.method === "createFromEstimate"));
  assert.ok(calls.some((call) => call.method === "requestSignatures"));
});
