import path from "node:path";

/**
 * semse-worker does not mount the evidence volume. This guard refuses a
 * write whose resolved path still lands on that volume or on /data, so a
 * mis-rooted mission cannot publish originals while the API gate is frozen.
 * Reads are not covered here; the API read path does not consult the gate.
 */
export function evidenceVolumeRoots(env = process.env) {
  const roots = [];
  for (const key of ["SEMSE_STORAGE_ROOT", "SEMSE_MULTIPART_STORAGE_ROOT"]) {
    const value = env[key];
    if (typeof value === "string" && path.posix.isAbsolute(value) && !value.includes("\0")) {
      roots.push(path.resolve(value));
    }
  }
  roots.push(path.resolve("/data"));
  return roots;
}

export function pathTouchesEvidenceVolume(candidate, env = process.env) {
  if (typeof candidate !== "string" || !candidate.trim() || candidate.includes("\0")) return false;
  const resolved = path.resolve(candidate);
  return evidenceVolumeRoots(env).some((root) => {
    const relative = path.relative(root, resolved);
    return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  });
}

export function assertWorkerDoesNotWriteEvidenceVolume(candidate, env = process.env) {
  if (!pathTouchesEvidenceVolume(candidate, env)) return;
  const error = new Error("Worker refused to write evidence originals; retry after the storage write gate is open");
  error.code = "STORAGE_WRITE_GATE_BLOCKED";
  error.reason = "worker_evidence_volume_write_refused";
  error.retryable = true;
  throw error;
}
