/**
 * Mercado público de SEMSE: Florida, Estados Unidos.
 *
 * Toda superficie pública sin autenticación (landing, /worker/apply,
 * /pro/[slug], estimadores) debe formatear dinero con estas utilidades —
 * nunca con formateadores locales sueltos. El soporte multi-moneda interno
 * (labor engine, OCR de recibos) no pasa por aquí.
 */

export const PUBLIC_MARKET_CURRENCY = "USD" as const;
export const PUBLIC_MARKET_LOCALE = "en-US" as const;

const moneyFormatter = new Intl.NumberFormat(PUBLIC_MARKET_LOCALE, {
  style: "currency",
  currency: PUBLIC_MARKET_CURRENCY,
  maximumFractionDigits: 0,
});

/** "$1,500" — moneda del mercado público, sin decimales. */
export function formatPublicMoney(amount: number): string {
  return moneyFormatter.format(amount);
}

/** "$1,500 - $2,200" o "$1,500" si no hay máximo. */
export function formatPublicMoneyRange(min: number, max?: number | null): string {
  if (max === null || max === undefined || max === min) return formatPublicMoney(min);
  return `${formatPublicMoney(min)} - ${formatPublicMoney(max)}`;
}
