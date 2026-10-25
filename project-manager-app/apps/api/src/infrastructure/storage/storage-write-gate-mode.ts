import { ServiceUnavailableException } from "@nestjs/common";
import { isProductionStorage } from "./production-storage-guard.js";
import { resolveStorageWriteGateScope } from "./storage-write-gate-scope.js";

type GateModeEnv = Partial<Pick<NodeJS.ProcessEnv,
  "NODE_ENV" | "RAILWAY_ENVIRONMENT" | "RAILWAY_ENVIRONMENT_NAME" |
  "RAILWAY_PROJECT_ID" | "RAILWAY_ENVIRONMENT_ID" | "SEMSE_STORAGE_ROOT" |
  "SEMSE_STORAGE_WRITE_GATE_MODE" |
  "SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE"
>>;

export type StorageWriteGateControlLevel = "observe" | "provision" | "mutate";

function runtimeMode(env: GateModeEnv): string {
  return (env.SEMSE_STORAGE_WRITE_GATE_MODE ?? "off").trim().toLowerCase();
}

function productionControlMode(env: GateModeEnv): string {
  return (env.SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE ?? "off")
    .trim()
    .toLowerCase();
}

/**
 * Runtime writer-boundary policy.
 *
 * - off: legacy behavior, no gate dependency.
 * - staging: only non-production environments.
 * - production: only production environments, after a gate has already been
 *   provisioned OPEN through the separately controlled production control plane.
 *
 * Any mode/environment mismatch fails closed rather than silently downgrading.
 */
export function storageWriteGateRuntimeEnabled(
  env: GateModeEnv = process.env,
): boolean {
  const mode = runtimeMode(env);
  if (mode === "off") return false;

  const production = isProductionStorage(env);
  if (mode === "staging" && !production) return true;
  if (mode === "production" && production) {
    // A missing ID must not bind production writers to a staging scope.
    resolveStorageWriteGateScope(env);
    return true;
  }

  throw new ServiceUnavailableException(
    "Storage write gate mode is not approved for this environment",
  );
}

/**
 * Control-plane exposure policy.
 *
 * Staging keeps the full control plane.
 * Production is deliberately canary-only in this slice:
 *   - observe: status/count only
 *   - provision: status/count + idempotent OPEN provision
 *   - mutate: NEVER allowed in production here
 *
 * This permits provisioning the durable OPEN row before runtime enforcement is
 * enabled, avoiding a fail-closed outage window. Drain/freeze/thaw/recovery
 * remain unavailable until a separately reviewed production-control slice.
 */
export function assertStorageWriteGateControl(
  level: StorageWriteGateControlLevel,
  env: GateModeEnv = process.env,
): void {
  const production = isProductionStorage(env);
  const mode = runtimeMode(env);

  if (!production) {
    if (mode === "staging") return;
    throw new ServiceUnavailableException(
      "Storage write gate control plane is available only in approved staging",
    );
  }

  if (mode !== "off" && mode !== "production") {
    throw new ServiceUnavailableException(
      "Storage write gate mode is not approved for this environment",
    );
  }

  // Even a read-only production canary must identify its own durable row.
  // Do not expose control on a scope derived from a filesystem path alone.
  resolveStorageWriteGateScope(env);
  const control = productionControlMode(env);
  if (level === "observe" && (control === "observe" || control === "provision")) {
    return;
  }
  if (level === "provision" && control === "provision") {
    return;
  }

  throw new ServiceUnavailableException(
    "Production storage write gate control is not armed for this action",
  );
}
