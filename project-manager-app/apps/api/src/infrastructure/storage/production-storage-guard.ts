import { ServiceUnavailableException } from "@nestjs/common";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

type StorageEnv = Pick<NodeJS.ProcessEnv,
  "NODE_ENV" | "RAILWAY_ENVIRONMENT" | "RAILWAY_ENVIRONMENT_NAME" |
  "STORAGE_PROVIDER" | "SEMSE_STORAGE_ROOT">;
const VOLUME = "/data";
const FAIL = "Production originals storage volume is unavailable or incorrectly configured";

export function isProductionStorage(env: StorageEnv): boolean {
  return env.NODE_ENV === "production" ||
    env.RAILWAY_ENVIRONMENT === "production" ||
    env.RAILWAY_ENVIRONMENT_NAME === "production";
}

/** Reject unsafe configuration BEFORE creating directories or returning upload plans.
 * This checks only configuration, not whether Railway's volume is mounted.
 */
export function assertProductionStorageConfiguration(env: StorageEnv = process.env): void {
  if (!isProductionStorage(env)) return;
  const root = env.SEMSE_STORAGE_ROOT;
  if (env.STORAGE_PROVIDER !== "local" || !root ||
      !path.posix.isAbsolute(root) || path.posix.resolve(root) !== root ||
      !root.startsWith(VOLUME + "/") || root.split("/").includes("..")) {
    throw new ServiceUnavailableException(FAIL);
  }
}

export function hasRailwayDataMount(mountInfo: string): boolean {
  // /proc/self/mountinfo's fifth whitespace-delimited field is mountpoint,
  // with octal escapes (such as \040) for whitespace.
  const decode = (value: string) =>
    value.replace(/\\([0-7]{3})/g,
      (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
  return mountInfo.split("\n").some(line => {
    const fields = line.split(" ");
    return fields.length > 5 && decode(fields[4]) === VOLUME;
  });
}

/** Fail closed if /data is just a regular ephemeral directory, missing, or
 * SEMSE_STORAGE_ROOT is a symlink escaping the verified Railway mount.
 * Read-only preflight: never mkdir and never touches client image bytes.
 */
export async function assertProductionStorageMount(
  env: StorageEnv = process.env,
  options: { mountInfo?: string; resolvedRoot?: string } = {},
): Promise<void> {
  assertProductionStorageConfiguration(env);
  if (!isProductionStorage(env)) return;
  try {
    const [mountInfo, resolvedRoot, mountPath] = await Promise.all([
      options.mountInfo ?? readFile("/proc/self/mountinfo", "utf8"),
      options.resolvedRoot ?? realpath(env.SEMSE_STORAGE_ROOT!),
      realpath(VOLUME),
    ]);
    if (!hasRailwayDataMount(mountInfo) ||
        !resolvedRoot.startsWith(mountPath + path.sep)) {
      throw new Error("Not a mounted originals volume");
    }
    const rootStats = await stat(env.SEMSE_STORAGE_ROOT!);
    if (!rootStats.isDirectory()) throw new Error("Original root is not a directory");
  } catch {
    throw new ServiceUnavailableException(FAIL);
  }
}
