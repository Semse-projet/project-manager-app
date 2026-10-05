import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
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
import { ProjectLifecycleProjectionEventProducer } from "../domain-events/project-lifecycle-projection-event-producer.service.js";

import { FinanceAccessPolicy, financeId, type FinanceAssociations } from "./finance-access.policy.js";
import type { ScopeActor } from "../../common/resource-scope.js";

function computeTotals(lineItems: InvoiceLineItem[]): { subtotal: number; taxAmount: number; total: number } {
  if (!Array.isArray(lineItems)) throw new BadRequestException("lineItems must be an array");
  let subtotal = 0, taxAmount = 0;
  for (const li of lineItems) {
    if (!li || ![li.qty, li.unitPrice, li.taxRate].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
      throw new BadRequestException("Invalid invoice line item");
    }
    const lineTotal = li.qty * li.unitPrice;
    const tax = lineTotal * (li.taxRate / 100);
    subtotal += lineTotal;
    taxAmount += tax;
  }
  if (![subtotal, taxAmount, subtotal + taxAmount].every(v => Number.isFinite(v) && v < 1e10)) throw new BadRequestException("Invoice total exceeds supported precision");
  return { subtotal: parseFloat(subtotal.toFixed(2)), taxAmount: parseFloat(taxAmount.toFixed(2)), total: parseFloat((subtotal + taxAmount).toFixed(2)) };
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly repo: FinanceRepository,
    private readonly policy: FinanceAccessPolicy,
    @Optional() private readonly sseBus?: SseEventBusService,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
    @Optional()
    private readonly lifecycleProjectionEvents?: ProjectLifecycleProjectionEventProducer,
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
  }, actor: ScopeActor) {
    this.policy.assertOwner(actor);
    const assoc = { projectId: financeId(input.projectId, "projectId"), jobId: financeId(input.jobId, "jobId") };
    const resolvedClient = await this.policy.assertCanCreate(actor, assoc);
    const requestedClient = financeId(input.clientOrgId, "clientOrgId");
    if (resolvedClient && requestedClient && resolvedClient !== requestedClient) throw new BadRequestException("clientOrgId does not match the resource owner");
    if (requestedClient && !resolvedClient && !(await this.repo.organizationExists(actor.tenantId, requestedClient))) throw new NotFoundException("Organization not found");
    const owner = { tenantId: actor.tenantId, orgId: actor.orgId, createdBy: actor.userId! };
    const number = await this.repo.getNextInvoiceNumber(actor.tenantId);
    const { subtotal, taxAmount, total } = computeTotals(input.lineItems);
    const invoice = await this.repo.createInvoice({ ...input, ...owner, ...assoc, clientOrgId: resolvedClient ?? requestedClient, number, subtotal, taxAmount, total });
    this.logger.log(`[finance] invoice created id=${invoice.id} number=${number} total=${total}`);
    this.syncContext(actor.tenantId, invoice.projectId, "finance.invoice.created", "invoice created");
    return invoice;
  }

  async getInvoice(id: string, actor: ScopeActor) {
    const inv = await this.repo.findInvoiceById(id, actor.tenantId);
    await this.policy.assertRowAccess(actor, inv, "Invoice not found");
    if (!inv) throw new NotFoundException("Invoice not found");
    return inv;
  }

  async listInvoices(input: {
    tenantId: string; orgId?: string; projectId?: string;
    status?: InvoiceStatus; limit?: number; cursor?: string;
  }, actor: ScopeActor) {
    const projectId = financeId(input.projectId, "projectId");
    if (projectId) await this.policy.assertProjectFilter(actor, projectId);
    const cursor = financeId(input.cursor, "cursor");
    if (cursor) await this.getInvoice(cursor, actor);
    const scope = projectId ? undefined : await this.policy.listScope(actor);
    return this.repo.listInvoices({ ...input, tenantId: actor.tenantId, orgId: undefined, projectId, cursor, scope, limit: this.listLimit(input.limit, 50) });
  }

  async sendInvoice(id: string, actor: ScopeActor) {
    const inv = await this.getInvoice(id, actor);
    if (inv.status !== "draft") return inv;
    const updated = await this.repo.updateInvoiceStatus(id, actor.tenantId, "sent", { sentAt: new Date() });
    this.logger.log(`[finance] invoice sent id=${id}`);
    this.syncContext(actor.tenantId, updated.projectId, "finance.invoice.sent", "invoice sent");
    return updated;
  }

  async markInvoicePaid(id: string, actor: ScopeActor) {
    await this.getInvoice(id, actor);
    const updated = await this.repo.updateInvoiceStatus(id, actor.tenantId, "paid", { paidAt: new Date() });
    this.logger.log(`[finance] invoice paid id=${id}`);
    this.syncContext(actor.tenantId, updated.projectId, "finance.invoice.paid", "invoice marked paid");
    return updated;
  }

  async markInvoiceViewed(id: string, actor: ScopeActor) {
    const inv = await this.getInvoice(id, actor);
    if (inv.viewedAt) return inv;
    const updated = await this.repo.updateInvoiceStatus(id, actor.tenantId, inv.status === "sent" ? "viewed" : inv.status, { viewedAt: new Date() });
    this.syncContext(actor.tenantId, updated.projectId, "finance.invoice.viewed", "invoice viewed");
    return updated;
  }

  async updateInvoice(id: string, actor: ScopeActor, data: Parameters<FinanceRepository["updateInvoice"]>[2]) {
    const current = await this.getInvoice(id, actor);
    const allowed = new Set(["title", "lineItems", "dueDate", "notes", "terms", "pdfUrl"]);
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some(key => !allowed.has(key))) {
      throw new BadRequestException("Invoice patch contains server-owned or unsupported fields");
    }
    for (const key of ["title", "notes", "terms", "pdfUrl"] as const) {
      if (data[key] !== undefined && typeof data[key] !== "string") throw new BadRequestException(`Invalid ${key}`);
    }
    if (data.dueDate !== undefined && data.dueDate !== null) {
      const date = new Date(data.dueDate);
      if (!Number.isFinite(date.getTime())) throw new BadRequestException("Invalid dueDate");
      data = { ...data, dueDate: date };
    }
    const lineItems = data.lineItems;
    const extras = lineItems ? computeTotals(lineItems) : {};
    const updated = await this.repo.updateInvoice(id, actor.tenantId, { ...data, ...extras });
    this.syncContext(actor.tenantId, updated.projectId ?? current.projectId, "finance.invoice.updated", "invoice updated");
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
  }, actor: ScopeActor) {
    this.policy.assertOwner(actor);
    const assoc: FinanceAssociations = { projectId: financeId(input.projectId, "projectId"), jobId: financeId(input.jobId, "jobId") };
    await this.policy.assertCanCreate(actor, assoc);
    const milestoneId = financeId(input.milestoneId, "milestoneId");
    const invoiceId = financeId(input.invoiceId, "invoiceId");
    const mergeAssociation = (key: "projectId" | "jobId", value: string | null | undefined) => {
      if (!value) return;
      if (assoc[key] && assoc[key] !== value) throw new BadRequestException(`Incompatible ${key} association`);
      assoc[key] = value;
    };
    if (milestoneId) {
      const milestone = await this.repo.findMilestoneAssociation(actor.tenantId, milestoneId);
      if (!milestone) throw new NotFoundException("Milestone not found");
      await this.policy.assertProjectFilter(actor, milestone.projectId);
      mergeAssociation("projectId", milestone.projectId);
    }
    if (invoiceId) {
      const invoice = await this.getInvoice(invoiceId, actor);
      mergeAssociation("projectId", invoice.projectId);
      mergeAssociation("jobId", invoice.jobId);
    }
    await this.policy.assertCanCreate(actor, assoc);
    if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount >= 1e10) throw new BadRequestException("Invalid expense amount");
    input = { ...input, ...assoc, milestoneId, invoiceId, tenantId: actor.tenantId, orgId: actor.orgId, submittedBy: actor.userId! };
    const duplicateOfId = await this.repo.detectDuplicates({ tenantId: actor.tenantId, orgId: actor.orgId, ...assoc, currency: input.currency ?? "USD", amount: input.amount, vendor: input.vendor });
    const expense = await this.repo.createExpense({ ...input, isDuplicate: !!duplicateOfId, duplicateOfId });

    if (duplicateOfId) {
      this.logger.warn(`[finance] potential duplicate expense id=${expense.id} duplicateOfId=${duplicateOfId}`);
      this.syncContext(input.tenantId, expense.projectId, "finance.expense.duplicate", "expense duplicate detected");
      if (expense.projectId) {
        await this.lifecycleProjectionEvents?.emit({
          tenantId: input.tenantId,
          orgId: input.orgId,
          projectId: expense.projectId,
          sourceEventType: "finance.expense.duplicate",
          sourceEntityType: "ProjectExpense",
          sourceEntityId: expense.id,
          actorType: "user",
          actorId: input.submittedBy,
          correlationId: `expense:${expense.id}:duplicate`,
        });
      }
      return { ...expense, isDuplicate: true, duplicateOfId };
    }

    this.logger.log(`[finance] expense created id=${expense.id} amount=${input.amount} category=${input.category}`);
    this.syncContext(input.tenantId, expense.projectId, "finance.expense.created", "expense created");
    if (expense.projectId) {
      await this.lifecycleProjectionEvents?.emit({
        tenantId: input.tenantId,
        orgId: input.orgId,
        projectId: expense.projectId,
        sourceEventType: "finance.expense.created",
        sourceEntityType: "ProjectExpense",
        sourceEntityId: expense.id,
        actorType: "user",
        actorId: input.submittedBy,
        correlationId: `expense:${expense.id}:created`,
      });
    }
    return expense;
  }

  async getExpense(id: string, actor: ScopeActor) {
    const e = await this.repo.findExpenseById(id, actor.tenantId);
    await this.policy.assertRowAccess(actor, e, "Expense not found");
    if (!e) throw new NotFoundException("Expense not found");
    return e;
  }

  async listExpenses(input: {
    tenantId: string; orgId?: string; projectId?: string;
    category?: ExpenseCategory; status?: string; limit?: number; cursor?: string;
  }, actor: ScopeActor) {
    const projectId = financeId(input.projectId, "projectId");
    if (projectId) await this.policy.assertProjectFilter(actor, projectId);
    const cursor = financeId(input.cursor, "cursor");
    if (cursor) await this.getExpense(cursor, actor);
    const scope = projectId ? undefined : await this.policy.listScope(actor);
    return this.repo.listExpenses({ ...input, tenantId: actor.tenantId, orgId: undefined, projectId, cursor, scope, limit: this.listLimit(input.limit, 100) } as Parameters<FinanceRepository["listExpenses"]>[0]);
  }

  async approveExpense(id: string, actor: ScopeActor) {
    const tenantId = actor.tenantId;
    const approvedBy = actor.userId!;
    await this.getExpense(id, actor);
    const updated = await this.repo.updateExpenseStatus(id, tenantId, "approved", approvedBy);
    this.syncContext(actor.tenantId, updated.projectId, "finance.expense.approved", "expense approved");
    if (updated.projectId) {
      await this.lifecycleProjectionEvents?.emit({
        tenantId,
        orgId: "system",
        projectId: updated.projectId,
        sourceEventType: "finance.expense.approved",
        sourceEntityType: "ProjectExpense",
        sourceEntityId: updated.id,
        actorType: "user",
        actorId: approvedBy,
        correlationId: `expense:${updated.id}:approved`,
      });
    }
    return updated;
  }

  async rejectExpense(id: string, actor: ScopeActor) {
    const tenantId = actor.tenantId;
    await this.getExpense(id, actor);
    const updated = await this.repo.updateExpenseStatus(id, tenantId, "rejected");
    this.syncContext(actor.tenantId, updated.projectId, "finance.expense.rejected", "expense rejected");
    if (updated.projectId) {
      await this.lifecycleProjectionEvents?.emit({
        tenantId,
        orgId: "system",
        projectId: updated.projectId,
        sourceEventType: "finance.expense.rejected",
        sourceEntityType: "ProjectExpense",
        sourceEntityId: updated.id,
        actorType: "system",
        actorId: "finance-service",
        correlationId: `expense:${updated.id}:rejected`,
      });
    }
    return updated;
  }

  private listLimit(value: number | undefined, fallback: number): number {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? Math.min(value, 500) : fallback;
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

  async getProjectSummary(actor: ScopeActor, projectId: string) {
    await this.policy.assertProjectFilter(actor, projectId);
    return this.repo.getProjectFinancialSummary(actor.tenantId, projectId);
  }

  // ── AI context block ──────────────────────────────────────────────────────────

  async buildFinanceContextBlock(actor: ScopeActor, projectId: string): Promise<string> {
    await this.policy.assertProjectFilter(actor, projectId);
    try {
      const summary = await this.getProjectSummary(actor, projectId);
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
