import path from "node:path";

export function resolveStorageWriteGateScope(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const root = path.resolve(env.SEMSE_STORAGE_ROOT ?? "/tmp/semse-storage")
    .replaceAll("\\", "/");
  return `storage:${root}`;
}
