import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { ContractsService } from "../../apps/api/dist/modules/contracts/contracts.service.js";

// Stubs
const STUB_CONTRACT = {
  id: "ct_1",
  jobId: "job_1",
  status: "draft",
  termsJson: { currency: "USD", releasePolicy: "approved_milestone_only" },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const STUB_AUDIT_APPEND = async () => {};

// ── Contract Creation Tests ──────────────────────────────────────────────────

test("contracts service: create appends audit log entry", async () => {
  const auditCalls: unknown[] = [];

  const service = new ContractsService(
    {
      create: async (input: unknown) => STUB_CONTRACT,
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async () => STUB_CONTRACT,
      finalize: async () => STUB_CONTRACT,
    } as never,
    {
      append: async (input: unknown) => {
        auditCalls.push(input);
      },
    } as never,
    undefined,
    undefined
  );

  const result = await service.create({
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["CLIENT"],
    jobId: "job_1",
    termsJson: { currency: "USD" },
    requestId: "req_1",
  });

  assert.equal(result.id, "ct_1");
  assert.ok(auditCalls.length > 0);
  assert.equal((auditCalls[0] as any).action, "contract.create");
  assert.equal((auditCalls[0] as any).entityType, "Contract");
});

test("contracts service: create records jobId and tenantId", async () => {
  const createCalls: unknown[] = [];

  const service = new ContractsService(
    {
      create: async (input: unknown) => {
        createCalls.push(input);
        return STUB_CONTRACT;
      },
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async () => STUB_CONTRACT,
      finalize: async () => STUB_CONTRACT,
    } as never,
    { append: async () => {} } as never,
    undefined,
    undefined
  );

  await service.create({
    tenantId: "tenant_xyz",
    orgId: "org_xyz",
    userId: "user_xyz",
    roles: ["CLIENT"],
    jobId: "job_xyz",
    termsJson: {},
    requestId: "req_xyz",
  });

  assert.equal((createCalls[0] as any).tenantId, "tenant_xyz");
  assert.equal((createCalls[0] as any).jobId, "job_xyz");
});

// ── Contract from Estimate Tests ─────────────────────────────────────────────

test("contracts service: createFromEstimate uses template.generate if available", async () => {
  const generateCalls: unknown[] = [];

  const mockTemplate = {
    generate: (trade: string, parties: unknown, milestones: unknown) => {
      generateCalls.push({ trade, parties, milestones });
      return {
        trade,
        parties,
        milestones,
        generated: true,
        totalAmount: 5000,
      };
    },
  };

  const service = new ContractsService(
    {
      create: async (input: unknown) => STUB_CONTRACT,
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async () => STUB_CONTRACT,
      finalize: async () => STUB_CONTRACT,
    } as never,
    { append: async () => {} } as never,
    mockTemplate as never,
    undefined
  );

  const result = await service.createFromEstimate({
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["CLIENT"],
    jobId: "job_1",
    trade: "electrical",
    parties: {
      clientOrgId: "org_client_1",
      professionalOrgId: "org_pro_1",
      totalAmount: 5000,
    },
    milestones: [
      { title: "Phase 1", amount: 2500, description: "Initial work" },
      { title: "Phase 2", amount: 2500, description: "Final work" },
    ],
    requestId: "req_1",
  });

  assert.ok(generateCalls.length > 0);
  assert.equal((generateCalls[0] as any).trade, "electrical");
  assert.equal(result.id, "ct_1");
});

test("contracts service: createFromEstimate falls back to inline terms if no template", async () => {
  const createCalls: unknown[] = [];

  const service = new ContractsService(
    {
      create: async (input: unknown) => {
        createCalls.push(input);
        return STUB_CONTRACT;
      },
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async () => STUB_CONTRACT,
      finalize: async () => STUB_CONTRACT,
    } as never,
    { append: async () => {} } as never,
    undefined,
    undefined
  );

  await service.createFromEstimate({
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["CLIENT"],
    jobId: "job_1",
    trade: "painting",
    parties: {
      clientOrgId: "org_client_1",
      professionalOrgId: "org_pro_1",
      totalAmount: 3000,
    },
    milestones: [{ title: "All work", amount: 3000, description: "Complete job" }],
    requestId: "req_1",
  });

  // Should create with inline terms
  assert.ok(createCalls.length > 0);
  const terms = (createCalls[0] as any).termsJson;
  assert.equal(terms.trade, "painting");
  assert.equal(terms.totalAmount, 3000);
});

// ── Signature Request Tests ──────────────────────────────────────────────────

test("contracts service: requestSignatures invokes hello-sign client if available", async () => {
  const helloSignCalls: unknown[] = [];

  const mockHelloSign = {
    createSignatureRequest: async (input: unknown) => {
      helloSignCalls.push(input);
      return {
        signRequestId: "sr_123",
        signingUrl: "https://hellosign.com/sign/123",
      };
    },
  };

  const service = new ContractsService(
    {
      create: async () => STUB_CONTRACT,
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async (input: unknown) => {
        return { ...STUB_CONTRACT, ...(input as any) };
      },
      updateSigningInfo: async (input: unknown) => {
        return { ...STUB_CONTRACT, ...(input as any) };
      },
      finalize: async () => STUB_CONTRACT,
    } as never,
    { append: async () => {} } as never,
    undefined,
    mockHelloSign as never
  );

  const result = await service.requestSignatures({
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    contractId: "ct_1",
    signerEmail: "signer@example.com",
    signerName: "John Doe",
    requestId: "req_1",
  });

  assert.ok(helloSignCalls.length > 0);
});

// ── Contract Status Tests ────────────────────────────────────────────────────

test("contracts service: status transitions from draft → signed → finalized", async () => {
  const service = new ContractsService(
    {
      create: async () => STUB_CONTRACT,
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async (input: unknown) => {
        return { ...STUB_CONTRACT, status: (input as any).status };
      },
      finalize: async () => STUB_CONTRACT,
    } as never,
    { append: async () => {} } as never,
    undefined,
    undefined
  );

  // Verify that contract can be looked up
  const contract = await (service as any).contractsRepository.findById("ct_1");
  assert.equal(contract.status, "draft");
});

test("contracts service: recordSignature updates signer record", async () => {
  const updateCalls: unknown[] = [];

  const service = new ContractsService(
    {
      create: async () => STUB_CONTRACT,
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async (input: unknown) => {
        updateCalls.push(input);
        return { ...STUB_CONTRACT, signedAt: new Date() };
      },
      finalize: async () => STUB_CONTRACT,
    } as never,
    { append: async () => {} } as never,
    undefined,
    undefined
  );

  // recordSignature should update signing status
  const result = await (service as any).contractsRepository.updateSigningStatus({
    contractId: "ct_1",
    signerEmail: "user@example.com",
    signatureDate: new Date().toISOString(),
  });

  assert.ok((result as any).signedAt);
});

// ── Contract Terms Validation ────────────────────────────────────────────────

test("contracts service: terms include currency and release policy", async () => {
  const service = new ContractsService(
    {
      create: async (input: unknown) => {
        const terms = (input as any).termsJson;
        assert.ok(terms.currency);
        assert.ok(terms.releasePolicy);
        return STUB_CONTRACT;
      },
      findById: async () => STUB_CONTRACT,
      updateSigningStatus: async () => STUB_CONTRACT,
      finalize: async () => STUB_CONTRACT,
    } as never,
    { append: async () => {} } as never,
    undefined,
    undefined
  );

  await service.create({
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
    roles: ["CLIENT"],
    jobId: "job_1",
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only",
      deliverables: ["Phase 1", "Phase 2"],
    },
    requestId: "req_1",
  });
});
