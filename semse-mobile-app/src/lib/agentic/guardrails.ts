export type GuardrailDecision = "allow" | "review" | "deny";

export type GuardrailContext = {
  actionType: string;
  touchesMoney?: boolean;
  touchesDispute?: boolean;
  affectsContract?: boolean;
  confidence?: number;
};

export function evaluateAgenticGuardrail(context: GuardrailContext): GuardrailDecision {
  if (context.touchesMoney || context.touchesDispute || context.affectsContract) {
    return "review";
  }

  if (typeof context.confidence === "number" && context.confidence < 0.5) {
    return "review";
  }

  return "allow";
}
