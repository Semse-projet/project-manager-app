import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { FinanceController } from "../dist/modules/finance/finance.controller.js";
import { FinanceService } from "../dist/modules/finance/finance.service.js";
import { FinanceAccessPolicy } from "../dist/modules/finance/finance-access.policy.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";
import { canReadFinanceEvent } from "../dist/infrastructure/sse/finance-event-access.js";
import { FinanceRepository } from "../dist/modules/finance/finance.repository.js";

type Where = Record<string, any>;
function matches(row: any, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "OR") return value.some((w: Where) => matches(row, w));
    if (key === "AND") return value.every((w: Where) => matches(row, w));
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value) return value.in.includes(row[key]);
      if ("not" in value) return row[key] !== value.not;
      if ("gte" in value) return new Date(row[key]) >= value.gte;
      return matches(row[key] ?? {}, value);
    }
    return row[key] === value;
  });
}
const actor = (orgId = "client", tenantId = "t1", roles: string[] = []) => ({ tenantId, orgId, userId: "u1", roles });
const req = (orgId = "client", tenantId = "t1", roles: string[] = []) => ({ headers: {}, authContext: actor(orgId, tenantId, roles) });
async function status(p: Promise<any>): Promise<number> {
  try { await p; return 200; } catch (e: any) { return e.getStatus?.() ?? 500; }
}
const mk = (id: string, fields: any = {}) => ({
  id, tenantId: "t1", orgId: "issuer", projectId: null, jobId: null,
  milestoneId: null, invoiceId: null, number: id, title: "Invoice", status: "draft",
  lineItems: [], subtotal: 0, taxAmount: 0, total: 100, amount: 100,
  category: "materials", currency: "USD", vendor: "shop", createdBy: "u1", submittedBy: "u1",
  createdAt: new Date(), updatedAt: new Date(), expenseDate: new Date(), ...fields,
});
function fixture() {
  const writes: any[] = [], queries: any[] = [], pdfCalls: any[] = [];
  const projects = [
    { id: "p1", tenantId: "t1", assignedProOrgId: "pro", jobId: "j1", job: { clientOrgId: "client" } },
    { id: "p2", tenantId: "t1", assignedProOrgId: "pro2", jobId: "j2", job: { clientOrgId: "other" } },
    { id: "p3", tenantId: "t1", assignedProOrgId: "pro", jobId: "j3", job: { clientOrgId: "client" } },
    { id: "pt2", tenantId: "t2", assignedProOrgId: "prot2", jobId: "jt2", job: { clientOrgId: "clientt2" } },
  ];
  const jobs = projects.map(p => ({ id: p.jobId, tenantId: p.tenantId, clientOrgId: p.job.clientOrgId, deletedAt: null, project: { assignedProOrgId: p.assignedProOrgId } }));
  jobs.push({ id: "deleted", tenantId: "t1", clientOrgId: "client", deletedAt: new Date() as any, project: { assignedProOrgId: "pro" } });
  const invoices = [mk("i1", { projectId: "p1", jobId: "j1" }), mk("own", { orgId: "client" }), mk("other", { projectId: "p2" }), mk("t2", { tenantId: "t2", orgId: "client" }), mk("job", { jobId: "j1" }), mk("dangling", { projectId: "missing", orgId: "client" })];
  const expenses = [mk("e1", { projectId: "p1", jobId: "j1", status: "pending" }), mk("eown", { orgId: "client", status: "pending" }), mk("eother", { orgId: "other", projectId: "p2", status: "pending" }), mk("et2", { tenantId: "t2", status: "pending" })];
  const delegate = (kind: string, rows: any[]) => ({
    findFirst: async ({ where }: any) => (queries.push({ kind, where }), rows.find(r => matches(r, where)) ?? null),
    findMany: async ({ where, take, cursor, skip = 0, orderBy }: any) => {
      queries.push({ kind, where, take, cursor, orderBy });
      const filtered = rows.filter(r => matches(r, where));
      const start = cursor ? Math.max(0, filtered.findIndex(r => r.id === cursor.id) + skip) : skip;
      return filtered.slice(start, take === undefined ? undefined : start + take);
    },
    count: async ({ where }: any) => rows.filter(r => matches(r, where)).length,
    create: async ({ data }: any) => { writes.push({ kind, data }); const row = mk(`new${rows.length}`, data); rows.push(row); return row; },
    update: async ({ where, data }: any) => {
      const row = rows.find(r => matches(r, where));
      if (!row) throw Object.assign(new Error("not found"), { code: "P2025" });
      writes.push({ kind, where, data }); Object.assign(row, data); return row;
    },
  });
  const prisma: any = {
    invoice: delegate("invoice", invoices), projectExpense: delegate("expense", expenses),
    project: delegate("project", projects), job: delegate("job", jobs),
    org: delegate("org", [{ id: "client", tenantId: "t1" }, { id: "other", tenantId: "t1" }, { id: "clientt2", tenantId: "t2" }]),
    milestone: delegate("milestone", [{ id: "m1", projectId: "p1", deletedAt: null, project: projects[0] }, { id: "m2", projectId: "p2", deletedAt: null, project: projects[1] }]),
    paymentEscrow: { findFirst: async () => null, findUnique: async () => null },
  };
  const repo = new FinanceRepository(prisma);
  const service = new FinanceService(repo, new FinanceAccessPolicy(new ResourceScopeResolver(prisma)));
  const pdf: any = { generateEstimatePdf: async () => { pdfCalls.push(1); return Buffer.from("pdf"); }, generateInvoicePdf: async () => { pdfCalls.push(1); return Buffer.from("pdf"); } };
  const controller = new FinanceController(service, {} as any, pdf);
  return { repo, service, controller, writes, queries, pdfCalls, invoices, expenses, prisma };
}

