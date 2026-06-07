import test from "node:test";
import assert from "node:assert/strict";
import { ContractorEstimateService } from "../dist/modules/contractor/contractor-estimate.service.js";

function makePrisma(leadOverrides: Record<string, unknown> = {}) {
  const defaultLead = {
    id: "lead_001",
    tenantId: "tenant_default",
    orgId: "org_client_001",
    createdBy: "usr_client_001",
    name: "Test Client",
    phone: "(305) 555-0100",
    jobType: "Drywall",
    description: "Repair drywall in living room",
    budgetRange: "$800-$1,200",
    status: "new",
    ...leadOverrides,
  };

  return {
    contractorLead: {
      async findFirst() { return defaultLead; },
      async update({ data }: { where: unknown; data: Record<string, unknown> }) {
        return { ...defaultLead, ...data };
      },
    },
  };
}

function makeGateway(output: string, success = true) {
  return {
    async generate() {
      return { success, output, errorMessage: success ? undefined : "gateway error" };
    },
  };
}

function makeFinance() {
  const invoices: Record<string, unknown>[] = [];
  let nextId = 1;
  return {
    async createInvoice(input: Record<string, unknown>) {
      const inv = {
        id: `inv_${nextId++}`,
        ...input,
        status: "draft",
        createdAt: new Date(),
      };
      invoices.push(inv);
      return inv;
    },
    _invoices: invoices,
  };
}

function makeContractor(prisma: ReturnType<typeof makePrisma>) {
  return {
    async getLead(id: string, tenantId: string) {
      return (await prisma.contractorLead.findFirst()) as Record<string, unknown>;
    },
    async updateLead(id: string, tenantId: string, data: Record<string, unknown>) {
      return (await prisma.contractorLead.update({ where: { id }, data })) as Record<string, unknown>;
    },
  };
}

test("suggestLineItems returns parsed items from gateway JSON", async () => {
  const items = [
    { description: "Drywall 4x8 sheets", qty: 12, unitPrice: 14.99, taxRate: 0, total: 179.88, category: "materials" },
    { description: "Labor — drywall", qty: 1, unitPrice: 450, taxRate: 0, total: 450, category: "labor" },
  ];

  const prisma = makePrisma();
  const gateway = makeGateway(JSON.stringify(items));
  const finance = makeFinance();
  const contractor = makeContractor(prisma);

  const service = new ContractorEstimateService(gateway as never, finance as never, contractor as never);

  const result = await service.suggestLineItems({ tenantId: "tenant_default", leadId: "lead_001", userId: "usr_001" });

  assert.equal(result.length, 2);
  assert.equal(result[0]!.description, "Drywall 4x8 sheets");
  assert.equal(result[0]!.category, "materials");
  assert.equal(result[1]!.category, "labor");
});

test("suggestLineItems strips markdown code fences from gateway response", async () => {
  const items = [
    { description: "Paint supplies", qty: 1, unitPrice: 100, taxRate: 0, total: 100, category: "materials" },
  ];
  const rawWithFences = "```json\n" + JSON.stringify(items) + "\n```";

  const prisma = makePrisma({ jobType: "Pintura" });
  const gateway = makeGateway(rawWithFences);
  const finance = makeFinance();
  const contractor = makeContractor(prisma);

  const service = new ContractorEstimateService(gateway as never, finance as never, contractor as never);

  const result = await service.suggestLineItems({ tenantId: "t", leadId: "l", userId: "u" });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.description, "Paint supplies");
});

test("suggestLineItems falls back to hardcoded items when gateway fails", async () => {
  const prisma = makePrisma({ jobType: "Drywall" });
  const gateway = makeGateway("", false);
  const finance = makeFinance();
  const contractor = makeContractor(prisma);

  const service = new ContractorEstimateService(gateway as never, finance as never, contractor as never);

  const result = await service.suggestLineItems({ tenantId: "t", leadId: "l", userId: "u" });

  assert.ok(result.length >= 3, "should return at least 3 fallback items");
  assert.ok(result.some((i) => i.category === "labor"), "should include labor item");
  assert.ok(result.some((i) => i.category === "materials"), "should include materials");
});

test("suggestLineItems falls back when gateway returns invalid JSON", async () => {
  const prisma = makePrisma({ jobType: "Pisos" });
  const gateway = makeGateway("not valid json at all");
  const finance = makeFinance();
  const contractor = makeContractor(prisma);

  const service = new ContractorEstimateService(gateway as never, finance as never, contractor as never);

  const result = await service.suggestLineItems({ tenantId: "t", leadId: "l", userId: "u" });

  assert.ok(result.length > 0, "should return fallback items");
  assert.ok(result.every((i) => ["materials", "labor", "other"].includes(i.category)));
});

test("createEstimateFromLead creates invoice with lead data and updates lead status", async () => {
  const prisma = makePrisma({
    name: "Carlos Mendez",
    phone: "(305) 555-0404",
    address: "321 Coral Way",
    jobType: "Remodelación",
  });
  const gateway = makeGateway("");
  const finance = makeFinance();
  const contractor = makeContractor(prisma);

  const service = new ContractorEstimateService(gateway as never, finance as never, contractor as never);

  const lineItems = [
    { description: "Tile materials", qty: 1, unitPrice: 800, taxRate: 0, total: 800 },
    { description: "Labor", qty: 1, unitPrice: 1200, taxRate: 0, total: 1200 },
  ];

  const invoice = await service.createEstimateFromLead({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    leadId: "lead_001",
    lineItems,
  }) as Record<string, unknown>;

  assert.ok(invoice.id, "should return an invoice with id");
  assert.ok(String(invoice.title ?? "").includes("Carlos Mendez"), "title should include client name");
  assert.ok(String(invoice.notes ?? "").includes("Carlos Mendez"), "notes should reference client");
  assert.equal(finance._invoices.length, 1);
});

test("createEstimateFromLead uses default terms when not provided", async () => {
  const prisma = makePrisma({ name: "Demo Client", jobType: "Pintura" });
  const gateway = makeGateway("");
  const finance = makeFinance();
  const contractor = makeContractor(prisma);

  const service = new ContractorEstimateService(gateway as never, finance as never, contractor as never);

  const invoice = await service.createEstimateFromLead({
    tenantId: "t", orgId: "o", userId: "u", leadId: "l",
    lineItems: [{ description: "Paint", qty: 1, unitPrice: 200, taxRate: 0, total: 200 }],
  }) as Record<string, unknown>;

  assert.ok(String(invoice.terms ?? "").includes("50%"), "default terms include 50% deposit clause");
});
