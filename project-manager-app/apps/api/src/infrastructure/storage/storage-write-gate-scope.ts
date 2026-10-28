import path from "node:path";
import { ServiceUnavailableException } from "@nestjs/common";
import { isProductionStorage } from "./production-storage-guard.js";

/**
 * Scope is a durable database key, not a filesystem locator.
 * Never let Railway staging and production share the same gate row merely
 * because two unrelated volumes happen to be mounted at /data/semse-storage.
 *
 * Legacy non-Railway test scopes remain compatible. A Railway-connected
 * staging environment gets its own project+environment discriminator; any
 * active staging gate must be re-provisioned explicitly under the new scope.
 */
type ScopeEnv = Partial<Pick<NodeJS.ProcessEnv,
  "SEMSE_STORAGE_ROOT" | "NODE_ENV" | "RAILWAY_ENVIRONMENT" |
  "RAILWAY_ENVIRONMENT_NAME" | "RAILWAY_PROJECT_ID" | "RAILWAY_ENVIRONMENT_ID"
>>;

export function resolveStorageWriteGateScope(
  env: ScopeEnv = process.env,
): string {
  const root = path.resolve(env.SEMSE_STORAGE_ROOT ?? "/tmp/semse-storage")
    .replaceAll("\\", "/");
  const projectId = env.RAILWAY_PROJECT_ID;
  const environmentId = env.RAILWAY_ENVIRONMENT_ID;
  const production = isProductionStorage(env);

  if (production || projectId || environmentId) {
    const valid = (value: string | undefined): boolean =>
      typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
    if (!valid(projectId) || !valid(environmentId)) {
      throw new ServiceUnavailableException(
        "Durable storage gate requires Railway project and environment identity",
      );
    }
    return `storage:${projectId}:${environmentId}:${root}`;
  }

  return `storage:${root}`;
}