test("C51 finance: same-tenant stranger/pro denied by ID; client and tenant OPS allowed", async () => {
  const f = fixture();
  assert.equal(await status(f.controller.getInvoice(req("stranger"), "i1")), 403);
  assert.equal(await status(f.controller.getInvoice(req("pro"), "i1")), 403);
  assert.equal(await status(f.controller.getInvoice(req(), "i1")), 200);
  assert.equal(await status(f.controller.getInvoice(req("ops", "t1", ["OPS_ADMIN"]), "i1")), 200);
  assert.equal(await status(f.controller.getInvoice(req("ops", "t1", ["OPS_ADMIN"]), "t2")), 404);
  assert.equal(await status(f.controller.getExpense(req("stranger"), "e1")), 403);
});

test("C51 finance: every invoice mutation rejects foreign tenant and org with no writes", async () => {
  for (const method of ["sendInvoice", "markPaid", "markViewed", "updateInvoice"] as const) {
    for (const [org, id, expected] of [["stranger", "i1", 403], ["client", "t2", 404]] as const) {
      const f = fixture();
      const call = method === "updateInvoice" ? f.controller.updateInvoice(req(org), id, { title: "Changed" }) : f.controller[method](req(org), id);
      assert.equal(await status(call), expected, method);
      assert.equal(f.writes.length, 0, method);
    }
  }
});

