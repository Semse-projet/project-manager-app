import { z } from "zod";

/**
 * Product Intelligence — contratos de telemetría de producto (PI-02.1).
 * Spec: docs/specs/platform/product-intelligence.spec.md (APPROVED 2026-07-13).
 *
 * ProductEvent ≠ DomainEvent: esto describe qué hizo el usuario en la UI,
 * nunca eventos operacionales del negocio.
 */

export const PRODUCT_EVENT_BATCH_MAX = 50;

export const consentClassSchema = z.enum(["essential", "standard", "restricted"]);
export type ConsentClass = z.infer<typeof consentClassSchema>;

/** namespace.action en minúsculas: auth.register_view, wizard.published… */
export const productEventNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, "formato esperado: namespace.action");

/**
 * Allowlist de props por evento. Una prop fuera de la lista invalida el
 * evento (400 en ingesta) — nunca se silencia. Las props solo admiten
 * escalares; el valor de campos de formulario (fieldValue) está prohibido
 * por diseño y no existe clave para él.
 */
export const PRODUCT_EVENT_ALLOWLIST: Record<string, readonly string[]> = {
  // PI-05 — funnel auth/registro/wizard
  "auth.login_view": ["hasFrom"],
  "auth.register_view": ["hasFrom", "role"],
  "auth.context_recovered": ["target"],
  "wizard.prefill_arrived": ["category", "step", "source"],
  "wizard.published": ["category", "durationMs"],
  // esenciales (permitidos incluso con consentClass=restricted)
  "app.error_view": ["route", "status"],
  "app.not_found": ["route"],
};

/** Eventos permitidos bajo consentimiento `restricted`. */
export const ESSENTIAL_EVENTS: readonly string[] = ["app.error_view", "app.not_found"];

const scalarSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const productEventSchema = z
  .object({
    name: productEventNameSchema,
    ts: z.string().datetime({ offset: true }),
    route: z.string().max(300),
    props: z.record(scalarSchema).default({}),
  })
  .superRefine((event, ctx) => {
    const allowed = PRODUCT_EVENT_ALLOWLIST[event.name];
    if (!allowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: `evento no registrado en PRODUCT_EVENT_ALLOWLIST: ${event.name}`,
      });
      return;
    }
    for (const key of Object.keys(event.props ?? {})) {
      if (!allowed.includes(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["props", key],
          message: `prop fuera de allowlist para ${event.name}: ${key}`,
        });
      }
    }
  });
export type ProductEvent = z.infer<typeof productEventSchema>;

export const productSessionSchema = z.object({
  sessionId: z.string().uuid(),
  /** hash opaco generado en cliente; jamás un email ni derivado de PII */
  anonymousId: z
    .string()
    .min(8)
    .max(64)
    .refine((value) => !value.includes("@"), "anonymousId no puede parecer un email"),
  userId: z.string().min(1).nullable().default(null),
});
export type ProductSession = z.infer<typeof productSessionSchema>;

export const productEventBatchSchema = z
  .object({
    batchId: z.string().uuid(),
    sentAt: z.string().datetime({ offset: true }),
    consentClass: consentClassSchema,
    session: productSessionSchema,
    events: z.array(productEventSchema).min(1).max(PRODUCT_EVENT_BATCH_MAX),
  })
  .superRefine((batch, ctx) => {
    if (batch.consentClass === "restricted") {
      batch.events.forEach((event, index) => {
        if (!ESSENTIAL_EVENTS.includes(event.name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["events", index, "name"],
            message: `consentClass=restricted solo admite eventos esenciales, recibido: ${event.name}`,
          });
        }
      });
    }
    if (batch.consentClass !== "standard" && batch.session.userId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["session", "userId"],
        message: "userId solo se admite con consentClass=standard",
      });
    }
  });
export type ProductEventBatch = z.infer<typeof productEventBatchSchema>;

export const productEventIngestResponseSchema = z.object({
  accepted: z.number().int().min(0),
  duplicated: z.boolean(),
});
export type ProductEventIngestResponse = z.infer<typeof productEventIngestResponseSchema>;
