import test from "node:test";
import assert from "node:assert/strict";
import { ContractorService } from "../dist/modules/contractor/contractor.service.js";

function makePrisma() {
  const store: Record<string, unknown>[] = [];
  let nextId = 1;

  return {
    contractorLead: {
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { ...data, id: `lead_${nextId++}`, createdAt: new Date(), updatedAt: new Date() };
        store.push(row);
        return row;
      },
      async findMany({ where, take }: { where?: Record<string, unknown>; orderBy?: unknown; take?: number }) {
        let results = store.filter((row) => {
          if (where?.tenantId && row.tenantId !== where.tenantId) return false;
          if (where?.status && row.status !== where.status) return false;
          return true;
        });
        if (take) results = results.slice(0, take);
        return results;
      },
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return store.find((row) => row.id === where.id && row.tenantId === where.tenantId) ?? null;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const idx = store.findIndex((row) => row.id === where.id);
        if (idx === -1) throw new Error("Not found");
        store[idx] = { ...store[idx], ...data, updatedAt: new Date() };
        return store[idx];
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = store.findIndex((row) => row.id === where.id);
        if (idx !== -1) store.splice(idx, 1);
      },
      async count({ where }: { where?: Record<string, unknown> } = {}) {
        return store.filter((row) => !where?.tenantId || row.tenantId === where.tenantId).length;
      },
      async groupBy({ where, by }: { where?: Record<string, unknown>; by: string[] }) {
        const key = by[0] as string;
        const filtered = store.filter((row) => !where?.tenantId || row.tenantId === where.tenantId);
        const counts = new Map<string, number>();
        for (const row of filtered) counts.set(String(row[key] ?? ""), (counts.get(String(row[key] ?? "")) ?? 0) + 1);
        return Array.from(counts.entries()).map(([status, count]) => ({ [key]: status, _count: { id: count } }));
      },
    },
  };
}

test("ContractorService creates a lead with default status new", async () => {
  const service = new ContractorService(makePrisma() as never);

  const lead = await service.createLead({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    createdBy: "usr_client_001",
    name: "Juan Rodríguez",
    phone: "(305) 555-0100",
    jobType: "Drywall",
    description: "Reparar drywall en sala principal",
  });

  assert.equal(lead.name, "Juan Rodríguez");
  assert.equal(lead.status, "new");
  assert.equal(lead.phone, "(305) 555-0100");
  assert.equal(lead.jobType, "Drywall");
  assert.ok(lead.id);
});

test("ContractorService lists leads filtered by tenant", async () => {
  const service = new ContractorService(makePrisma() as never);

  await service.createLead({ tenantId: "tenant_a", orgId: "org_1", createdBy: "usr_1", name: "Lead A" });
  await service.createLead({ tenantId: "tenant_a", orgId: "org_1", createdBy: "usr_1", name: "Lead B" });
  await service.createLead({ tenantId: "tenant_b", orgId: "org_2", createdBy: "usr_2", name: "Lead C" });

  const leads = await service.listLeads("tenant_a");
  assert.equal(leads.length, 2);
  assert.ok(leads.every((l) => l.tenantId === "tenant_a"));
});

test("ContractorService updates lead status", async () => {
  const service = new ContractorService(makePrisma() as never);

  const lead = await service.createLead({
    tenantId: "tenant_default", orgId: "org_1", createdBy: "usr_1",
    name: "María González",
  });

  const updated = await service.updateLead(lead.id, "tenant_default", { status: "contacted" });
  assert.equal(updated.status, "contacted");
  assert.equal(updated.name, "María González");
});

test("ContractorService getStats returns counts by status", async () => {
  const service = new ContractorService(makePrisma() as never);

  await service.createLead({ tenantId: "t1", orgId: "o1", createdBy: "u1", name: "A" });
  await service.createLead({ tenantId: "t1", orgId: "o1", createdBy: "u1", name: "B" });
  const c = await service.createLead({ tenantId: "t1", orgId: "o1", createdBy: "u1", name: "C" });
  await service.updateLead(c.id, "t1", { status: "estimate_sent" });

  const stats = await service.getStats("t1");
  assert.equal(stats.total, 3);
  assert.equal(stats.new, 2);
  assert.equal(stats.estimate_sent, 1);
});
