import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ContributorProgramService } from "../dist/modules/contributor-program/contributor-program.service.js";

test("OPS reviewer attribution reaches atomic Prometeo delete on rejected promotion", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const repo = {
    async findObservationById() {
      return { id: "observation-A", tenantId: "tenant-A", ragDocumentId: "document-A",
        submission: { mission: { isDemo: false } } };
    },
    async setObservationPromotion() {
      throw new Error("STOP_AFTER_DELETE");
    },
  };
  const prometeo = {
    async deleteDocument(input: Record<string, unknown>) {
      calls.push(input);
    },
  };
  const svc = new ContributorProgramService(
    repo as never, {} as never, {} as never, prometeo as never, {} as never,
  );
  await assert.rejects(
    () => svc.rejectObservationPromotion({
      tenantId: "tenant-A", orgId: "ops-org", userId: "reviewer-A",
      roles: ["OPS_ADMIN"], requestId: "req-A",
    }, "observation-A", { reason: "Invalid field observation" }),
    /STOP_AFTER_DELETE/,
  );
  assert.deepEqual(calls, [{
    tenantId: "tenant-A", id: "document-A",
    actorUserId: "reviewer-A", requestId: "req-A",
  }], "document deletion and cascaded grant-revocation audits require authenticated actor attribution");
});