test("C51 finance: expense approve/reject and PDF/context deny before effects", async () => {
  for (const method of ["approveExpense", "rejectExpense"] as const) {
    const f = fixture();
    assert.equal(await status(f.controller[method](req("stranger"), "e1")), 403);
    assert.equal(await status(f.controller[method](req(), "et2")), 404);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  assert.equal(await status(f.controller.getInvoicePdf(req("stranger"), {} as any, "i1")), 403);
  assert.equal(f.pdfCalls.length, 0);
  assert.equal(await status(f.controller.projectSummary(req("pro"), "p1")), 403);
  assert.equal(await status(f.controller.projectSummaryContext(req("stranger"), "p1")), 403);
});

test("C51 finance: list/read policy agrees; explicit project filter is authorized", async () => {
  const f = fixture();
  const ids = (response: any) => response.data.map((r: any) => r.id).sort();
  assert.deepEqual(ids(await f.controller.listInvoices(req())), ["i1", "job", "own"]);
  assert.deepEqual(ids(await f.controller.listExpenses(req())), ["e1", "eown"]);
  assert.deepEqual(ids(await f.controller.listInvoices(req("stranger"))), []);
  assert.deepEqual(ids(await f.controller.listInvoices(req("pro"))), []);
  assert.equal(await status(f.controller.listInvoices(req("stranger"), "p1")), 403);
  assert.equal(await status(f.controller.listInvoices(req(), "pt2")), 404);
  assert.equal(await status(f.controller.listInvoices(req(), "missing")), 404);
  assert.equal(await status(f.controller.getInvoice(req(), "dangling")), 403);
});

test("C51 finance: creation validates project/job and ownership before any write", async () => {
  for (const [body, who, expected] of [
    [{ projectId: "pt2" }, req(), 404], [{ projectId: "p2" }, req(), 403],
    [{ projectId: "p1", jobId: "j3" }, req(), 400], [{ jobId: "deleted" }, req(), 404],
    [{}, req(""), 403], [{ projectId: ["p1"] }, req(), 400],
    [{ projectId: "p1", clientOrgId: "other" }, req(), 400], [{ clientOrgId: "clientt2" }, req(), 404],
  ] as any[]) {
    const f = fixture();
    assert.equal(await status(f.controller.createInvoice(who, { title: "Test", lineItems: [], ...body })), expected);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  const result = await f.controller.createInvoice(req(), { projectId: "p1", orgId: "spoof", tenantId: "t2", createdBy: "spoof" });
  assert.equal(result.data.orgId, "client"); assert.equal(result.data.tenantId, "t1"); assert.equal(result.data.createdBy, "u1");
  assert.equal(result.data.clientOrgId, "client");
});

test("C51 finance: expense linked invoice/hito authorize and normalize project; conflicts deny", async () => {
  for (const [body, expected] of [
    [{ invoiceId: "t2" }, 404], [{ invoiceId: "other" }, 403],
    [{ projectId: "p1", milestoneId: "m2" }, 403],
    [{ projectId: "p3", milestoneId: "m1" }, 400], [{ projectId: "p3", invoiceId: "i1" }, 400],
    [{ invoiceId: "missing" }, 404], [{ milestoneId: "missing" }, 404],
  ] as any[]) {
    const f = fixture();
    assert.equal(await status(f.controller.createExpense(req(), { amount: 80, description: "Test", ...body })), expected);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  const result = await f.controller.createExpense(req(), { amount: 80, description: "Test", milestoneId: "m1", invoiceId: "i1" });
  assert.equal(result.data.projectId, "p1"); assert.equal(result.data.jobId, "j1");
});

test("C51 finance: duplicate detection never returns a different org/scope/currency id", async () => {
  const f = fixture();
  const response = await f.controller.createExpense(req(), { projectId: "p1", amount: 100, vendor: "shop", description: "Test" });
  assert.notEqual(response.data.duplicateOfId, "eother");
  const query = f.queries.find(q => q.kind === "expense" && q.where.amount !== undefined);
  assert.equal(query.where.orgId, "client"); assert.equal(query.where.projectId, "p1");
  assert.equal(query.where.currency, "USD");
});

test("C51 finance: repository writes always predicate on tenant, including direct calls", async () => {
  const f = fixture();
  assert.equal(await status(f.repo.updateInvoiceStatus("t2", "t1", "paid")), 404);
  assert.equal(await status(f.repo.updateInvoice("t2", "t1", { title: "Changed" })), 404);
  assert.equal(await status(f.repo.updateExpenseStatus("et2", "t1", "approved")), 404);
  assert.equal(f.writes.length, 0);
});

test("C51 finance: PATCH cannot transfer ownership, associations, calculated totals or state", async () => {
  for (const body of [{ tenantId: "t2" }, { orgId: "other" }, { projectId: "p2" }, { createdBy: "spoof" }, { total: 1 }, { status: "paid" }]) {
    const f = fixture();
    assert.equal(await status(f.controller.updateInvoice(req(), "i1", body)), 400);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  assert.equal(await status(f.controller.updateInvoice(req(), "i1", { title: "Updated" })), 200);
  assert.equal(f.writes[0].where.tenantId, "t1");
});

test("C51 finance: cursors are authorized, limits bounded, and no-org grants remain empty", async () => {
  const f = fixture();
  assert.equal(await status(f.controller.listInvoices(req(), undefined, undefined, "50000", "other")), 403);
  assert.equal(await status(f.controller.listExpenses(req(), undefined, undefined, undefined, "100", "et2")), 404);
  await f.controller.listInvoices(req(), "p1", undefined, "50000");
  assert.equal(f.queries.findLast(q => q.kind === "invoice" && q.take !== undefined).take, 500);
  assert.deepEqual((await f.controller.listInvoices(req(""))).data, []);
  assert.equal(await status(f.controller.getInvoice(req(""), "own")), 403);
  const page = await f.controller.listInvoices(req(), undefined, undefined, "1");
  const next = await f.controller.listInvoices(req(), undefined, undefined, "1", page.data[0].id);
  assert.notEqual(next.data[0].id, page.data[0].id);
});

test("C51 finance: distributed numbering does not use count+1", async () => {
  const f = fixture();
  const numbers = await Promise.all(Array.from({ length: 100 }, () => f.repo.getNextInvoiceNumber("t1")));
  assert.equal(new Set(numbers).size, numbers.length);
  assert.ok(numbers.every(n => /^INV-[0-9A-F-]{36}$/.test(n)));
});

test("C51 finance: viewed never demotes a paid invoice", async () => {
  const f = fixture(); f.invoices[0].status = "paid";
  await f.controller.markViewed(req(), "i1");
  assert.equal(f.invoices[0].status, "paid");
});

test("C51 finance: duplicate is persisted only within the same exact scope", async () => {
  const f = fixture();
  f.expenses.push(mk("exact", { orgId: "client", projectId: "p1", jobId: "j1", status: "pending" }));
  const result = await f.controller.createExpense(req(), { projectId: "p1", jobId: "j1", amount: 100, vendor: "shop", description: "Test" });
  assert.equal(result.data.duplicateOfId, "exact");
  assert.equal(f.expenses.at(-1).isDuplicate, true);
  const otherCurrency = await f.controller.createExpense(req(), { projectId: "p1", jobId: "j1", amount: 100, vendor: "shop", currency: "EUR", description: "Test" });
  assert.equal(otherCurrency.data.isDuplicate, false);
});

test("C51 finance: SSE payload uses current ownership, never tenant membership alone", async () => {
  const f = fixture();
  assert.equal(await canReadFinanceEvent(actor(), { invoiceId: "i1", total: 100 }, f.prisma), true);
  assert.equal(await canReadFinanceEvent(actor("pro"), { invoiceId: "i1" }, f.prisma), false);
  assert.equal(await canReadFinanceEvent(actor("stranger"), { invoiceId: "i1" }, f.prisma), false);
  assert.equal(await canReadFinanceEvent(actor("ops", "t1", ["OPS_ADMIN"]), { invoiceId: "t2" }, f.prisma), false);
  assert.equal(await canReadFinanceEvent(actor(), { total: 100 }, f.prisma), false);
  f.invoices[0].projectId = "p2";
  assert.equal(await canReadFinanceEvent(actor(), { invoiceId: "i1" }, f.prisma), false);
});
