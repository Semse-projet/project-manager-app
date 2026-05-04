import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// ── Invoice types ──────────────────────────────────────────────────────────────

export type InvoiceLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  total: number;
};

export type InvoiceStatus = "draft" | "sent" | "viewed" | "approved" | "paid" | "overdue" | "cancelled";

export type InvoiceRecord = {
  id: string; tenantId: string; orgId: string; clientOrgId: string | null;
  projectId: string | null; jobId: string | null; createdBy: string;
  number: string; title: string; status: InvoiceStatus;
  lineItems: InvoiceLineItem[]; subtotal: number; taxAmount: number; total: number;
  currency: string; dueDate: string | null; paidAt: string | null;
  sentAt: string | null; viewedAt: string | null;
  notes: string | null; terms: string | null; pdfUrl: string | null;
  externalRef: string | null; createdAt: string; updatedAt: string;
};

// ── Expense types ──────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | "materials" | "labor" | "tools" | "transport" | "permits"
  | "subcontractors" | "maintenance" | "equipment" | "unexpected" | "other";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "reimbursed" | "archived";

export type ExpenseRecord = {
  id: string; tenantId: string; orgId: string; projectId: string | null;
  milestoneId: string | null; jobId: string | null; invoiceId: string | null;
  submittedBy: string; category: ExpenseCategory; subcategory: string | null;
  description: string; amount: number; currency: string;
  vendor: string | null; expenseDate: string; receiptUrl: string | null;
  receiptText: string | null; status: ExpenseStatus;
  approvedBy: string | null; approvedAt: string | null;
  isDuplicate: boolean; duplicateOfId: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
};

// ── Template types ─────────────────────────────────────────────────────────────

export type TemplateCategory =
  | "invoice" | "quote" | "contract" | "work_order"
  | "daily_report" | "weekly_report" | "checklist" | "inspection" | "closeout" | "other";

export type TemplateRecord = {
  id: string; tenantId: string; orgId: string; createdBy: string;
  name: string; category: TemplateCategory; bodyJson: Record<string, unknown>;
  isActive: boolean; createdAt: string; updatedAt: string;
};

// ── Project financial summary ──────────────────────────────────────────────────

export type ProjectFinancialSummary = {
  projectId: string; tenantId: string;
  escrowFunded: number; escrowReleased: number; pendingRelease: number;
  totalInvoiced: number; totalPaid: number; totalPending: number;
  totalExpenses: number; expensesByCategory: Record<string, number>;
  invoiceCount: number; expenseCount: number;
  margin: number | null;
  currency: string;
};

