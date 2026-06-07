import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { PdfService } from "../../common/pdf/pdf.service.js";
import { FinanceService } from "./finance.service.js";
import { ReceiptOcrService } from "./receipt-ocr.service.js";
import type { ExpenseCategory, InvoiceStatus, TemplateCategory } from "./finance.repository.js";

function actor(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

@Controller("v1/finance")
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly ocrService: ReceiptOcrService,
    private readonly pdf: PdfService,
  ) {}

  // ── Invoices ──────────────────────────────────────────────────────────────────

  @Get("invoices")
  @RequirePermissions("finance:read")
  async listInvoices(
    @Req() req: FastifyRequest,
    @Query("projectId") projectId?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const data = await this.finance.listInvoices({
      tenantId: ctx.tenantId,
      orgId: ctx.orgId,
      projectId,
      status: status as InvoiceStatus | undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return ok(rid, data);
  }

  @Post("invoices")
  @RequirePermissions("finance:write")
  async createInvoice(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const data = await this.finance.createInvoice({
      tenantId: ctx.tenantId,
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      clientOrgId: body.clientOrgId as string | undefined,
      projectId: body.projectId as string | undefined,
      jobId: body.jobId as string | undefined,
      title: String(body.title ?? "Nueva factura"),
      lineItems: (body.lineItems as Parameters<FinanceService["createInvoice"]>[0]["lineItems"]) ?? [],
      currency: body.currency as string | undefined,
      dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
      notes: body.notes as string | undefined,
      terms: body.terms as string | undefined,
    });
    return ok(rid, data);
  }

  @Get("invoices/:id")
  @RequirePermissions("finance:read")
  async getInvoice(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.getInvoice(id, ctx.tenantId));
  }

  @Get("invoices/:id/pdf")
  @RequirePermissions("finance:read")
  async getInvoicePdf(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Param("id") id: string,
    @Query("type") type?: string,
  ) {
    const ctx = actor(req);
    const invoice = await this.finance.getInvoice(id, ctx.tenantId);
    const docType = (type === "estimate" || invoice.status === "draft") ? "estimate" : "invoice";
    const buf = docType === "estimate"
      ? await this.pdf.generateEstimatePdf(invoice)
      : await this.pdf.generateInvoicePdf(invoice);
    const filename = `${docType === "estimate" ? "estimate" : "invoice"}-${invoice.number}.pdf`;
    void reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Content-Length", String(buf.length))
      .send(buf);
  }

  @Patch("invoices/:id")
  @RequirePermissions("finance:write")
  async updateInvoice(@Req() req: FastifyRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.updateInvoice(id, ctx.tenantId, body as Parameters<FinanceService["updateInvoice"]>[2]));
  }

  @Post("invoices/:id/send")
  @RequirePermissions("finance:write")
  async sendInvoice(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.sendInvoice(id, ctx.tenantId));
  }

  @Post("invoices/:id/pay")
  @RequirePermissions("finance:write")
  async markPaid(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.markInvoicePaid(id, ctx.tenantId));
  }

  @Post("invoices/:id/viewed")
  @RequirePermissions("finance:read")
  async markViewed(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.markInvoiceViewed(id, ctx.tenantId));
  }

  // ── Expenses ──────────────────────────────────────────────────────────────────

  @Get("expenses")
  @RequirePermissions("finance:read")
  async listExpenses(
    @Req() req: FastifyRequest,
    @Query("projectId") projectId?: string,
    @Query("category") category?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.listExpenses({
      tenantId: ctx.tenantId, orgId: ctx.orgId,
      projectId, category: category as ExpenseCategory | undefined,
      status, limit: limit ? parseInt(limit, 10) : 100,
    }));
  }

  @Post("expenses")
  @RequirePermissions("finance:write")
  async createExpense(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.createExpense({
      tenantId: ctx.tenantId, orgId: ctx.orgId, submittedBy: ctx.userId,
      projectId: body.projectId as string | undefined,
      milestoneId: body.milestoneId as string | undefined,
      jobId: body.jobId as string | undefined,
      invoiceId: body.invoiceId as string | undefined,
      category: (body.category as ExpenseCategory) ?? "other",
      subcategory: body.subcategory as string | undefined,
      description: String(body.description ?? ""),
      amount: parseFloat(String(body.amount ?? 0)),
      currency: body.currency as string | undefined,
      vendor: body.vendor as string | undefined,
      expenseDate: body.expenseDate ? new Date(String(body.expenseDate)) : undefined,
      receiptUrl: body.receiptUrl as string | undefined,
      receiptText: body.receiptText as string | undefined,
      notes: body.notes as string | undefined,
    }));
  }

  @Get("expenses/:id")
  @RequirePermissions("finance:read")
  async getExpense(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.getExpense(id, ctx.tenantId));
  }

  @Post("expenses/:id/approve")
  @RequirePermissions("finance:write")
  async approveExpense(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.approveExpense(id, ctx.tenantId, ctx.userId));
  }

  @Post("expenses/:id/reject")
  @RequirePermissions("finance:write")
  async rejectExpense(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.rejectExpense(id, ctx.tenantId));
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  @Get("templates")
  @RequirePermissions("finance:read")
  async listTemplates(
    @Req() req: FastifyRequest,
    @Query("category") category?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.listTemplates({ tenantId: ctx.tenantId, category: category as TemplateCategory | undefined }));
  }

  @Post("templates")
  @RequirePermissions("finance:write")
  async createTemplate(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.createTemplate({
      tenantId: ctx.tenantId, orgId: ctx.orgId, createdBy: ctx.userId,
      name: String(body.name ?? ""), category: (body.category as TemplateCategory) ?? "other",
      bodyJson: body.bodyJson as Record<string, unknown> | undefined,
    }));
  }

  // ── Summary ───────────────────────────────────────────────────────────────────

  @Get("projects/:projectId/summary")
  @RequirePermissions("finance:read")
  async projectSummary(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.finance.getProjectSummary(ctx.tenantId, projectId));
  }

  @Get("projects/:projectId/summary/context")
  @RequirePermissions("finance:read")
  async projectSummaryContext(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, { context: await this.finance.buildFinanceContextBlock(ctx.tenantId, projectId) });
  }

  // ── Receipt OCR ───────────────────────────────────────────────────────────────

  @Post("expenses/scan")
  @RequirePermissions("finance:write")
  async scanReceipt(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const extracted = await this.ocrService.extractFromReceipt({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      receiptText: body.receiptText as string | undefined,
      receiptUrl: body.receiptUrl as string | undefined,
      hint: body.hint as string | undefined,
    });
    return ok(rid, extracted);
  }
}
