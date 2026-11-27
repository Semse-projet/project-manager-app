/**
 * DomainEvent audit rows store entityId as `<type>:<correlationId>`.
 * The correlation may itself contain colons. Matching must compare the
 * segment after the first colon by exact equality — not Prisma/SQL
 * `endsWith`/`LIKE`, which treats `_` and `%` as wildcards and also
 * accepts a longer type+prefix that merely ends with the requested suffix.
 */
export function entityIdMatchesExactCorrelation(
  entityId: string,
  correlationId: string,
): boolean {
  if (typeof entityId !== "string" || typeof correlationId !== "string" || !correlationId) {
    return false;
  }
  const separator = entityId.indexOf(":");
  if (separator <= 0) {
    return false;
  }
  return entityId.slice(separator + 1) === correlationId;
}
