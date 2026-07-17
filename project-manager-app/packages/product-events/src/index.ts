/**
 * @semse/product-events — SDK web de Product Intelligence (PI-02.2).
 * Spec: docs/specs/platform/product-intelligence.spec.md (APPROVED).
 *
 * Garantías:
 * - No-op total si `enabled` es false (kill switch PRODUCT_INTELLIGENCE_ENABLED).
 * - Redacción en cliente: emails/teléfonos/direcciones nunca salen del navegador.
 * - Props fuera de la allowlist del evento se descartan ANTES de enviar.
 * - consentClass=restricted → solo eventos esenciales.
 * - Batching con batchId idempotente: un reintento reutiliza el mismo batchId.
 */

import {
  ESSENTIAL_EVENTS,
  PRODUCT_EVENT_ALLOWLIST,
  PRODUCT_EVENT_BATCH_MAX,
  productEventBatchSchema,
  type ConsentClass,
  type ProductEvent,
  type ProductEventBatch,
} from "@semse/schemas";
import { redactProps, sanitizeRoute, type ScalarProp } from "./redact.ts";

export { redactValue, redactProps, sanitizeRoute, REDACTED } from "./redact.ts";
export { createRageClickDetector, createNavLoopDetector, type FrictionTracker } from "./friction.ts";

export type ProductEventsClientOptions = {
  /** Kill switch. false → todas las operaciones son no-op. */
  enabled: boolean;
  /** URL del endpoint de ingesta (BFF o API). */
  endpoint: string;
  consentClass: ConsentClass;
  /** Identidad de sesión; el host decide cómo generarla/persistirla. */
  sessionId: string;
  anonymousId: string;
  userId?: string | null;
  /** Flush automático al alcanzar este tamaño (máx 50). Default 20. */
  flushAt?: number;
  /** fetch inyectable para tests / SSR. Default: globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Callback opcional de diagnóstico (eventos descartados, errores de red). */
  onDiagnostic?: (message: string) => void;
};

export type TrackResult = "queued" | "dropped_disabled" | "dropped_consent" | "dropped_unknown_event";

export type ProductEventsClient = {
  track: (name: string, props?: Record<string, ScalarProp>, route?: string) => TrackResult;
  flush: () => Promise<{ sent: number; ok: boolean }>;
  pendingCount: () => number;
  setUserId: (userId: string | null) => void;
};

export function createProductEventsClient(options: ProductEventsClientOptions): ProductEventsClient {
  const flushAt = Math.min(Math.max(options.flushAt ?? 20, 1), PRODUCT_EVENT_BATCH_MAX);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const diagnostic = options.onDiagnostic ?? (() => {});

  let userId: string | null = options.userId ?? null;
  let queue: ProductEvent[] = [];
  /** batch en vuelo: si el envío falla, se reintenta con el MISMO batchId. */
  let inflight: ProductEventBatch | null = null;

  function track(name: string, props: Record<string, ScalarProp> = {}, route = ""): TrackResult {
    if (!options.enabled) return "dropped_disabled";

    const allowed = PRODUCT_EVENT_ALLOWLIST[name];
    if (!allowed) {
      diagnostic(`evento desconocido descartado: ${name}`);
      return "dropped_unknown_event";
    }
    if (options.consentClass === "restricted" && !ESSENTIAL_EVENTS.includes(name)) {
      return "dropped_consent";
    }

    const filtered: Record<string, ScalarProp> = {};
    for (const [key, value] of Object.entries(props)) {
      if (allowed.includes(key)) {
        filtered[key] = value;
      } else {
        diagnostic(`prop fuera de allowlist descartada: ${name}.${key}`);
      }
    }

    queue.push({
      name,
      ts: new Date().toISOString(),
      route: sanitizeRoute(route),
      props: redactProps(filtered),
    });
    if (queue.length > PRODUCT_EVENT_BATCH_MAX) {
      queue = queue.slice(-PRODUCT_EVENT_BATCH_MAX);
    }
    if (queue.length >= flushAt) {
      void flush();
    }
    return "queued";
  }

  async function flush(): Promise<{ sent: number; ok: boolean }> {
    if (!options.enabled) return { sent: 0, ok: true };
    if (!inflight) {
      if (queue.length === 0) return { sent: 0, ok: true };
      const batch: ProductEventBatch = {
        batchId: crypto.randomUUID(),
        sentAt: new Date().toISOString(),
        consentClass: options.consentClass,
        session: {
          sessionId: options.sessionId,
          anonymousId: options.anonymousId,
          userId: options.consentClass === "standard" ? userId : null,
        },
        events: queue.slice(0, PRODUCT_EVENT_BATCH_MAX),
      };
      const parsed = productEventBatchSchema.safeParse(batch);
      if (!parsed.success) {
        // Batch inválido: descartar en vez de reintentar para siempre.
        diagnostic(`batch inválido descartado: ${parsed.error.issues[0]?.message ?? "?"}`);
        queue = queue.slice(batch.events.length);
        return { sent: 0, ok: false };
      }
      inflight = parsed.data;
      queue = queue.slice(inflight.events.length);
    }

    try {
      const response = await fetchImpl(options.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inflight),
        keepalive: true,
      });
      if (!response.ok && response.status !== 409) {
        diagnostic(`ingesta respondió ${response.status}; se reintentará con el mismo batchId`);
        return { sent: 0, ok: false };
      }
      const sent = inflight.events.length;
      inflight = null;
      return { sent, ok: true };
    } catch (error) {
      diagnostic(`fallo de red en flush: ${error instanceof Error ? error.message : "?"}`);
      return { sent: 0, ok: false };
    }
  }

  return {
    track,
    flush,
    pendingCount: () => queue.length + (inflight?.events.length ?? 0),
    setUserId: (next) => {
      userId = next;
    },
  };
}
