import { HttpException, ServiceUnavailableException } from "@nestjs/common";

/**
 * Event backbone F2 (slice 2 prerequisite, plan `event-backbone-f2-milestones.plan.md` §2a): one outbox event can be
 * consumed by several independent consumers, each with its own `DomainEventConsumption` receipt.
 *
 * Contract:
 *  - A descriptor may declare `appliesTo(event)`; by default it applies to every event of its type. Only applicable
 *    descriptors take part.
 *  - Exactly one applicable descriptor: behaviour is identical to the pre-fan-out registry — 503 if its consumer is
 *    not allowlisted, otherwise its own result (and its own errors) unchanged.
 *  - Several: every allowlisted one runs, in registration order, even if an earlier one failed (one consumer's
 *    failure must not block another's first attempt). Afterwards:
 *      · any retryable failure (5xx, 408, 429 or a non-HTTP error) is re-thrown, so the queue retries the job —
 *        the consumers that already completed answer `duplicate` from their receipt on the retry;
 *      · otherwise the first terminal failure (4xx) is re-thrown;
 *      · otherwise, if an applicable consumer is not allowlisted, 503 (retryable), exactly as a single
 *        non-allowlisted consumer behaves today — the event is not silently skipped for it;
 *      · otherwise an aggregate result listing every consumer's result.
 */

export type FanOutDescriptor<TEvent, TIdentity, TResult> = {
  eventType: string;
  consumerName: string;
  appliesTo?: (event: TEvent) => boolean;
  handle: (event: TEvent, identity: TIdentity) => Promise<TResult>;
};

export type FanOutResult<TResult> = {
  eventId: string;
  consumer: "fan-out";
  status: "completed";
  effect: "updated" | "no_op" | "disabled";
  consumers: TResult[];
};

export function groupDescriptorsByEventType<D extends { eventType: string; consumerName: string }>(
  descriptors: readonly D[],
): ReadonlyMap<string, readonly D[]> {
  const byType = new Map<string, D[]>();
  for (const descriptor of descriptors) {
    const list = byType.get(descriptor.eventType) ?? [];
    if (list.some((existing) => existing.consumerName === descriptor.consumerName)) {
      throw new Error(
        `Duplicate domain event consumer registration: ${descriptor.eventType} → ${descriptor.consumerName}`,
      );
    }
    list.push(descriptor);
    byType.set(descriptor.eventType, list);
  }
  return byType;
}

export function isTerminalConsumerError(error: unknown): boolean {
  if (!(error instanceof HttpException)) return false;
  const status = error.getStatus();
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function notAllowlisted(consumers: string[]): ServiceUnavailableException {
  return new ServiceUnavailableException({
    message: "Domain event consumer is not allowlisted",
    consumer: consumers[0],
    ...(consumers.length > 1 ? { consumers } : {}),
  });
}

export async function dispatchToConsumers<
  TEvent extends { eventId: string },
  TIdentity,
  TResult extends { effect?: string },
>(input: {
  event: TEvent;
  identity: TIdentity;
  descriptors: readonly FanOutDescriptor<TEvent, TIdentity, TResult>[];
  consumerAllowlist: ReadonlySet<string>;
}): Promise<TResult | FanOutResult<TResult>> {
  const applicable = input.descriptors.filter((d) => d.appliesTo?.(input.event) ?? true);
  const allowed = applicable.filter((d) => input.consumerAllowlist.has(d.consumerName));
  const blocked = applicable.filter((d) => !input.consumerAllowlist.has(d.consumerName)).map((d) => d.consumerName);

  if (applicable.length === 1) {
    if (blocked.length) throw notAllowlisted(blocked);
    return applicable[0]!.handle(input.event, input.identity);
  }

  const results: TResult[] = [];
  const errors: unknown[] = [];
  for (const descriptor of allowed) {
    try {
      results.push(await descriptor.handle(input.event, input.identity));
    } catch (error) {
      errors.push(error);
    }
  }

  const retryable = errors.find((error) => !isTerminalConsumerError(error));
  if (retryable !== undefined) throw retryable;
  if (errors.length) throw errors[0];
  if (blocked.length) throw notAllowlisted(blocked);

  const effects = results.map((r) => r.effect);
  return {
    eventId: input.event.eventId,
    consumer: "fan-out",
    status: "completed",
    effect: effects.includes("updated")
      ? "updated"
      : effects.length > 0 && effects.every((e) => e === "disabled")
        ? "disabled"
        : "no_op",
    consumers: results,
  };
}
