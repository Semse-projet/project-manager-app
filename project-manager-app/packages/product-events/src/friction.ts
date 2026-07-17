/**
 * PI-07 — detección de fricción en cliente. Sin contenido del usuario:
 * solo conteos y rutas (que igual pasan por sanitizeRoute al trackear).
 *
 * - rage click: ≥3 clicks sobre el mismo objetivo en <1s.
 * - nav loop: alternancia A→B→A→B en <30s (usuario rebotando entre vistas).
 */

export type FrictionTracker = (name: string, props: Record<string, number>, route: string) => void;

const RAGE_WINDOW_MS = 1_000;
const RAGE_THRESHOLD = 3;
const NAV_WINDOW_MS = 30_000;

export function createRageClickDetector(track: FrictionTracker) {
  let lastTarget: EventTarget | null = null;
  let clicks: number[] = [];

  return function onClick(event: { target: EventTarget | null }, route: string, now = Date.now()): void {
    if (event.target !== lastTarget) {
      lastTarget = event.target;
      clicks = [now];
      return;
    }
    clicks = clicks.filter((t) => now - t < RAGE_WINDOW_MS);
    clicks.push(now);
    if (clicks.length === RAGE_THRESHOLD) {
      track("friction.rage_click", { clicks: clicks.length }, route);
    }
  };
}

export function createNavLoopDetector(track: FrictionTracker) {
  let history: Array<{ route: string; at: number }> = [];

  return function onNavigate(route: string, now = Date.now()): void {
    history = history.filter((entry) => now - entry.at < NAV_WINDOW_MS);
    history.push({ route, at: now });
    if (history.length >= 4) {
      const [a, b, c, d] = history.slice(-4).map((entry) => entry.route);
      if (a === c && b === d && a !== b) {
        track("friction.nav_loop", { count: history.length }, route);
        history = [];
      }
    }
  };
}
