import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoAccessPolicy } from "../dist/modules/prometeo/prometeo-access.policy.js";

const client = { tenantId: "tenant_a", orgId: "org_a", userId: "worker_a", roles: ["CLIENT"] };
const admin = { tenantId: "tenant_a", orgId: "ops_org", userId: "ops", roles: ["OPS_ADMIN"] };
function resolver() {
  const calls = { resolve: 0, listedProjects: 0, listedJobs: 0 };
  const service = {
    async resolveProjectScope(tenantId: string, projectId: string) {
      calls.resolve++;
      if (tenantId !== "tenant_a" || projectId === "foreign_project") return null;
      if (projectId === "unrelated_project") return {
        tenantId: "tenant_a", clientOrgId: "other_org", assignedProOrgId: "third_org",
      };
      return { tenantId: "tenant_a", clientOrgId: "org_a", assignedProOrgId: "pro_org" };
    },
    async listAccessibleProjectIds() {
      calls.listedProjects++;
      throw Object.assign(new Error("20k project associations exceeded"), { status: 422 });
    },
    async listAccessibleJobIds() {
      calls.listedJobs++;
      throw Object.assign(new Error("20k job associations exceeded"), { status: 422 });
    },
  };
  return { calls, service };
}

test("P0: explicit authorized project avoids 20k project/job enumeration", async () => {
  const { service, calls } = resolver();
  const policy = new PrometeoAccessPolicy(service as any);
  const bounded = await policy.listScope(client, "project_20001");
  assert.deepEqual(bounded, { orgId: "org_a", projectIds: ["project_20001"], jobIds: [] });
  assert.equal(calls.resolve, 1);
  assert.equal(calls.listedProjects, 0);
  assert.equal(calls.listedJobs, 0);
});

test("P0: explicit filtered project still enforces tenant and organization", async () => {
  const { service, calls } = resolver();
  const policy = new PrometeoAccessPolicy(service as any);
  await assert.rejects(policy.listScope(client, "unrelated_project"), { status: 403 });
  await assert.rejects(policy.listScope(client, "foreign_project"), { status: 404 });
  assert.equal(calls.listedProjects, 0);
  assert.equal(calls.listedJobs, 0);
});

test("P0: OPS_ADMIN project filtering still validates tenant before unrestricted scope", async () => {
  const { service, calls } = resolver();
  const policy = new PrometeoAccessPolicy(service as any);
  assert.equal(await policy.listScope(admin, "project_20001"), undefined);
  await assert.rejects(policy.listScope(admin, "foreign_project"), { status: 404 });
  assert.equal(calls.resolve, 2);
  assert.equal(calls.listedProjects, 0);
});

test("P0: absence of a project filter preserves regular enumeration limits", async () => {
  const { service, calls } = resolver();
  const policy = new PrometeoAccessPolicy(service as any);
  await assert.rejects(policy.listScope(client), { status: 422 });
  assert.equal(calls.listedProjects, 1);
  assert.equal(calls.listedJobs, 1);
});
