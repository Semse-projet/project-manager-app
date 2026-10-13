import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { EvidenceRepository } from "../dist/modules/evidence/evidence.repository.js";

// Exercise the actual Evidence policy and ProjectLink query before EXIF bytes
// are opened; fake storage is deliberately absent in this gate test.
function harness() {
  let projectReads = 0;
  let evidenceWrites = 0;
  const prisma = {
    project: {
      findFirst: async ({where}: {where: Record<string, unknown>}) => {
        projectReads++;
        assert.equal(where.tenantId, "tenantA");
        assert.equal(where.id, "projectA");
        return {
          id: "projectA", jobId: "jobA",
          assignedProOrgId: "orgA",
          job: {clientOrgId: "clientA"},
        };
      },
    },
    $transaction: async () => { evidenceWrites++; throw Error("AUTH MUST NOT WRITE"); },
  };
  const repository = new EvidenceRepository(
    prisma as never,
    {ensureActorContext: async () => undefined} as never,
    {} as never,
  );
  return {repository,get projectReads(){return projectReads;},get evidenceWrites(){return evidenceWrites;}};
}

const input = {
  tenantId: "tenantA",
  orgId: "orgA",
  userId: "workerA",
  roles: ["PRO"],
  requestId: "photo-exif-1",
  projectId: "projectA",
  key: "tenants/tenantA/evidence/original.jpg",
  kind: "PHOTO" as const,
};

test("EXIF policy guard authorizes assigned Org and returns normalized canonical key", async () => {
  const h = harness();
  const key = await h.repository.authorizeOriginalReadForRegistration(input);
  assert.equal(key, input.key);
  assert.equal(h.projectReads, 1);
  assert.equal(h.evidenceWrites, 0);
});

test("EXIF policy guard blocks same-tenant unrelated Org before any storage step", async () => {
  const h = harness();
  await assert.rejects(
    () => h.repository.authorizeOriginalReadForRegistration({...input,orgId:"orgB"}),
    (e: unknown) => !!e && typeof e === "object" && "status" in e && e.status === 403,
  );
  assert.equal(h.projectReads, 1);
  assert.equal(h.evidenceWrites, 0);
});

test("EXIF policy guard rejects tenant namespace mismatch before returning a file key", async () => {
  const h = harness();
  await assert.rejects(
    () => h.repository.authorizeOriginalReadForRegistration({
      ...input, key: "tenants/tenantB/evidence/foreign.jpg",
    }),
    (e: unknown) => !!e && typeof e === "object" && "status" in e && e.status === 400,
  );
  assert.equal(h.evidenceWrites, 0);
});
