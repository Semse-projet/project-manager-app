import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { EvidenceArtifactStore } from "./signature-evidence-capture.js";

const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/;
const allowedKinds = new Set(["ORIGINAL_PDF", "SIGNED_PDF", "PROVIDER_CERTIFICATE", "PROVIDER_AUDIT_LOG"]);

/**
 * Private, immutable storage on a dedicated persistent filesystem.
 *
 * Must be mounted by the deployment; production should use a restricted
 * volume root such as /data/semse-private-evidence, never /tmp or a public
 * uploads route. This module is intentionally not exposed through HTTP.
 *
 * Concurrency: write temp file (0600) + fsync + hard-link to content-addressed
 * final path. Hard-link fails EEXIST rather than overwriting prior evidence.
 * Orphan temp files are safe to garbage-collect after a retention grace period.
 */
export class PrivateVolumeSignatureArtifactStore implements EvidenceArtifactStore {
  private readonly root: string;

  constructor(root: string) {
    if (!path.isAbsolute(root) || root === path.parse(root).root ||
        (process.env.NODE_ENV === "production" && (root.startsWith("/tmp/") || root === "/tmp")) ||
        root.includes("\0")) {
      throw new Error("private signature evidence requires a dedicated absolute persistent mount");
    }
    this.root = path.resolve(root);
  }

  async putImmutable(input: {
    tenantId: string;
    contractId: string;
    kind: "ORIGINAL_PDF" | "SIGNED_PDF" | "PROVIDER_CERTIFICATE" | "PROVIDER_AUDIT_LOG";
    sha256: string;
    content: Uint8Array;
    mimeType: string;
  }): Promise<string> {
    if (!input.tenantId || !input.contractId || !allowedKinds.has(input.kind) ||
        !SHA.test(input.sha256) ||
        !(input.content instanceof Uint8Array) || input.content.length === 0 ||
        input.content.length > MAX_EVIDENCE_BYTES ||
        createHash("sha256").update(input.content).digest("hex") !== input.sha256 ||
        !["application/pdf", "application/json"].includes(input.mimeType)) {
      throw new Error("invalid or tampered private signature artifact");
    }
    const tenant = createHash("sha256").update(input.tenantId).digest("hex");
    const contract = createHash("sha256").update(input.contractId).digest("hex");
    const directory = path.join(this.root, tenant, contract, input.kind);
    // The directories belong to the signature store only and must not be
    // writable from a separate uploads HTTP endpoint or another container.
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const directoryInfo = await lstat(directory);
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
      throw new Error("signature evidence directory is not private");
    }
    await chmod(directory, 0o700);
    const basename = input.sha256;
    const destination = path.join(directory, basename);
    const temporary = path.join(directory, `.${basename}.${randomUUID()}.tmp`);
    let tempCreated = false;
    try {
      const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT |
        constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      tempCreated = true;
      try {
        await file.writeFile(input.content);
        await file.sync();
      } finally {
        await file.close();
      }
      try {
        await link(temporary, destination);
      } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error;
        // Idempotent put is allowed ONLY for byte-identical prior artifact.
        const old = await readFile(destination);
        const info = await lstat(destination);
        if (!info.isFile() || info.isSymbolicLink() ||
            old.length !== input.content.length ||
            createHash("sha256").update(old).digest("hex") !== input.sha256) {
          throw new Error("signature evidence digest collision or immutable record modified");
        }
      }
      const dir = await open(directory, constants.O_RDONLY);
      try { await dir.sync(); } finally { await dir.close(); }
      return `private-signatures/${tenant}/${contract}/${input.kind}/${basename}`;
    } finally {
      if (tempCreated) await unlink(temporary).catch(() => undefined);
    }
  }
}
