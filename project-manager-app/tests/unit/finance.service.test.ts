import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { FinanceService } from "../../apps/api/dist/modules/finance/finance.service.js";

// ── Invoice Tests ──────────────────────────────────────────────────────────

test("finance service: createInvoice with line items", async () => {
  const mockRepo = {
    getNextInvoiceNumber: async () => 1001,
    createInvoice: async (input: any) => ({
      id: "inv_1",
      number: 1001,
      tenantId: input.tenantId,
      status: "draft",
      subtotal: 100,
      taxAmount: 10,
      total: 110,
      lineItems: input.lineItems,
      createdAt: new Date(),
    }),
    findInvoiceById: async () => null,
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => null,
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.createInvoice({
    tenantId: "t1",
    orgId: "org1",
    createdBy: "user1",
    title: "Invoice for Project A",
    lineItems: [
      { description: "Service", qty: 1, unitPrice: 100, taxRate: 10 },
    ],
  });

  assert.equal(result.id, "inv_1");
  assert.equal(result.number, 1001);
  assert.equal(result.total, 110);
});

test("finance service: getInvoice retrieves by ID", async () => {
  const invoice = {
    id: "inv_1",
    tenantId: "t1",
    status: "draft",
    total: 110,
  };

  const mockRepo = {
    findInvoiceById: async () => invoice,
    getNextInvoiceNumber: async () => 1002,
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => null,
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.getInvoice("inv_1", "t1");
  assert.equal(result.id, "inv_1");
  assert.equal(result.total, 110);
});

test("finance service: sendInvoice transitions draft → sent", async () => {
  const mockRepo = {
    findInvoiceById: async () => ({
      id: "inv_1",
      status: "draft",
      projectId: "proj_1",
    }),
    updateInvoiceStatus: async (id: string, tenantId: string, status: string) => ({
      id,
      tenantId,
      status,
      sentAt: new Date(),
    }),
    getNextInvoiceNumber: async () => 1003,
    createInvoice: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => null,
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.sendInvoice("inv_1", "t1");
  assert.equal(result.status, "sent");
  assert.ok(result.sentAt);
});

test("finance service: markInvoicePaid transitions → paid", async () => {
  const mockRepo = {
    updateInvoiceStatus: async (id: string, tenantId: string, status: string) => ({
      id,
      tenantId,
      status,
      paidAt: new Date(),
    }),
    getNextInvoiceNumber: async () => 1004,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => null,
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.markInvoicePaid("inv_1", "t1");
  assert.equal(result.status, "paid");
  assert.ok(result.paidAt);
});

test("finance service: listInvoices filters by project and status", async () => {
  const mockRepo = {
    listInvoices: async (input: any) => [
      { id: "inv_1", projectId: input.projectId, status: input.status },
      { id: "inv_2", projectId: input.projectId, status: input.status },
    ],
    getNextInvoiceNumber: async () => 1005,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => null,
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.listInvoices({
    tenantId: "t1",
    projectId: "proj_1",
    status: "paid",
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].projectId, "proj_1");
});

// ── Expense Tests ──────────────────────────────────────────────────────────

test("finance service: createExpense logs amount and category", async () => {
  const mockRepo = {
    detectDuplicates: async () => null,
    createExpense: async (input: any) => ({
      id: "exp_1",
      amount: input.amount,
      category: input.category,
      tenantId: input.tenantId,
      status: "pending",
    }),
    findExpenseById: async () => ({}),
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1006,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.createExpense({
    tenantId: "t1",
    orgId: "org1",
    submittedBy: "user1",
    category: "materials",
    description: "Drywall",
    amount: 500,
  });

  assert.equal(result.id, "exp_1");
  assert.equal(result.amount, 500);
  assert.equal(result.category, "materials");
});

test("finance service: createExpense detects duplicates", async () => {
  const mockRepo = {
    detectDuplicates: async () => "exp_999",
    createExpense: async (input: any) => ({
      id: "exp_2",
      amount: input.amount,
      category: input.category,
      tenantId: input.tenantId,
      status: "pending",
    }),
    updateExpenseStatus: async () => ({}),
    findExpenseById: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1007,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.createExpense({
    tenantId: "t1",
    orgId: "org1",
    submittedBy: "user1",
    category: "materials",
    description: "Drywall",
    amount: 500,
    vendor: "HomeDepot",
  });

  assert.equal(result.isDuplicate, true);
  assert.equal(result.duplicateOfId, "exp_999");
});

test("finance service: approveExpense transitions → approved", async () => {
  const mockRepo = {
    findExpenseById: async () => ({ id: "exp_1", status: "pending" }),
    updateExpenseStatus: async (id: string, tenantId: string, status: string) => ({
      id,
      tenantId,
      status,
    }),
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1008,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.approveExpense("exp_1", "t1", "approver1");
  assert.equal(result.status, "approved");
});

test("finance service: rejectExpense transitions → rejected", async () => {
  const mockRepo = {
    findExpenseById: async () => ({ id: "exp_1", status: "pending" }),
    updateExpenseStatus: async (id: string, tenantId: string, status: string) => ({
      id,
      tenantId,
      status,
    }),
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1009,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.rejectExpense("exp_1", "t1");
  assert.equal(result.status, "rejected");
});

test("finance service: listExpenses filters by category", async () => {
  const mockRepo = {
    listExpenses: async (input: any) => [
      { id: "exp_1", category: input.category },
      { id: "exp_2", category: input.category },
    ],
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => ({}),
    updateExpenseStatus: async () => ({}),
    getNextInvoiceNumber: async () => 1010,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.listExpenses({
    tenantId: "t1",
    category: "labor",
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].category, "labor");
});

// ── Template Tests ─────────────────────────────────────────────────────────

test("finance service: createTemplate stores invoice template", async () => {
  const mockRepo = {
    createTemplate: async (input: any) => ({
      id: "tpl_1",
      tenantId: input.tenantId,
      name: input.name,
      category: input.category,
      bodyJson: input.bodyJson,
    }),
    listTemplates: async () => [],
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => ({}),
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1011,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.createTemplate({
    tenantId: "t1",
    orgId: "org1",
    createdBy: "user1",
    name: "Standard Invoice",
    category: "invoice",
    bodyJson: { terms: "Net 30" },
  });

  assert.equal(result.id, "tpl_1");
  assert.equal(result.category, "invoice");
});

test("finance service: listTemplates filters by category", async () => {
  const mockRepo = {
    listTemplates: async (input: any) => [
      { id: "tpl_1", category: input.category },
    ],
    createTemplate: async () => ({}),
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => ({}),
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1012,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.listTemplates({
    tenantId: "t1",
    category: "invoice",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].category, "invoice");
});

// ── Financial Summary Tests ────────────────────────────────────────────────

test("finance service: getProjectSummary returns escrow and invoice totals", async () => {
  const mockRepo = {
    getProjectFinancialSummary: async () => ({
      escrowFunded: 10000,
      escrowReleased: 5000,
      pendingRelease: 2000,
      totalInvoiced: 15000,
      totalPaid: 12000,
      totalPending: 3000,
      invoiceCount: 5,
      totalExpenses: 2000,
      expenseCount: 8,
      expensesByCategory: {
        materials: 1500,
        labor: 500,
      },
      margin: 25.5,
    }),
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => ({}),
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1013,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.getProjectSummary("t1", "proj_1");
  assert.equal(result.escrowFunded, 10000);
  assert.equal(result.totalInvoiced, 15000);
  assert.equal(result.margin, 25.5);
});

test("finance service: buildFinanceContextBlock generates AI-friendly summary", async () => {
  const mockRepo = {
    getProjectFinancialSummary: async () => ({
      escrowFunded: 10000,
      escrowReleased: 5000,
      pendingRelease: 2000,
      totalInvoiced: 15000,
      totalPaid: 12000,
      totalPending: 3000,
      invoiceCount: 5,
      totalExpenses: 2000,
      expenseCount: 8,
      expensesByCategory: {
        materials: 1500,
        labor: 500,
      },
      margin: 25.5,
    }),
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => ({}),
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    getNextInvoiceNumber: async () => 1014,
    findInvoiceById: async () => ({}),
    createInvoice: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
  };

  const service = new FinanceService(mockRepo as any);

  const result = await service.buildFinanceContextBlock("t1", "proj_1");
  assert.ok(typeof result === "string");
  assert.ok(result.includes("Escrow"));
  assert.ok(result.includes("10,000"));
  assert.ok(result.includes("Facturas"));
  assert.ok(result.includes("Margen"));
});

test("finance service: computeTotals correctly calculates subtotal and tax", async () => {
  // This test validates the internal computeTotals function behavior
  const mockRepo = {
    getNextInvoiceNumber: async () => 1015,
    createInvoice: async (input: any) => ({
      id: "inv_test",
      total: input.total,
      subtotal: input.subtotal,
      taxAmount: input.taxAmount,
    }),
    findInvoiceById: async () => ({}),
    updateInvoiceStatus: async () => ({}),
    updateInvoice: async () => ({}),
    listInvoices: async () => [],
    detectDuplicates: async () => null,
    createExpense: async () => ({}),
    findExpenseById: async () => null,
    updateExpenseStatus: async () => ({}),
    listExpenses: async () => [],
    createTemplate: async () => ({}),
    listTemplates: async () => [],
    getProjectFinancialSummary: async () => ({}),
  };

  const service = new FinanceService(mockRepo as any);

  // 2 items: $100 + 10% tax, $50 + 10% tax
  // Expected: subtotal $150, tax $15, total $165
  const result = await service.createInvoice({
    tenantId: "t1",
    orgId: "org1",
    createdBy: "user1",
    title: "Multi-item invoice",
    lineItems: [
      { description: "Item A", qty: 1, unitPrice: 100, taxRate: 10 },
      { description: "Item B", qty: 1, unitPrice: 50, taxRate: 10 },
    ],
  });

  assert.equal(result.subtotal, 150);
  assert.equal(result.taxAmount, 15);
  assert.equal(result.total, 165);
});
