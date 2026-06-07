import test from "node:test";
import assert from "node:assert/strict";

/**
 * Finance Module — Tests unitarios
 * Sin DB, sin HTTP. Cubre cálculos financieros, detección de duplicados,
 * numeración de facturas, margin y alertas de vencimiento.
 */

// ── Invoice numbering ─────────────────────────────────────────────────────────

function generateInvoiceNumber(prefix: string, count: number): string {
  return `${prefix}-${String(count).padStart(4, "0")}`;
}

test("FIN.I1: número de factura con formato INV-XXXX", () => {
  assert.equal(generateInvoiceNumber("INV", 1),    "INV-0001");
  assert.equal(generateInvoiceNumber("INV", 42),   "INV-0042");
  assert.equal(generateInvoiceNumber("INV", 1000), "INV-1000");
  assert.equal(generateInvoiceNumber("INV", 9999), "INV-9999");
});

test("FIN.I2: número de factura con más de 4 dígitos no se trunca", () => {
  assert.equal(generateInvoiceNumber("INV", 10000), "INV-10000");
});

// ── Invoice calculations ──────────────────────────────────────────────────────

function calculateInvoiceTotals(subtotal: number, taxRate: number): { taxAmount: number; total: number } {
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total     = Math.round((subtotal + taxAmount) * 100) / 100;
  return { taxAmount, total };
}

test("FIN.I3: cálculo de totals con IVA 16%", () => {
  const { taxAmount, total } = calculateInvoiceTotals(1000, 0.16);
  assert.equal(taxAmount, 160);
  assert.equal(total, 1160);
});

test("FIN.I4: cálculo sin impuesto", () => {
  const { taxAmount, total } = calculateInvoiceTotals(500, 0);
  assert.equal(taxAmount, 0);
  assert.equal(total, 500);
});

test("FIN.I5: cálculo con valores decimales redondea correctamente", () => {
  const { total } = calculateInvoiceTotals(99.99, 0.10);
  assert.equal(total, 109.99);
});

// ── Expense duplicate detection ───────────────────────────────────────────────

type Expense = { amount: number; category: string; vendor?: string; expenseDate: string; projectId?: string };

function isPotentialDuplicate(newExp: Expense, existing: Expense[]): boolean {
  return existing.some(
    (e) =>
      e.amount      === newExp.amount &&
      e.category    === newExp.category &&
      e.expenseDate === newExp.expenseDate &&
      e.projectId   === newExp.projectId,
  );
}

test("FIN.E1: gasto idéntico → isDuplicate=true", () => {
  const existing: Expense[] = [
    { amount: 250, category: "materials", expenseDate: "2026-05-19", projectId: "p1" },
  ];
  const newExp: Expense = { amount: 250, category: "materials", expenseDate: "2026-05-19", projectId: "p1" };
  assert.ok(isPotentialDuplicate(newExp, existing));
});

test("FIN.E2: monto diferente → no duplicado", () => {
  const existing: Expense[] = [
    { amount: 250, category: "materials", expenseDate: "2026-05-19", projectId: "p1" },
  ];
  const newExp: Expense = { amount: 300, category: "materials", expenseDate: "2026-05-19", projectId: "p1" };
  assert.equal(isPotentialDuplicate(newExp, existing), false);
});

test("FIN.E3: fecha diferente → no duplicado", () => {
  const existing: Expense[] = [
    { amount: 250, category: "materials", expenseDate: "2026-05-18", projectId: "p1" },
  ];
  const newExp: Expense = { amount: 250, category: "materials", expenseDate: "2026-05-19", projectId: "p1" };
  assert.equal(isPotentialDuplicate(newExp, existing), false);
});

test("FIN.E4: sin gastos previos → no duplicado", () => {
  assert.equal(isPotentialDuplicate({ amount: 100, category: "tools", expenseDate: "2026-05-19" }, []), false);
});

// ── Financial summary / margin ────────────────────────────────────────────────

type FinanceSummary = {
  totalInvoiced: number; totalPaid: number; totalPending: number;
  totalExpenses: number; margin: number; overdueCount: number;
};

function buildFinanceSummary(
  invoices: Array<{ total: number; status: string }>,
  expenses: number[],
): FinanceSummary {
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid     = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalPending  = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + i.total, 0);
  const overdueCount  = invoices.filter((i) => i.status === "overdue").length;
  const totalExpenses = expenses.reduce((s, e) => s + e, 0);
  const margin        = totalInvoiced > 0
    ? Math.round(((totalInvoiced - totalExpenses) / totalInvoiced) * 100 * 100) / 100
    : 0;
  return { totalInvoiced, totalPaid, totalPending, totalExpenses, margin, overdueCount };
}

test("FIN.M1: margin calculation correcto", () => {
  const summary = buildFinanceSummary(
    [{ total: 1000, status: "paid" }, { total: 500, status: "sent" }],
    [300],
  );
  assert.equal(summary.totalInvoiced, 1500);
  assert.equal(summary.totalExpenses, 300);
  assert.ok(summary.margin > 70, `margin ${summary.margin}% debe ser > 70%`);
});

test("FIN.M2: sin facturas → margin=0", () => {
  const summary = buildFinanceSummary([], [100]);
  assert.equal(summary.margin, 0);
  assert.equal(summary.totalInvoiced, 0);
});

test("FIN.M3: overdueCount correcto", () => {
  const summary = buildFinanceSummary([
    { total: 100, status: "paid" },
    { total: 200, status: "overdue" },
    { total: 300, status: "overdue" },
    { total: 400, status: "sent" },
  ], []);
  assert.equal(summary.overdueCount, 2);
});

