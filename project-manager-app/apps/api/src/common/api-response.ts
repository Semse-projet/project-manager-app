export type ApiEnvelope<T> = {
  requestId: string;
  data: T;
};

export function ok<T>(requestId: string, data: T): ApiEnvelope<T> {
  return { requestId, data };
}
