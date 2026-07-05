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
