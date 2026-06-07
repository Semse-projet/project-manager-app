import { ServiceUnavailableException } from "@nestjs/common";

export function databaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function requireDatabase(): void {
  if (!databaseEnabled()) {
    throw new ServiceUnavailableException("database persistence is not configured");
  }
}
