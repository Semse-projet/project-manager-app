"use client";

/**
 * Product Intelligence — cliente web (PI-05).
 * Spec: docs/specs/platform/product-intelligence.spec.md (APPROVED).
 *
 * - Kill switch: NEXT_PUBLIC_PRODUCT_INTELLIGENCE_ENABLED !== "true" → no-op
 *   total (el SDK ni siquiera encola).
 * - Consentimiento: sin banner de consentimiento todavía, se opera en clase
 *   "essential": se registran eventos de recorrido SIN userId. "standard"
 *   (con userId) queda para cuando exista el banner.
 * - Identidad: sessionId por pestaña (sessionStorage) y anonymousId aleatorio
 *   persistente (localStorage) — nunca derivado de email ni PII.
 */

import {
  createNavLoopDetector,
  createProductEventsClient,
  createRageClickDetector,
  type ProductEventsClient,
} from "@semse/product-events";

const SESSION_KEY = "semse_pi_session";
const ANON_KEY = "semse_pi_anon";

let client: ProductEventsClient | null = null;
let flushHookInstalled = false;

function readOrCreate(storage: Storage, key: string, create: () => string): string {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const value = create();
    storage.setItem(key, value);
    return value;
  } catch {
    // Storage bloqueado (Safari privado, etc.): identidad efímera.
    return create();
  }
}

function getClient(): ProductEventsClient | null {
  if (typeof window === "undefined") return null;
  if (process.env.NEXT_PUBLIC_PRODUCT_INTELLIGENCE_ENABLED !== "true") return null;
  if (client) return client;

  client = createProductEventsClient({
    enabled: true,
    endpoint: "/api/semse/product-intelligence/ingest",
    consentClass: "essential",
    sessionId: readOrCreate(window.sessionStorage, SESSION_KEY, () => crypto.randomUUID()),
    anonymousId: readOrCreate(window.localStorage, ANON_KEY, () => `anon_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`),
  });

  if (!flushHookInstalled) {
    flushHookInstalled = true;
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void client?.flush();
    });
    window.addEventListener("pagehide", () => {
      void client?.flush();
    });

    // PI-07 — detección de fricción pasiva (solo conteos + ruta).
    const frictionTrack = (name: string, props: Record<string, number>, route: string) => {
      client?.track(name, props, route);
    };
    const onRageClick = createRageClickDetector(frictionTrack);
    document.addEventListener(
      "click",
      (event) => onRageClick(event, window.location.pathname),
      { capture: true, passive: true },
    );
    const onNavigate = createNavLoopDetector(frictionTrack);
    let lastPath = window.location.pathname;
    onNavigate(lastPath);
    window.setInterval(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        onNavigate(lastPath);
      }
    }, 1_000);
  }
  return client;
}

/** Registra un evento de producto. No-op sin kill switch o en SSR. */
export function trackProductEvent(
  name: string,
  props: Record<string, string | number | boolean | null> = {},
): void {
  const active = getClient();
  if (!active) return;
  active.track(name, props, window.location.pathname);
}

/** Fuerza el envío de la cola (por ejemplo antes de una navegación dura). */
export function flushProductEvents(): Promise<unknown> {
  const active = getClient();
  return active ? active.flush() : Promise.resolve();
}
