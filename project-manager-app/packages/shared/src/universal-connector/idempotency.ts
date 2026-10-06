export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord<TResult = unknown> {
  tenantId: string;
  connectionId: string;
  key: string;
  fingerprint: string;
  status: IdempotencyStatus;
  result?: TResult;
  createdAt: string;
  updatedAt: string;
}

/**
 * Production adapters must back this interface with durable tenant-isolated storage.
 * The contract intentionally does not claim exactly-once delivery.
 */
export interface IdempotencyStore<TResult = unknown> {
  get(tenantId: string, connectionId: string, key: string): Promise<IdempotencyRecord<TResult> | null>;
  claim(record: IdempotencyRecord<TResult>): Promise<boolean>;
  complete(tenantId: string, connectionId: string, key: string, result: TResult): Promise<void>;
  fail(tenantId: string, connectionId: string, key: string): Promise<void>;
}

export type IdempotentExecutionResult<TResult> =
  | { replayed: false; result: TResult }
  | { replayed: true; result: TResult };

export async function executeIdempotently<TResult>(args: {
  store: IdempotencyStore<TResult>;
  tenantId: string;
  connectionId: string;
  key: string;
  fingerprint: string;
  execute: () => Promise<TResult>;
  now?: () => Date;
}): Promise<IdempotentExecutionResult<TResult>> {
  if (!args.key.trim()) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  const existing = await args.store.get(args.tenantId, args.connectionId, args.key);
  if (existing) {
    if (existing.fingerprint !== args.fingerprint) throw new Error('IDEMPOTENCY_KEY_REUSE_MISMATCH');
    if (existing.status === 'COMPLETED') return { replayed: true, result: existing.result as TResult };
    throw new Error('IDEMPOTENCY_REQUEST_IN_PROGRESS');
  }

  const timestamp = (args.now ?? (() => new Date()))().toISOString();
  const claimed = await args.store.claim({
    tenantId: args.tenantId,
    connectionId: args.connectionId,
    key: args.key,
    fingerprint: args.fingerprint,
    status: 'IN_PROGRESS',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  if (!claimed) throw new Error('IDEMPOTENCY_REQUEST_IN_PROGRESS');

  try {
    const result = await args.execute();
    await args.store.complete(args.tenantId, args.connectionId, args.key, result);
    return { replayed: false, result };
  } catch (error) {
    await args.store.fail(args.tenantId, args.connectionId, args.key);
    throw error;
  }
}
