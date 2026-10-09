import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { ContractsRepository } from "../dist/modules/contracts/contracts.repository.js";

type ContractRow = {
  id: string;
  jobId: string;
  professionalOrgId: string | null;
  clientUserId: string;
  professionalUserId: string;
  termsJson: Record<string, unknown>;
  signedClientAt: Date | null;
  signedProAt: Date | null;
  pdfUrl: string | null;
  documentHash: string | null;
  job: { tenantId: string; clientOrgId: string };
};

function createRepositoryHarness() {
  const contract: ContractRow = {
    id: "ctr_1",
    jobId: "job_1",
    professionalOrgId: "org_pro_1",
    clientUserId: "usr_client_1",
    professionalUserId: "usr_pro_1",
    termsJson: { scope: "Install" },
    signedClientAt: null,
    signedProAt: null,
    pdfUrl: null,
    documentHash: null,
    job: { tenantId: "tenant_1", clientOrgId: "org_client_1" }
  };

  const prisma = {
    contract: {
      async findFirst() {
        return contract;
      },
      async update({ data }: { data: Partial<ContractRow> & { helloSignRequestId?: string; signingUrlClient?: string | null; signingUrlPro?: string | null } }) {
        Object.assign(contract, data);
        return contract;
      },
      async create() {
        return contract;
      }
    },
    job: {
      async findFirst() {
        return { id: "job_1", tenantId: "tenant_1", clientOrgId: "org_client_1" };
      }
    },
    membership: {
      async findFirst() {
        return { orgId: "org_pro_1" };
      }
    }
  };
  const actorContextService = {
    async ensureActorContext() {
      return undefined;
    }
  };
  const reservationsRepository = {
    async findAcceptedByJob() {
      return {
        id: "res_1",
        jobId: "job_1",
        professionalId: "usr_pro_1",
        professionalOrgId: "org_pro_1",
        status: "accepted"
      };
    }
  };

  return {
    contract,
    repository: new ContractsRepository(prisma as never, actorContextService as never, reservationsRepository as never)
  };
}

test("contracts repository rejects signing as another party", async () => {
  const { repository } = createRepositoryHarness();

  await assert.rejects(
    () =>
      repository.sign({
        tenantId: "tenant_1",
        orgId: "org_pro_1",
        userId: "usr_pro_1",
        roles: ["PRO"],
        contractId: "ctr_1",
        signAs: "client",
        documentHash: "abcdefabcdefabcdef",
        pdfUrl: "https://example.com/contract.pdf"
      }),
    ForbiddenException
  );
});

test("contracts repository keeps professional org after signature request metadata update", async () => {
  const { repository } = createRepositoryHarness();

  const updated = await repository.updateSigningInfo({
    contractId: "ctr_1",
    helloSignRequestId: "hs_req_1",
    signingUrlClient: "https://sign.example/client",
    signingUrlPro: "https://sign.example/pro"
  });

  assert.equal(updated.professionalOrgId, "org_pro_1");
});


test("OPS_ADMIN cannot forge client or professional signature even with explicit signAs", async () => {
  const { repository, contract } = createRepositoryHarness();
  const common = {
    tenantId: "tenant_1",
    orgId: "org_ops_1",
    userId: "usr_ops_1",
    roles: ["OPS_ADMIN"],
    contractId: "ctr_1",
    documentHash: "abcdefabcdefabcdef",
  };
  for (const signAs of [undefined, "client", "professional"] as const) {
    await assert.rejects(() => repository.sign({ ...common, signAs }), ForbiddenException);
  }
  assert.equal(contract.signedClientAt, null);
  assert.equal(contract.signedProAt, null);
  assert.equal(contract.documentHash, null);
});

test("OPS_ADMIN membership of the client org is not enough to sign for another user", async () => {
  const { repository, contract } = createRepositoryHarness();
  await assert.rejects(() => repository.sign({
    tenantId: "tenant_1",
    orgId: "org_client_1",
    userId: "usr_ops_1",
    roles: ["OPS_ADMIN"],
    contractId: "ctr_1",
    signAs: "client",
    documentHash: "abcdefabcdefabcdef",
  }), ForbiddenException);
  assert.equal(contract.signedClientAt, null);
});

test("named client and professional can still attest for themselves, including an actual party with OPS_ADMIN role", async () => {
  const { repository, contract } = createRepositoryHarness();
  const client = await repository.sign({
    tenantId: "tenant_1",
    orgId: "org_client_1",
    userId: "usr_client_1",
    roles: ["CLIENT", "OPS_ADMIN"],
    contractId: "ctr_1",
    signAs: "client",
    documentHash: "abcdefabcdefabcdef",
  });
  assert.ok(client.signedClientAt);
  assert.equal(client.signedProAt, undefined);

  const professional = await repository.sign({
    tenantId: "tenant_1",
    orgId: "org_pro_1",
    userId: "usr_pro_1",
    roles: ["PRO"],
    contractId: "ctr_1",
    signAs: "professional",
    documentHash: "abcdefabcdefabcdef",
  });
  assert.ok(professional.signedClientAt);
  assert.ok(professional.signedProAt);
  assert.equal(contract.documentHash, "abcdefabcdefabcdef");
});

test("valid signer cannot override the opposite party's signature role", async () => {
  const { repository, contract } = createRepositoryHarness();
  await assert.rejects(() => repository.sign({
    tenantId: "tenant_1",
    orgId: "org_pro_1",
    userId: "usr_pro_1",
    roles: ["PRO", "OPS_ADMIN"],
    contractId: "ctr_1",
    signAs: "client",
    documentHash: "abcdefabcdefabcdef",
  }), ForbiddenException);
  assert.equal(contract.signedClientAt, null);
  assert.equal(contract.signedProAt, null);
});
