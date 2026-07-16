export type ConsumerEnvironment = Record<string, string | undefined>;
export type EvidenceReadiness = "missing" | "partial" | "complete";

export function isDomainEventConsumersEnabled(
  environment: ConsumerEnvironment = process.env,
): boolean {
  return environment.SEMSE_EVENT_CONSUMERS_ENABLED === "true";
}

export function parseEventConsumerAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function calculateEvidenceReadiness(
  requiredEvidenceTypes: readonly string[],
  presentEvidenceTypes: readonly string[],
): EvidenceReadiness {
  const required = new Set(
    requiredEvidenceTypes.map((entry) => entry.trim().toUpperCase()).filter(Boolean),
  );
  if (required.size === 0) {
    return "complete";
  }

  const present = new Set(
    presentEvidenceTypes.map((entry) => entry.trim().toUpperCase()).filter(Boolean),
  );
  const presentRequiredCount = [...required].filter((entry) => present.has(entry)).length;
  if (presentRequiredCount === 0) {
    return "missing";
  }
  return presentRequiredCount === required.size ? "complete" : "partial";
}

export function redactConsumerError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\b(rediss?|https?):\/\/[^@/\s]+@/gi, "$1://***@")
    .replace(/\b(password|token|secret|api[_-]?key)=([^\s&]+)/gi, "$1=***")
    .slice(0, 500);
}
