import { Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import {
  FinanceRepository,
  type ExpenseCategory,
  type InvoiceLineItem,
  type InvoiceStatus,
  type TemplateCategory,
} from "./finance.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

function computeTotals(lineItems: InvoiceLineItem[]): { subtotal: number; taxAmount: number; total: number } {
  let subtotal = 0, taxAmount = 0;
  for (const li of lineItems) {
    const lineTotal = li.qty * li.unitPrice;
    const tax = lineTotal * (li.taxRate / 100);
    subtotal += lineTotal;
    taxAmount += tax;
  }
  return { subtotal: parseFloat(subtotal.toFixed(2)), taxAmount: parseFloat(taxAmount.toFixed(2)), total: parseFloat((subtotal + taxAmount).toFixed(2)) };
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly repo: FinanceRepository,
    @Optional() private readonly sseBus?: SseEventBusService,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

  private syncContext(tenantId: string, projectId: string | null | undefined, source: string, reason: string): void {
    this.operationalContext?.invalidateScope({
      tenantId,
      projectId,
      source,
      reason,
    });
  }

  // ── Invoices ──────────────────────────────────────────────────────────────────

  async createInvoice(input: {
    tenantId: string; orgId: string; clientOrgId?: string;
    projectId?: string; jobId?: string; createdBy: string;
    title: string; lineItems: InvoiceLineItem[]; currency?: string;
    dueDate?: Date; notes?: string; terms?: string;
  }) {
    const number = await this.repo.getNextInvoiceNumber(input.tenantId);
    const { subtotal, taxAmount, total } = computeTotals(input.lineItems);
    const invoice = await this.repo.createInvoice({ ...input, number, subtotal, taxAmount, total });
    this.logger.log(`[finance] invoice created id=${invoice.id} number=${number} total=${total}`);
    this.syncContext(input.tenantId, invoice.projectId, "finance.invoice.created", "invoice created");
    return invoice;
  }

  async getInvoice(id: string, tenantId: string) {
    const inv = await this.repo.findInvoiceById(id, tenantId);
    if (!inv) throw new NotFoundException(`Invoice '${id}' not found`);
    return inv;
  }

  async listInvoices(input: {
    tenantId: string; orgId?: string; projectId?: string;
    status?: InvoiceStatus; limit?: number;
  }) {
    return this.repo.listInvoices(input);
  }

  async sendInvoice(id: string, tenantId: string) {
    const inv = await this.getInvoice(id, tenantId);
    if (inv.status !== "draft") return inv;
    const updated = await this.repo.updateInvoiceStatus(id, tenantId, "sent", { sentAt: new Date() });
    this.logger.log(`[finance] invoice sent id=${id}`);
    this.syncContext(tenantId, updated.projectId, "finance.invoice.sent", "invoice sent");
    return updated;
  }

  async markInvoicePaid(id: string, tenantId: string) {
    const updated = await this.repo.updateInvoiceStatus(id, tenantId, "paid", { paidAt: new Date() });
    this.logger.log(`[finance] invoice paid id=${id}`);
    this.syncContext(tenantId, updated.projectId, "finance.invoice.paid", "invoice marked paid");
    return updated;
  }

  async markInvoiceViewed(id: string, tenantId: string) {
    const inv = await this.repo.findInvoiceById(id, tenantId);
    if (!inv || inv.viewedAt) return inv;
    const updated = await this.repo.updateInvoiceStatus(id, tenantId, "viewed", { viewedAt: new Date() });
    this.syncContext(tenantId, updated.projectId, "finance.invoice.viewed", "invoice viewed");
    return updated;
  }

  async updateInvoice(id: string, tenantId: string, data: Parameters<FinanceRepository["updateInvoice"]>[2]) {
    const current = await this.getInvoice(id, tenantId);
    const lineItems = data.lineItems;
    const extras = lineItems ? computeTotals(lineItems) : {};
    const updated = await this.repo.updateInvoice(id, tenantId, { ...data, ...extras });
    this.syncContext(tenantId, updated.projectId ?? current.projectId, "finance.invoice.updated", "invoice updated");
    return updated;
  }

  // ── Expenses ──────────────────────────────────────────────────────────────────

  async createExpense(input: {
    tenantId: string; orgId: string; projectId?: string;
    milestoneId?: string; jobId?: string; invoiceId?: string;
    submittedBy: string; category: ExpenseCategory; subcategory?: string;
    description: string; amount: number; currency?: string;
    vendor?: string; expenseDate?: Date; receiptUrl?: string;
    receiptText?: string; notes?: string;
  }) {
    const duplicateOfId = await this.repo.detectDuplicates(input.tenantId, input.amount, input.vendor);
    const expense = await this.repo.createExpense({ ...input });

    if (duplicateOfId) {
      await this.repo.updateExpenseStatus(expense.id, input.tenantId, "pending");
      this.logger.warn(`[finance] potential duplicate expense id=${expense.id} duplicateOfId=${duplicateOfId}`);
      this.syncContext(input.tenantId, expense.projectId, "finance.expense.duplicate", "expense duplicate detected");
      return { ...expense, isDuplicate: true, duplicateOfId };
    }

    this.logger.log(`[finance] expense created id=${expense.id} amount=${input.amount} category=${input.category}`);
    this.syncContext(input.tenantId, expense.projectId, "finance.expense.created", "expense created");
    return expense;
  }

  async getExpense(id: string, tenantId: string) {
    const e = await this.repo.findExpenseById(id, tenantId);
    if (!e) throw new NotFoundException(`Expense '${id}' not found`);
    return e;
  }

  async listExpenses(input: {
    tenantId: string; orgId?: string; projectId?: string;
    category?: ExpenseCategory; status?: string; limit?: number;
  }) {
    return this.repo.listExpenses(input as Parameters<FinanceRepository["listExpenses"]>[0]);
  }

  async approveExpense(id: string, tenantId: string, approvedBy: string) {
    await this.getExpense(id, tenantId);
    const updated = await this.repo.updateExpenseStatus(id, tenantId, "approved", approvedBy);
    this.syncContext(tenantId, updated.projectId, "finance.expense.approved", "expense approved");
    return updated;
  }

  async rejectExpense(id: string, tenantId: string) {
    await this.getExpense(id, tenantId);
    const updated = await this.repo.updateExpenseStatus(id, tenantId, "rejected");
    this.syncContext(tenantId, updated.projectId, "finance.expense.rejected", "expense rejected");
    return updated;
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  async createTemplate(input: {
    tenantId: string; orgId: string; createdBy: string;
    name: string; category: TemplateCategory; bodyJson?: Record<string, unknown>;
  }) {
    return this.repo.createTemplate(input);
  }

  async listTemplates(input: { tenantId: string; category?: TemplateCategory }) {
    return this.repo.listTemplates(input);
  }

  // ── Financial summary ─────────────────────────────────────────────────────────

  async getProjectSummary(tenantId: string, projectId: string) {
    return this.repo.getProjectFinancialSummary(tenantId, projectId);
  }

  // ── AI context block ──────────────────────────────────────────────────────────

  async buildFinanceContextBlock(tenantId: string, projectId: string): Promise<string> {
    try {
      const summary = await this.getProjectSummary(tenantId, projectId);
      const lines = [
        "## Resumen financiero del proyecto",
        `Escrow: $${summary.escrowFunded.toLocaleString()} fondeados · $${summary.escrowReleased.toLocaleString()} liberados · $${summary.pendingRelease.toLocaleString()} pendiente`,
        `Facturas: $${summary.totalInvoiced.toLocaleString()} facturado · $${summary.totalPaid.toLocaleString()} cobrado · $${summary.totalPending.toLocaleString()} pendiente (${summary.invoiceCount} facturas)`,
        `Gastos: $${summary.totalExpenses.toLocaleString()} (${summary.expenseCount} registros)`,
      ];
      if (Object.keys(summary.expensesByCategory).length > 0) {
        const cats = Object.entries(summary.expensesByCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([cat, amt]) => `${cat}=$${amt.toLocaleString()}`)
          .join(" · ");
        lines.push(`Top categorías: ${cats}`);
      }
      if (summary.margin !== null) {
        lines.push(`Margen estimado: ${summary.margin.toFixed(1)}%`);
      }
      return lines.join("\n");
    } catch {
      return "";
    }
  }

  // ── Overdue invoice detection ─────────────────────────────────────────────────

  async markOverdueInvoices(): Promise<number> {
    const candidates = await this.repo.listOverdueInvoiceCandidates().catch(() => []);
    let count = 0;
    for (const inv of candidates) {
      try {
        await this.repo.updateInvoiceStatus(inv.id, inv.tenantId, "overdue");
        this.sseBus?.emit(`finance:${inv.tenantId}`, "invoice-overdue", {
          invoiceId: inv.id, number: inv.number, total: inv.total,
        });
        this.syncContext(inv.tenantId, inv.projectId, "finance.invoice.overdue", "invoice marked overdue");
        count++;
        this.logger.warn(`[finance] invoice overdue id=${inv.id} number=${inv.number}`);
      } catch { /* skip individual failures */ }
    }
    return count;
  }
}
