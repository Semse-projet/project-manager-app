// Conduit Offset Engine V1 — deterministic conduit-bending geometry.
//
// Golden contract (do not change without updating the golden test):
//   offset = 6in, angle = 30deg -> spacing = 12in
//
// spacing (canonical, used for actual bend placement) = offset / sin(angle)
// theoreticalShrink (geometric reference only, NEVER the canonical spacing) =
//   offset * tan(angle / 2)
//
// AI/Prometeo is not the final authority on this calculation (see
// 01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md, "AI is not final authority").
// This module is the single deterministic source of truth for conduit-offset
// geometry, importable from both apps/api and apps/mobile.

export type ConduitOffsetInput = {
  /** Desired offset height, in inches. */
  offsetIn: number;
  /** Bend angle, in degrees. Must be in (0, 180). */
  angleDeg: number;
};

export type ConduitOffsetResult = {
  offsetIn: number;
  angleDeg: number;
  /** Canonical distance between bend marks, in inches. spacing = offset / sin(angle). */
  spacingIn: number;
  /**
   * Theoretical/geometric shrink only. NEVER use this as the canonical
   * spacing value — it exists purely as a reference figure.
   * theoreticalShrink = offset * tan(angle / 2)
   */
  theoreticalShrinkIn: number;
};

export class InvalidConduitOffsetInputError extends Error {}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Pure, deterministic conduit-offset geometry calculation.
 * Always safe to call — never fabricates tool-specific data, only geometry.
 */
export function calculateConduitOffset(input: ConduitOffsetInput): ConduitOffsetResult {
  if (!Number.isFinite(input.offsetIn) || input.offsetIn <= 0) {
    throw new InvalidConduitOffsetInputError("offsetIn must be a finite number greater than 0.");
  }
  if (!Number.isFinite(input.angleDeg) || input.angleDeg <= 0 || input.angleDeg >= 180) {
    throw new InvalidConduitOffsetInputError("angleDeg must be a finite number in (0, 180).");
  }

  const angleRad = toRadians(input.angleDeg);
  const spacingIn = input.offsetIn / Math.sin(angleRad);
  const theoreticalShrinkIn = input.offsetIn * Math.tan(angleRad / 2);

  return {
    offsetIn: input.offsetIn,
    angleDeg: input.angleDeg,
    spacingIn,
    theoreticalShrinkIn,
  };
}

// ─── Bender verification gate ────────────────────────────────────────────
//
// Unknown/unverified bender profiles must never produce an exact
// arrow/star/tool-specific marking. Geometry (calculateConduitOffset) stays
// available regardless — only marking synthesis is gated.

export type BenderProfile = {
  /** Human-readable bender make/model, e.g. "Greenlee 555". */
  name: string;
  /** Tool-specific arrow/star mark offsets, when the manufacturer provides them. */
  markData?: Record<string, unknown>;
};

export type BenderVerification =
  | { verified: true; profile: BenderProfile }
  | { verified: false };

export class UnverifiedBenderError extends Error {
  constructor() {
    super(
      "Bender profile not verified — cannot generate exact arrow/star/tool-specific marking. " +
        "Geometry remains available via calculateConduitOffset()."
    );
    this.name = "UnverifiedBenderError";
  }
}

/**
 * Hard guard: throws UnverifiedBenderError unless the bender profile is
 * verified. Callers MUST pass this assertion before synthesizing any
 * tool-specific marking output — the guard lives here so it cannot be
 * forgotten at each call site.
 */
export function assertBenderVerifiedForMarking(
  bender: BenderVerification
): asserts bender is { verified: true; profile: BenderProfile } {
  if (!bender.verified) {
    throw new UnverifiedBenderError();
  }
}
