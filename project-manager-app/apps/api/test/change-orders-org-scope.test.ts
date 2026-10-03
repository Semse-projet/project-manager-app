import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { ChangeOrdersService } from "../dist/modules/change-orders/change-orders.service.js";

// In-memory persistence double interprets query predicates, not access policy.
// The actual service must choose and enforce the authorized resource set.
function matches(row: any, where: any): boolean {
  if (!row) return false;
  return Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (key === "AND") return [value].flat().every((clause) => matches(row, clause));
    if (key === "OR") return value.some((clause: any) => matches(row, clause));
    if (key === "NOT") return !matches(row, value);
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      if ("not" in value) return row[key] !== value.not;
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}
const actor = (orgId = "client", roles = ["CLIENT"], tenantId = "tenant") =>
  ({ orgId, roles, tenantId, userId: "user" });
const candidate = (id: string, links: object = {}, tenantId = "tenant") => ({
  id, tenantId, jobId: null, buildOpsProjectId: null, milestoneId: null,
  title: id, trigger: "scope", status: "predicted", pricingMode: "fixed",
  estimatedMin: null, estimatedMax: null, probability: null, ...links,
});
function fixture(rows: any[]) {
  const calls = { writes: 0, events: 0 };
  const projects = [
    { id: "project", tenantId: "tenant", jobId: "job", assignedProOrgId: "pro", job: { clientOrgId: "client", tenantId: "tenant", deletedAt: null } },
    { id: "other-project", tenantId: "tenant", jobId: "other-job", assignedProOrgId: "other-pro", job: { clientOrgId: "other-client", tenantId: "tenant", deletedAt: null } },
    { id: "foreign-project", tenantId: "foreign", jobId: "foreign-job", assignedProOrgId: "pro", job: { clientOrgId: "client", tenantId: "foreign", deletedAt: null } },
  ];
  const table = (data: any[]) => ({
    async findMany({ where, take }: any) { return data.filter((row) => matches(row, where)).slice(0, take); },
    async findFirst({ where }: any) { return data.find((row) => matches(row, where)) ?? null; },
  });
  const prisma = {
    project: table(projects),
    job: table(projects.map((p) => ({ id: p.jobId, ...p.job, project: p }))),
    buildOpsProject: table([
      { id: "build", tenantId: "tenant", orgId: "client" },
      { id: "other-build", tenantId: "tenant", orgId: "other-client" },
      { id: "foreign-build", tenantId: "foreign", orgId: "client" },
    ]),
    milestone: table(projects.map((p) => ({ id: `${p.id}-milestone`, project: p }))),
    changeOrderCandidate: {
      ...table(rows),
      async create({ data }: any) { calls.writes++; return data; },
      async update({ where, data }: any) { calls.writes++; return { ...rows.find((r) => r.id === where.id), ...data }; },
    },
  };
  const service = new ChangeOrdersService(prisma as never, {} as never, undefined,
    { emit() { calls.events++; } } as never);
  return { service, calls };
}

const owned = [candidate("job-co", { jobId: "job" }), candidate("build-co", { buildOpsProjectId: "build" }), candidate("milestone-co", { milestoneId: "project-milestone" })];
const inaccessible = [
  candidate("other-job-co", { jobId: "other-job" }),
  candidate("other-build-co", { buildOpsProjectId: "other-build" }),
  candidate("other-milestone-co", { milestoneId: "other-project-milestone" }),
  candidate("mixed-co", { jobId: "job", buildOpsProjectId: "other-build" }),
  candidate("mixed-milestone-co", { buildOpsProjectId: "build", milestoneId: "other-project-milestone" }),
  candidate("foreign-link-co", { jobId: "foreign-job" }),
  candidate("foreign-build-link-co", { buildOpsProjectId: "foreign-build" }),
  candidate("foreign-milestone-link-co", { milestoneId: "foreign-project-milestone" }),
  candidate("orphan-co"), candidate("missing-co", { jobId: "missing" }),
  candidate("foreign-co", { jobId: "job" }, "foreign"),
];

test("list scopes all references before applying the limit", async () => {
  const { service } = fixture([...inaccessible, ...owned]);
  assert.deepEqual((await service.list(actor(), { limit: 2 })).map((r: any) => r.id), ["job-co", "build-co"]);
});
test("assigned professional retains access through job and milestone", async () => {
  const { service } = fixture([...inaccessible, ...owned]);
  assert.deepEqual((await service.list(actor("pro", ["PRO"]), {})).map((r: any) => r.id), ["job-co", "milestone-co"]);
});
test("explicit foreign-org query cannot bypass list scoping", async () => {
  const { service } = fixture(inaccessible);
  assert.deepEqual(await service.list(actor(), { buildOpsProjectId: "other-build" }), []);
});
test("OPS_ADMIN list remains tenant scoped", async () => {
  const { service } = fixture([...inaccessible, ...owned]);
  const results = await service.list(actor("ops", ["OPS_ADMIN"]), {});
  assert.equal(results.length, inaccessible.length + owned.length - 1);
  assert.ok(results.every((r: any) => r.tenantId === "tenant"));
});
for (const co of inaccessible) {
  test(`direct impact rejects ${co.id}`, async () => {
    const { service } = fixture([co]);
    await assert.rejects(service.computeImpact(actor(), co.id), NotFoundException);
  });
}
for (const co of owned) {
  test(`owner can read and submit ${co.id}`, async () => {
    const { service, calls } = fixture([co]);
    assert.equal((await service.computeImpact(actor(), co.id)).changeOrderId, co.id);
    assert.equal((await service.submit(actor(), co.id)).status, "submitted");
    assert.equal(calls.writes, 1);
  });
  test(`owner can create ${co.id}`, async () => {
    const { service, calls } = fixture([]);
    await service.create(actor(), { ...co, jobId: co.jobId ?? undefined, buildOpsProjectId: co.buildOpsProjectId ?? undefined, milestoneId: co.milestoneId ?? undefined });
    assert.equal(calls.writes, 1);
  });
}
for (const links of [{ jobId: "other-job" }, { buildOpsProjectId: "other-build" }, { milestoneId: "other-project-milestone" }, { jobId: "job", buildOpsProjectId: "other-build" }, { jobId: "missing" }]) {
  test(`creation rejects unauthorized links ${JSON.stringify(links)} before writes`, async () => {
    const { service, calls } = fixture([]);
    await assert.rejects(service.create(actor(), { title: "change", trigger: "scope", ...links }), NotFoundException);
    assert.equal(calls.writes, 0);
  });
}
test("OPS_ADMIN cannot create a cross-tenant reference", async () => {
  const { service, calls } = fixture([]);
  await assert.rejects(service.create(actor("ops", ["OPS_ADMIN"]), { title: "change", trigger: "scope", jobId: "foreign-job" }), NotFoundException);
  assert.equal(calls.writes, 0);
});
for (const method of ["submit", "approve", "reject", "requestChanges", "applyToBuildOps", "runRiskAgent"] as const) {
  test(`${method} denies foreign BuildOps ownership before effects`, async () => {
    const co = candidate("denied", { buildOpsProjectId: "other-build", status: method === "applyToBuildOps" ? "approved" : "submitted" });
    const { service, calls } = fixture([co]);
    await assert.rejects((service[method] as any).call(service, actor(), co.id, method === "requestChanges" ? { requiredActions: ["fix"] } : "reason"), NotFoundException);
    assert.deepEqual(calls, { writes: 0, events: 0 });
  });
}