test("FIN.M4: totalPaid y totalPending correctos", () => {
  const summary = buildFinanceSummary([
    { total: 1000, status: "paid" },
    { total: 500,  status: "sent" },
    { total: 200,  status: "draft" },
  ], []);
  assert.equal(summary.totalPaid, 1000);
  assert.equal(summary.totalPending, 500);
  assert.equal(summary.totalInvoiced, 1700);
});

// ── Invoice status transitions ────────────────────────────────────────────────

type InvoiceStatus = "draft" | "sent" | "viewed" | "paid" | "overdue" | "cancelled";

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft:     ["sent", "cancelled"],
  sent:      ["viewed", "paid", "overdue", "cancelled"],
  viewed:    ["paid", "overdue", "cancelled"],
  paid:      [],
  overdue:   ["paid", "cancelled"],
  cancelled: [],
};

function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

test("FIN.T1: draft → sent es válido", () => {
  assert.ok(canTransition("draft", "sent"));
});

test("FIN.T2: paid → cualquier estado no es válido", () => {
  const targets: InvoiceStatus[] = ["draft", "sent", "cancelled", "overdue"];
  targets.forEach((t) => {
    assert.equal(canTransition("paid", t), false, `paid → ${t} debe ser inválido`);
  });
});

test("FIN.T3: sent → paid es válido", () => {
  assert.ok(canTransition("sent", "paid"));
});

test("FIN.T4: overdue → paid es válido (recuperación)", () => {
  assert.ok(canTransition("overdue", "paid"));
});

test("FIN.T5: cancelled es estado final", () => {
  const targets: InvoiceStatus[] = ["draft", "sent", "paid"];
  targets.forEach((t) => {
    assert.equal(canTransition("cancelled", t), false);
  });
});

// ── Expense categories ────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "materials", "labor", "equipment", "travel", "permits",
  "subcontractor", "overhead", "tools", "other",
]);

test("FIN.C1: categorías válidas reconocidas", () => {
  assert.ok(VALID_CATEGORIES.has("materials"));
  assert.ok(VALID_CATEGORIES.has("labor"));
  assert.ok(VALID_CATEGORIES.has("permits"));
});

test("FIN.C2: categoría desconocida no está en el set", () => {
  assert.equal(VALID_CATEGORIES.has("random"), false);
  assert.equal(VALID_CATEGORIES.has(""), false);
});

// ── computeTotals — lógica del FinanceService ─────────────────────────────────

type LineItem = { qty: number; unitPrice: number; taxRate: number };

function computeTotals(items: LineItem[]): { subtotal: number; taxAmount: number; total: number } {
  let subtotal = 0, taxAmount = 0;
  for (const li of items) {
    const lineTotal = li.qty * li.unitPrice;
    subtotal  += lineTotal;
    taxAmount += lineTotal * (li.taxRate / 100);
  }
  return {
    subtotal:  parseFloat(subtotal.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    total:     parseFloat((subtotal + taxAmount).toFixed(2)),
  };
}

test("FIN.CT1: single item no-tax", () => {
  const r = computeTotals([{ qty: 8, unitPrice: 50, taxRate: 0 }]);
  assert.equal(r.subtotal, 400);
  assert.equal(r.taxAmount, 0);
  assert.equal(r.total, 400);
});

test("FIN.CT2: item con tax 8.5%", () => {
  const r = computeTotals([{ qty: 10, unitPrice: 100, taxRate: 8.5 }]);
  assert.equal(r.subtotal, 1000);
  assert.equal(r.taxAmount, 85);
  assert.equal(r.total, 1085);
});

test("FIN.CT3: lista vacía → ceros", () => {
  const r = computeTotals([]);
  assert.equal(r.total, 0);
});

test("FIN.CT4: total = subtotal + taxAmount (invariante)", () => {
  const r = computeTotals([
    { qty: 5, unitPrice: 120, taxRate: 7 },
    { qty: 1, unitPrice: 80, taxRate: 0 },
  ]);
  assert.ok(Math.abs(r.total - (r.subtotal + r.taxAmount)) < 0.01);
});

test("FIN.CT5: precisión float — 3 items decimales", () => {
  const r = computeTotals([
    { qty: 1, unitPrice: 33.33, taxRate: 0 },
    { qty: 1, unitPrice: 33.33, taxRate: 0 },
    { qty: 1, unitPrice: 33.34, taxRate: 0 },
  ]);
  assert.equal(r.subtotal, 100);
});

// ── OCR receipt amount extraction ─────────────────────────────────────────────

function extractReceiptTotal(text: string): number | null {
  const patterns = [
    /TOTAL[\s:$]*(\d+(?:\.\d{2})?)/i,
    /Total Amount[\s:$]*(\d+(?:\.\d{2})?)/i,
    /Amount Due[\s:$]*(\d+(?:\.\d{2})?)/i,
    /Grand Total[\s:$]*(\d+(?:\.\d{2})?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return parseFloat(m[1]);
  }
  return null;
}

test("FIN.OCR1: extrae TOTAL de recibo", () => {
  assert.equal(extractReceiptTotal("HomeDepot\nTOTAL $80.00"), 80.00);
});

test("FIN.OCR2: extrae 'Total Amount'", () => {
  assert.equal(extractReceiptTotal("Total Amount: 125.50"), 125.50);
});

test("FIN.OCR3: extrae 'Grand Total'", () => {
  assert.equal(extractReceiptTotal("Grand Total $999.99"), 999.99);
});

test("FIN.OCR4: sin total retorna null", () => {
  assert.equal(extractReceiptTotal("Sin datos de total aquí"), null);
});
