/** Mirrors apps/web's fmt() helper (app/(app)/client/finance/page.tsx) — same locale/currency conventions across web and mobile. */
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
}
