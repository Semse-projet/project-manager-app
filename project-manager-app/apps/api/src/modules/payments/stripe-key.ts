/**
 * Forma de STRIPE_SECRET_KEY, sin exponer nunca su valor. Incidente 2026-10-01: la variable
 * contenía el ID de una API key (`mk_…`) en vez de la clave; Stripe respondió "Invalid API key"
 * recién al crear la cuenta Connect y el readiness había dicho `ready: true`.
 *
 * Solo `sk_` (secreta) y `rk_` (restringida) sirven para el backend. `pk_` (publicable) y
 * `mk_` (ID de la key) NO son credenciales de servidor.
 */
export type StripeKeyShape = "missing" | "secret" | "restricted" | "publishable" | "key_id" | "unrecognized";

export function classifyStripeKey(raw: string | undefined): { shape: StripeKeyShape; usable: boolean } {
  const key = raw?.trim();
  if (!key) return { shape: "missing", usable: false };
  if (key.startsWith("sk_")) return { shape: "secret", usable: true };
  if (key.startsWith("rk_")) return { shape: "restricted", usable: true };
  if (key.startsWith("pk_")) return { shape: "publishable", usable: false };
  if (key.startsWith("mk_")) return { shape: "key_id", usable: false };
  return { shape: "unrecognized", usable: false };
}

const SHAPE_HINT: Partial<Record<StripeKeyShape, string>> = {
  key_id: "es el ID de una API key (mk_…), no la clave: use la clave secreta (sk_…) o restringida (rk_…)",
  publishable: "es una clave publicable (pk_…): el backend necesita la clave secreta (sk_…) o restringida (rk_…)",
  unrecognized: "no tiene el formato de una clave de Stripe (sk_… / rk_…)",
};

export function stripeKeyWarning(raw: string | undefined): string | undefined {
  const { shape, usable } = classifyStripeKey(raw);
  if (usable || shape === "missing") return undefined;
  return `STRIPE_SECRET_KEY configurada pero inválida (${shape}): ${SHAPE_HINT[shape]}`;
}
