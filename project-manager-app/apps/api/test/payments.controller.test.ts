import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { PaymentsController } from "../dist/modules/payments/payments.controller.js";

function createController() {
  const calls: Array<Record<string, unknown>> = [];
  const service = {
    async getWorkerPayoutMethod(input: Record<string, unknown>) {
      calls.push({ method: "getWorkerPayoutMethod", input });
      return { type: "bank_account" };
    },
    async saveWorkerPayoutMethod(input: Record<string, unknown>) {
      calls.push({ method: "saveWorkerPayoutMethod", input });
      return { saved: true, type: input.type };
    },
    async deposit(input: Record<string, unknown>) {
      calls.push({ method: "deposit", input });
      return {
        escrow: { id: "esc_1", tenantId: String(input.tenantId ?? "tenant_1"), jobId: "job_1", status: "active", totalAmount: 1000, currency: "USD" },
        transaction: { id: "txn_1", tenantId: String(input.tenantId ?? "tenant_1"), escrowId: "esc_1", projectId: "proj_1", type: "deposit", amount: 1000, status: "succeeded", createdAt: "2026-06-09T12:00:00.000Z" },
      };
    },
    async depositByJob(input: Record<string, unknown>) {
      calls.push({ method: "depositByJob", input });
      return {
        escrow: { id: "esc_1", tenantId: String(input.tenantId ?? "tenant_1"), jobId: String(input.jobId ?? "job_1"), status: "held", totalAmount: 1000, currency: "USD" },
        transaction: { id: "txn_1", tenantId: String(input.tenantId ?? "tenant_1"), escrowId: "esc_1", projectId: "proj_1", type: "deposit", amount: 1000, status: "succeeded", createdAt: "2026-06-09T12:00:00.000Z" },
        contract: { id: "ctr_1", tenantId: String(input.tenantId ?? "tenant_1"), jobId: String(input.jobId ?? "job_1"), clientOrgId: "org_client_1", professionalOrgId: "org_pro_1", clientUserId: "usr_client_1", professionalUserId: "usr_pro_1", termsJson: {}, signedClientAt: "2026-06-09T10:00:00.000Z" },
      };
    },
    async paymentsByJob(input: Record<string, unknown>) {
      calls.push({ method: "paymentsByJob", input });
      return [{ id: "txn_1", type: "deposit", status: "succeeded", createdAt: "2026-06-09T12:00:00.000Z" }];
    },
    async paymentReadinessByJob(input: Record<string, unknown>) {
      calls.push({ method: "paymentReadinessByJob", input });
      return { ready: true };
    },
    async escrowByJob(input: Record<string, unknown>) {
      calls.push({ method: "escrowByJob", input });
      return {
        escrow: { id: "esc_1", tenantId: String(input.tenantId ?? "tenant_1"), jobId: String(input.jobId ?? "job_1"), status: "active", totalAmount: 1000, currency: "USD" },
        contract: { id: "ctr_1", tenantId: String(input.tenantId ?? "tenant_1"), jobId: String(input.jobId ?? "job_1"), clientOrgId: "org_client_1", professionalOrgId: "org_pro_1", clientUserId: "usr_client_1", professionalUserId: "usr_pro_1", termsJson: {} },
      };
    },
    paymentProviderReadiness() {
      calls.push({ method: "paymentProviderReadiness" });
      return {
        configuredDefaultProvider: "stripe",
        availableProviders: ["mock", "stripe"],
        stripe: { secretConfigured: true, webhookSecretConfigured: true, ready: true },
        mode: "live",
        ready: true,
        warnings: [],
      };
    },
    async release(input: Record<string, unknown>) {
      calls.push({ method: "release", input });
      return { transaction: { id: "txn_rel", tenantId: String(input.tenantId ?? "tenant_1"), escrowId: "esc_1", projectId: "proj_1", type: "release", amount: 500, status: "succeeded", createdAt: "2026-06-09T12:00:00.000Z" } };
    },
    async refund(input: Record<string, unknown>) {
      calls.push({ method: "refund", input });
      return {
        escrow: { id: "esc_1", tenantId: String(input.tenantId ?? "tenant_1"), jobId: "job_1", status: "active", totalAmount: 1000, currency: "USD" },
        transaction: { id: "txn_ref", tenantId: String(input.tenantId ?? "tenant_1"), escrowId: "esc_1", projectId: "proj_1", type: "refund", amount: 250, status: "succeeded", createdAt: "2026-06-09T12:00:00.000Z" },
      };
    },
    webhook() {
      calls.push({ method: "webhook" });
      return { received: true };
    },
  } as never;

  return { controller: new PaymentsController(service), calls };
}

test("payments controller declares permissions", () => {
  const expectations: Array<[string, string]> = [
    ["workerPayoutMethod", "workers:read"],
    ["saveWorkerPayoutMethod", "workers:write"],
    ["deposit", "projects:financials:write"],
    ["fundByJob", "projects:financials:write"],
    ["listByJob", "jobs:read"],
    ["paymentReadinessByJob", "jobs:read"],
    ["escrowByJob", "projects:financials:read"],
    ["providerReadiness", "projects:financials:read"],
    ["release", "projects:financials:write"],
    ["refund", "projects:financials:write"],
    ["webhook", undefined as unknown as string],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PaymentsController.prototype[methodName]);
    if (permission) {
      assert.deepEqual(metadata, [permission]);
    } else {
      assert.equal(metadata, undefined);
    }
  }
});

test("payments controller wraps visible escrow/contract/transaction payloads", async () => {
  const { controller, calls } = createController();
  const actor = {
    headers: { "x-request-id": "req_pay_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_client_1", userId: "usr_client_1", roles: ["CLIENT"] },
  };

  const funded = await controller.fundByJob(actor as never, "job_1", {
    amount: 1000,
    currency: "USD",
    provider: "stripe",
    methodType: "card",
  });

  const escrow = await controller.escrowByJob(actor as never, "job_1");
  const providerReadiness = await controller.providerReadiness(actor as never);
  const listed = await controller.listByJob(actor as never, "job_1");

  assert.equal(funded.requestId, "req_pay_1");
  assert.equal(funded.data.escrow.status, "HELD");
  assert.equal(funded.data.escrow.statusRaw, "held");
  assert.equal(funded.data.contract.signatureStatus, "PARTIALLY_SIGNED");
  assert.equal(escrow.data.escrow.status, "ACTIVE");
  assert.equal(providerReadiness.data.configuredDefaultProvider, "stripe");
  assert.equal(providerReadiness.data.ready, true);
  assert.equal(listed.data[0]?.status, "SUCCEEDED");
  assert.equal(calls[0]?.method, "depositByJob");
});
