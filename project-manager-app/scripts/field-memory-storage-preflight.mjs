#!/usr/bin/env node
/**
 * SEMSE Field Memory P0 — read-only environment/storage mount preflight.
 * Never logs credentials, never reads original image bytes, never writes to /data.
 * Runtime evidence is NOT a backup/restore drill or proof of resource-level access.
 */
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_MOUNT = "/data";

export function readMountPoints(mountInfo = "") {
  const decode = (value) => value.replace(/\\([0-7]{3})/g, (_m, octal) =>
    String.fromCharCode(Number.parseInt(octal, 8)));
  return new Set(mountInfo.split("\n").filter(Boolean).flatMap((line) => {
    const fields = line.split(" ");
    return fields.length >= 5 ? [decode(fields[4])] : [];
  }));
}

// Railway stores originals on Linux. Use POSIX path semantics even when
// this read-only preflight is exercised by the Windows operator test suite.
// Railway stores originals on Linux. Use POSIX path semantics even when
// this read-only preflight is exercised by the Windows operator test suite.
function withinDir(candidate, parent, allowEqual = false) {
  if (typeof candidate !== "string" || !path.posix.isAbsolute(candidate)
    || candidate.includes("\\") || candidate.includes("\0")
    || path.posix.normalize(candidate) !== candidate) return false;
  const diff = path.posix.relative(parent, candidate);
  return (allowEqual && diff === "") || (diff !== "" && diff !== ".."
    && !diff.startsWith("../") && !path.posix.isAbsolute(diff));
}

function check(id, ok, message, severity = "BLOCK") {
  return { id, status: ok ? "PASS" : severity, message };
}

export function inspectFieldMemoryStorage({
  env = {},
  mountInfo = "",
  rootExists = false,
  rootWritable = false,
  multipartExists = false,
  multipartWritable = false,
} = {}) {
  const mount = DEFAULT_MOUNT;
  const production = [env.NODE_ENV, env.RAILWAY_ENVIRONMENT, env.RAILWAY_ENVIRONMENT_NAME].includes("production");
  const root = env.SEMSE_STORAGE_ROOT || "/tmp/semse-storage";
  const multipart = env.SEMSE_MULTIPART_STORAGE_ROOT || "/tmp/semse-multipart";
  const provider = env.STORAGE_PROVIDER || "local";
  const mode = env.UPLOADS_SIGNED_GET_MODE || "off";
  const evidenceHashMode = env.EVIDENCE_ORIGINAL_SHA256_MODE || "off";
  const inVolume = withinDir(root, mount);
  const multipartScoped = withinDir(multipart, root) && withinDir(multipart, mount);
  const modeKnown = ["off", "shadow", "enforce"].includes(mode);
  const secretsReady = typeof env.UPLOADS_SIGNING_SECRET === "string"
    && env.UPLOADS_SIGNING_SECRET.length >= 16
    && env.UPLOADS_SIGNING_SECRET !== env.AUTH_SECRET;
  const checks = [
    check("storage-provider", provider === "local" && (!production || env.STORAGE_PROVIDER === "local"), "Production must explicitly configure STORAGE_PROVIDER=local; S3/R2 are not implemented"),
    check("railway-volume-mount", readMountPoints(mountInfo).has(mount), "Expected a distinct /data mount in this runtime"),
    check("original-root-scope", inVolume, "SEMSE_STORAGE_ROOT must be an absolute path nested below /data"),
    check("multipart-root-scope", multipartScoped, "SEMSE_MULTIPART_STORAGE_ROOT must be nested below the originals root on /data"),
    check("original-root-readable", rootExists, "Original root must exist as a directory"),
    check("original-root-permissions", rootWritable, "Original root must have write permissions (no write performed by preflight)"),
    check("multipart-root-readable", multipartExists, "Multipart root must exist as a directory"),
    check("multipart-root-permissions", multipartWritable, "Multipart root must have write permissions (no write performed by preflight)"),
    check("signed-mode-valid", modeKnown, "Signed-read mode must be off, shadow or enforce"),
    check("signed-mode-active", mode === "enforce", "Signed GET not enforced; use approved shadow → enforce rollout", "WARN"),
    check("signing-secret-configured", secretsReady, "Dedicated signing secret of 16+ chars must be configured and differ from AUTH_SECRET", "WARN"),
    check("checksum-mode-valid", ["off", "shadow", "enforce"].includes(evidenceHashMode), "Evidence checksum mode must be off, shadow or enforce"),
    check("checksum-mode-enforced", evidenceHashMode === "enforce", "Server SHA-256 is not enforced for newly registered Evidence", "WARN"),
    // No env var or presence check can prove a recovery point: deliberately not a PASS.
    { id: "offsite-backup-restore", status: "UNVERIFIED", message: "Separate offsite/volume backup and isolated restore drill required" },
    { id: "resource-level-read-auth", status: "UNVERIFIED", message: "Signed URL alone is insufficient; verify Org/Project/Evidence policy with two real actors" },
  ];
  return {
    audit: "semse-field-memory-storage-preflight-v1",
    production,
    readOnly: true,
    mountExpected: mount,
    // Do not emit storage keys, credentials, source paths or signed URLs.
    checks,
    storageLayoutReady: checks.slice(0, 8).every((v) => v.status === "PASS"),
    configurationEnforcementReady: checks.filter((v) => [
      "signed-mode-valid", "signed-mode-active", "signing-secret-configured",
      "checksum-mode-valid", "checksum-mode-enforced",
    ].includes(v.id)).every((v) => v.status === "PASS"),
    privateCaptureReady: false,
    privateCaptureReason: "Restore drill, signed GET and resource-level Org checks are not provable by this environment preflight",
  };
}

async function probe(directory) {
  if (!directory || typeof directory !== "string") return { exists: false, writable: false };
  try {
    const s = await stat(directory);
    if (!s.isDirectory()) return { exists: false, writable: false };
    let writable = false;
    try { await access(directory, constants.W_OK); writable = true; } catch {}
    return { exists: true, writable };
  } catch {
    return { exists: false, writable: false };
  }
}

export async function runPreflight(env = process.env) {
  const root = env.SEMSE_STORAGE_ROOT || "/tmp/semse-storage";
  const multipart = env.SEMSE_MULTIPART_STORAGE_ROOT || "/tmp/semse-multipart";
  const [mountInfo, original, multi] = await Promise.all([
    readFile("/proc/self/mountinfo", "utf8").catch(() => ""),
    probe(root),
    probe(multipart),
  ]);
  return inspectFieldMemoryStorage({
    env, mountInfo,
    rootExists: original.exists,
    rootWritable: original.writable,
    multipartExists: multi.exists,
    multipartWritable: multi.writable,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await runPreflight();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (process.argv.includes("--strict-layout") && !result.storageLayoutReady) {
      process.exitCode = 1;
    }
    // A green config gate is NOT permission to activate CaptureSession.
    // Restore + authenticated cross-Org policy checks remain human-audited.
    if (process.argv.includes("--strict-configuration") && !result.configurationEnforcementReady) {
      process.exitCode = 2;
    }
  } catch {
    process.stderr.write("Field Memory preflight failed: unable to inspect storage without changing it\n");
    process.exitCode = 1;
  }
}
