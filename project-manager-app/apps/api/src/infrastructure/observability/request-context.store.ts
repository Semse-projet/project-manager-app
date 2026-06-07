import { AsyncLocalStorage } from "node:async_hooks";

export type ObservabilityContext = {
  requestId: string;
  correlationId?: string;
  method?: string;
  path?: string;
  userId?: string;
  tenantId?: string;
  orgId?: string;
};

const storage = new AsyncLocalStorage<ObservabilityContext>();

export function runWithObservabilityContext<T>(
  context: ObservabilityContext,
  callback: () => T
): T {
  return storage.run(context, callback);
}

export function getObservabilityContext(): ObservabilityContext | undefined {
  return storage.getStore();
}

export function updateObservabilityContext(
  partial: Partial<ObservabilityContext>
): ObservabilityContext | undefined {
  const current = storage.getStore();
  if (!current) {
    return undefined;
  }

  Object.assign(current, partial);
  return current;
}