function toDecimal(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

function toInvoiceRecord(row: Record<string, unknown>): InvoiceRecord {
  return {
    id: String(row.id), tenantId: String(row.tenantId), orgId: String(row.orgId),
    clientOrgId: row.clientOrgId ? String(row.clientOrgId) : null,
    projectId: row.projectId ? String(row.projectId) : null,
    jobId: row.jobId ? String(row.jobId) : null,
    createdBy: String(row.createdBy), number: String(row.number),
    title: String(row.title), status: String(row.status) as InvoiceStatus,
    lineItems: Array.isArray(row.lineItems) ? row.lineItems as InvoiceLineItem[] : [],
    subtotal: toDecimal(row.subtotal), taxAmount: toDecimal(row.taxAmount), total: toDecimal(row.total),
    currency: String(row.currency ?? "USD"),
    dueDate: row.dueDate ? new Date(String(row.dueDate)).toISOString() : null,
    paidAt: row.paidAt ? new Date(String(row.paidAt)).toISOString() : null,
    sentAt: row.sentAt ? new Date(String(row.sentAt)).toISOString() : null,
    viewedAt: row.viewedAt ? new Date(String(row.viewedAt)).toISOString() : null,
    notes: row.notes ? String(row.notes) : null,
    terms: row.terms ? String(row.terms) : null,
    pdfUrl: row.pdfUrl ? String(row.pdfUrl) : null,
    externalRef: row.externalRef ? String(row.externalRef) : null,
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

function toExpenseRecord(row: Record<string, unknown>): ExpenseRecord {
  return {
    id: String(row.id), tenantId: String(row.tenantId), orgId: String(row.orgId),
    projectId: row.projectId ? String(row.projectId) : null,
    milestoneId: row.milestoneId ? String(row.milestoneId) : null,
    jobId: row.jobId ? String(row.jobId) : null,
    invoiceId: row.invoiceId ? String(row.invoiceId) : null,
    submittedBy: String(row.submittedBy),
    category: String(row.category) as ExpenseCategory,
    subcategory: row.subcategory ? String(row.subcategory) : null,
    description: String(row.description), amount: toDecimal(row.amount),
    currency: String(row.currency ?? "USD"),
    vendor: row.vendor ? String(row.vendor) : null,
    expenseDate: new Date(String(row.expenseDate)).toISOString(),
    receiptUrl: row.receiptUrl ? String(row.receiptUrl) : null,
    receiptText: row.receiptText ? String(row.receiptText) : null,
    status: String(row.status) as ExpenseStatus,
    approvedBy: row.approvedBy ? String(row.approvedBy) : null,
    approvedAt: row.approvedAt ? new Date(String(row.approvedAt)).toISOString() : null,
    isDuplicate: Boolean(row.isDuplicate), duplicateOfId: row.duplicateOfId ? String(row.duplicateOfId) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

function toTemplateRecord(row: Record<string, unknown>): TemplateRecord {
  return {
    id: String(row.id), tenantId: String(row.tenantId), orgId: String(row.orgId),
    createdBy: String(row.createdBy), name: String(row.name),
    category: String(row.category) as TemplateCategory,
    bodyJson: (row.bodyJson && typeof row.bodyJson === "object" ? row.bodyJson : {}) as Record<string, unknown>,
    isActive: Boolean(row.isActive),
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

// ── Repository ──────────────────────────────────────────────────────────────────

@Injectable()
export class FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Invoice ──────────────────────────────────────────────────────────────────

  async createInvoice(data: {
    tenantId: string; orgId: string; clientOrgId?: string;
    projectId?: string; jobId?: string; createdBy: string;
    number: string; title: string; lineItems: InvoiceLineItem[];
    subtotal: number; taxAmount: number; total: number;
    currency?: string; dueDate?: Date; notes?: string; terms?: string;
  }): Promise<InvoiceRecord> {
    const row = await this.prisma.invoice.create({
      data: {
        tenantId: data.tenantId, orgId: data.orgId,
        clientOrgId: data.clientOrgId, projectId: data.projectId, jobId: data.jobId,
        createdBy: data.createdBy, number: data.number, title: data.title,
        lineItems: data.lineItems, subtotal: data.subtotal,
        taxAmount: data.taxAmount, total: data.total,
        currency: data.currency ?? "USD", dueDate: data.dueDate,
        notes: data.notes, terms: data.terms,
      },
    });
    return toInvoiceRecord(row as Record<string, unknown>);
  }

  async findInvoiceById(id: string, tenantId: string): Promise<InvoiceRecord | null> {
    const row = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    return row ? toInvoiceRecord(row as Record<string, unknown>) : null;
  }

  async listInvoices(input: {
    tenantId: string; orgId?: string; projectId?: string;
    status?: InvoiceStatus; limit?: number; offset?: number;
  }): Promise<InvoiceRecord[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.orgId ? { orgId: input.orgId } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
      skip: input.offset ?? 0,
    });
    return rows.map((r: Record<string, unknown>) => toInvoiceRecord(r));
  }

  async listOverdueInvoiceCandidates(): Promise<InvoiceRecord[]> {
    const now = new Date();
    const rows = await this.prisma.invoice.findMany({
      where: {
        status: { in: ["sent", "viewed", "approved"] },
        dueDate: { lt: now },
      },
      take: 500,
      orderBy: { dueDate: "asc" },
    });
    return rows.map((r: Record<string, unknown>) => toInvoiceRecord(r));
  }

  async updateInvoiceStatus(id: string, tenantId: string, status: InvoiceStatus, extra?: {
    paidAt?: Date; sentAt?: Date; viewedAt?: Date;
  }): Promise<InvoiceRecord> {
    const row = await this.prisma.invoice.update({
      where: { id },
      data: { status, ...extra },
    });
    return toInvoiceRecord(row as Record<string, unknown>);
  }

  async updateInvoice(id: string, tenantId: string, data: Partial<{
    title: string; lineItems: InvoiceLineItem[]; subtotal: number;
    taxAmount: number; total: number; dueDate: Date | null;
    notes: string; terms: string; pdfUrl: string; status: InvoiceStatus;
  }>): Promise<InvoiceRecord> {
    const row = await this.prisma.invoice.update({ where: { id }, data });
    return toInvoiceRecord(row as Record<string, unknown>);
  }

  async getNextInvoiceNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    return `INV-${String(count + 1).padStart(4, "0")}`;
  }

  // ── Expense ──────────────────────────────────────────────────────────────────

  async createExpense(data: {
    tenantId: string; orgId: string; projectId?: string;
    milestoneId?: string; jobId?: string; invoiceId?: string;
    submittedBy: string; category: ExpenseCategory; subcategory?: string;
    description: string; amount: number; currency?: string;
    vendor?: string; expenseDate?: Date; receiptUrl?: string;
    receiptText?: string; notes?: string;
  }): Promise<ExpenseRecord> {
    const row = await this.prisma.projectExpense.create({
      data: {
        tenantId: data.tenantId, orgId: data.orgId,
        projectId: data.projectId, milestoneId: data.milestoneId,
        jobId: data.jobId, invoiceId: data.invoiceId,
        submittedBy: data.submittedBy, category: data.category,
        subcategory: data.subcategory, description: data.description,
        amount: data.amount, currency: data.currency ?? "USD",
        vendor: data.vendor, expenseDate: data.expenseDate ?? new Date(),
        receiptUrl: data.receiptUrl, receiptText: data.receiptText,
        notes: data.notes,
      },
    });
    return toExpenseRecord(row as Record<string, unknown>);
  }

  async findExpenseById(id: string, tenantId: string): Promise<ExpenseRecord | null> {
    const row = await this.prisma.projectExpense.findFirst({ where: { id, tenantId } });
    return row ? toExpenseRecord(row as Record<string, unknown>) : null;
  }

  async listExpenses(input: {
    tenantId: string; orgId?: string; projectId?: string;
    category?: ExpenseCategory; status?: ExpenseStatus; limit?: number;
  }): Promise<ExpenseRecord[]> {
    const rows = await this.prisma.projectExpense.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.orgId ? { orgId: input.orgId } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { expenseDate: "desc" },
      take: input.limit ?? 100,
    });
    return rows.map((r: Record<string, unknown>) => toExpenseRecord(r));
  }

  async updateExpenseStatus(id: string, tenantId: string, status: ExpenseStatus, approvedBy?: string): Promise<ExpenseRecord> {
    const row = await this.prisma.projectExpense.update({
      where: { id },
      data: {
        status,
        ...(approvedBy ? { approvedBy, approvedAt: new Date() } : {}),
      },
    });
    return toExpenseRecord(row as Record<string, unknown>);
  }

  async detectDuplicates(tenantId: string, amount: number, vendor: string | undefined, excludeId?: string): Promise<string | null> {
    const similar = await this.prisma.projectExpense.findFirst({
      where: {
        tenantId,
        amount,
        ...(vendor ? { vendor } : {}),
        id: excludeId ? { not: excludeId } : undefined,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    return similar?.id ?? null;
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  async createTemplate(data: {
    tenantId: string; orgId: string; createdBy: string;
    name: string; category: TemplateCategory; bodyJson?: Record<string, unknown>;
  }): Promise<TemplateRecord> {
    const row = await this.prisma.documentTemplate.create({
      data: {
        tenantId: data.tenantId, orgId: data.orgId, createdBy: data.createdBy,
        name: data.name, category: data.category, bodyJson: data.bodyJson ?? {},
      },
    });
    return toTemplateRecord(row as Record<string, unknown>);
  }

  async listTemplates(input: { tenantId: string; category?: TemplateCategory }): Promise<TemplateRecord[]> {
    const rows = await this.prisma.documentTemplate.findMany({
      where: {
        tenantId: input.tenantId, isActive: true,
        ...(input.category ? { category: input.category } : {}),
      },
      orderBy: { name: "asc" },
    });
    return rows.map((r: Record<string, unknown>) => toTemplateRecord(r));
  }

  // ── Financial summary ─────────────────────────────────────────────────────────

  async getProjectFinancialSummary(tenantId: string, projectId: string): Promise<ProjectFinancialSummary> {
    const [invoices, expenses, escrow] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId, projectId },
        select: { status: true, total: true },
      }),
      this.prisma.projectExpense.findMany({
        where: { tenantId, projectId },
        select: { category: true, amount: true, status: true },
      }),
      this.prisma.paymentEscrow.findUnique({
        where: { projectId },
        select: { totalAmount: true, status: true, transactions: { select: { type: true, amount: true, status: true } } },
      }),
    ]);

    type InvoiceRow = { status: string; total: unknown };
    type ExpenseRow = { category: string; amount: unknown; status: string };
    type TxnRow = { type: string; amount: unknown; status: string };

    const totalInvoiced = (invoices as InvoiceRow[]).reduce((s: number, i: InvoiceRow) => s + toDecimal(i.total), 0);
    const totalPaid = (invoices as InvoiceRow[]).filter((i: InvoiceRow) => i.status === "paid").reduce((s: number, i: InvoiceRow) => s + toDecimal(i.total), 0);
    const totalPending = (invoices as InvoiceRow[]).filter((i: InvoiceRow) => ["sent", "viewed", "approved"].includes(i.status)).reduce((s: number, i: InvoiceRow) => s + toDecimal(i.total), 0);

    const activeExpenses = (expenses as ExpenseRow[]).filter((e: ExpenseRow) => e.status !== "rejected" && e.status !== "archived");
    const totalExpenses = activeExpenses.reduce((s: number, e: ExpenseRow) => s + toDecimal(e.amount), 0);
    const expensesByCategory: Record<string, number> = {};
    for (const e of activeExpenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + toDecimal(e.amount);
    }

    const escrowFunded = toDecimal(escrow?.totalAmount);
    const releasedTxns = (escrow?.transactions ?? []) as TxnRow[];
    const released = releasedTxns.filter((t: TxnRow) => t.type === "RELEASE" && t.status === "COMPLETED");
    const escrowReleased = released.reduce((s: number, t: TxnRow) => s + toDecimal(t.amount), 0);
    const pendingRelease = Math.max(0, escrowFunded - escrowReleased);

    const margin = totalInvoiced > 0 ? ((totalInvoiced - totalExpenses) / totalInvoiced) * 100 : null;

    return {
      projectId, tenantId,
      escrowFunded, escrowReleased, pendingRelease,
      totalInvoiced, totalPaid, totalPending,
      totalExpenses, expensesByCategory,
      invoiceCount: invoices.length, expenseCount: activeExpenses.length,
      margin: margin !== null ? parseFloat(margin.toFixed(2)) : null,
      currency: "USD",
    };
  }
}
