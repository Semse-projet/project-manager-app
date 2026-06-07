export function buildIdempotencyKey(parts: string[]): string {
  return parts.join("::");
}
