import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCopilotRagScope } from "../dist/modules/agents/harnesses/project-copilot.harness.js";

test("authorized OPS_ADMIN receives explicit tenant-admin RAG sentinel for the selected project", () => {
  const scope = resolveCopilotRagScope({
    tenantId: "tenant-A", orgId: "ops-org", userId: "ops-A",
    roles: ["OPS_ADMIN"],
  }, "project-A");
  assert.equal(scope, null, "null sentinel must preserve authorized ops RAG without claiming another org");
});

test("non-admin actors remain strictly org/project scoped for Copilot RAG", () => {
  for (const roles of [["CLIENT"], ["PRO"], ["ORG_ADMIN"], ["PRO", "CLIENT"]]) {
    const scope = resolveCopilotRagScope({
      tenantId: "tenant-A", orgId: "owner-org", userId: "user-A", roles,
    }, "project-A");
    assert.deepEqual(scope, {
      orgId: "owner-org", projectIds: ["project-A"], jobIds: [],
    });
  }
});
