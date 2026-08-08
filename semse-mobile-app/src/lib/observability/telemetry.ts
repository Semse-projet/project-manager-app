export type TelemetryEvent = {
  name: string;
  surface: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export function trackTelemetryEvent(event: TelemetryEvent): void {
  if (import.meta.env.DEV) {
    console.debug("[semse-mobile:telemetry]", event);
  }
}
