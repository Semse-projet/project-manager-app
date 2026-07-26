export type SafeManualPayoutMethodPayload = {
  type: "paypal" | "zelle" | "cashapp";
  email: string;
};

export type SafePayoutMethodParseResult =
  | { ok: true; data: SafeManualPayoutMethodPayload }
  | { ok: false; error: string };

const SAFE_TYPES = new Set<SafeManualPayoutMethodPayload["type"]>([
  "paypal",
  "zelle",
  "cashapp",
]);
const SAFE_KEYS = new Set(["type", "email"]);

export function parseSafePayoutMethodPayload(
  value: unknown,
): SafePayoutMethodParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "El payload del método de cobro no es válido." };
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !SAFE_KEYS.has(key))) {
    return {
      ok: false,
      error: "No envíes números de tarjeta, cuenta o routing a SEMSE. Usa Stripe Connect.",
    };
  }

  const type = typeof record.type === "string" ? record.type : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";
  if (!SAFE_TYPES.has(type as SafeManualPayoutMethodPayload["type"])) {
    return {
      ok: false,
      error: "Las cuentas bancarias y tarjetas solo se configuran mediante Stripe Connect.",
    };
  }
  if (!email || email.length > 254) {
    return { ok: false, error: "El identificador manual no es válido." };
  }

  return {
    ok: true,
    data: {
      type: type as SafeManualPayoutMethodPayload["type"],
      email,
    },
  };
}
