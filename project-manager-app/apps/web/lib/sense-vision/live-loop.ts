// Sense Vision — framework-free live-camera logic (unit-tested in
// tests/unit/sense-vision-client.test.ts).
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 P14/P15.

/**
 * Single-flight frame sampler: at most one recognition request in flight.
 * `tick()` is called on a timer (~every 1.5 s); a tick that lands while the
 * previous frame is still being analyzed is dropped, never queued — so a
 * slow provider can't build up a backlog of stale frames.
 */
export function createFrameSampler<Frame, Result>(options: {
  capture: () => Frame | null;
  analyze: (frame: Frame) => Promise<Result>;
  onResult: (result: Result) => void;
  onError: (error: unknown) => void;
}) {
  let inFlight = false;
  let stopped = false;
  let dropped = 0;

  return {
    async tick(): Promise<"sent" | "busy" | "no-frame" | "stopped"> {
      if (stopped) return "stopped";
      if (inFlight) {
        dropped += 1;
        return "busy";
      }
      const frame = options.capture();
      if (frame === null) return "no-frame";
      inFlight = true;
      try {
        const result = await options.analyze(frame);
        if (!stopped) options.onResult(result);
      } catch (error) {
        if (!stopped) options.onError(error);
      } finally {
        inFlight = false;
      }
      return "sent";
    },
    stop() {
      stopped = true;
    },
    get inFlight() {
      return inFlight;
    },
    get dropped() {
      return dropped;
    },
  };
}

export type StabilizerReading = { key: string | null; confidence: number };

/**
 * Keeps the on-screen label from flickering between objects on noisy
 * consecutive frames: the displayed key changes only when the same key
 * appears in `agree` of the last `window` readings, or in a single reading
 * at or above `instantConfidence`. A `null` key ("nothing recognized")
 * follows the same rule, so one bad frame doesn't blank a good result.
 */
export function createResultStabilizer(options: { window?: number; agree?: number; instantConfidence?: number } = {}) {
  const windowSize = options.window ?? 3;
  const agree = options.agree ?? 2;
  const instant = options.instantConfidence ?? 0.9;
  let history: StabilizerReading[] = [];
  let stable: string | null | undefined;

  return {
    push(reading: StabilizerReading): { key: string | null | undefined; changed: boolean } {
      history = [...history, reading].slice(-windowSize);
      const previous = stable;
      if (reading.key !== null && reading.confidence >= instant) {
        stable = reading.key;
      } else {
        const votes = history.filter((entry) => entry.key === reading.key).length;
        if (votes >= agree) stable = reading.key;
      }
      return { key: stable, changed: stable !== previous };
    },
    reset() {
      history = [];
      stable = undefined;
    },
    get current() {
      return stable;
    },
  };
}

/** Longest-edge downscale target for a captured frame; keeps payloads well under the API's 700 KB limit. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Picks the best available voice for a BCP-47 tag (exact match, then language prefix). */
export function pickVoice<V extends { lang: string }>(voices: readonly V[], lang: string): V | null {
  const exact = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const prefix = lang.split("-")[0].toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(`${prefix}-`) || voice.lang.toLowerCase() === prefix) ?? null;
}

export type GateAction = "ACCEPT_RESULT" | "SHOW_ALTERNATIVES" | "RETRY_SCAN" | "ASK_USER" | "ESCALATE_MODEL" | "UNKNOWN";

export type GatePresentation = {
  /** Whether the recognized object may be shown / fed to the stabilizer. */
  showObject: boolean;
  scan: "identified" | "uncertain" | "unknown";
  showAlternatives: boolean;
  /** Hint copy when the gate asks for another look. */
  hint: string | null;
};

/**
 * Maps the Decision Gate (Jev, or its deterministic fallback) to what the
 * camera screen does. Older API responses without `gate` fall back to the
 * recognition status so the page keeps working during a rolling deploy.
 * Spec: docs/specs/prometeo/jev-decision-layer.spec.md §4 J9.
 */
export function presentGate(result: { status: string; gate?: { action: GateAction } | null; alternatives: unknown[] }): GatePresentation {
  const action: GateAction =
    result.gate?.action ??
    (result.status === "recognized"
      ? "ACCEPT_RESULT"
      : result.status === "uncertain"
        ? result.alternatives.length > 0 ? "SHOW_ALTERNATIVES" : "ASK_USER"
        : "RETRY_SCAN");
  switch (action) {
    case "ACCEPT_RESULT":
      return { showObject: true, scan: "identified", showAlternatives: false, hint: null };
    case "SHOW_ALTERNATIVES":
      return { showObject: true, scan: "uncertain", showAlternatives: result.alternatives.length > 0, hint: null };
    case "ASK_USER":
      return { showObject: true, scan: "uncertain", showAlternatives: false, hint: "¿Es esto? Confírmalo o corrígelo." };
    case "RETRY_SCAN":
      return { showObject: false, scan: "unknown", showAlternatives: false, hint: "Acércate, mejora la luz y mantén una sola pieza en el recuadro." };
    case "ESCALATE_MODEL":
      return { showObject: false, scan: "unknown", showAlternatives: false, hint: "No pudimos leer bien esta imagen. Intenta otro ángulo." };
    case "UNKNOWN":
    default:
      return { showObject: false, scan: "unknown", showAlternatives: false, hint: "No reconozco esta pieza todavía. Búscala por nombre abajo." };
  }
}
