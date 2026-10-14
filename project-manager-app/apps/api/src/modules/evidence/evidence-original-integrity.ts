import { Logger, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import type { StorageService } from "../../infrastructure/storage/storage.service.js";

export type EvidenceChecksumMode = "off" | "shadow" | "enforce";
const logger = new Logger("EvidenceOriginalIntegrity");

export function resolveEvidenceChecksumMode(): EvidenceChecksumMode {
  const raw = (process.env.EVIDENCE_ORIGINAL_SHA256_MODE ?? "off").trim().toLowerCase();
  if (raw === "off" || raw === "shadow" || raw === "enforce") return raw;
  throw new ServiceUnavailableException("Invalid Evidence checksum mode configuration");
}

/** Called only AFTER actor/resource policy and idempotency checks in EvidenceRepository.
 * A client can never supply or override this digest through the public API.
 */
export async function serverEvidenceChecksum(
  key: string,
  storage: Pick<StorageService, "hashOriginal"> | undefined,
  mode: EvidenceChecksumMode = resolveEvidenceChecksumMode(),
): Promise<string | undefined> {
  if (mode === "off") return undefined;
  try {
    if (!storage) throw new Error("Storage unavailable");
    const result = await storage.hashOriginal(key);
    if (!/^[0-9a-f]{64}$/.test(result.sha256) ||
        !Number.isSafeInteger(result.sizeBytes) || result.sizeBytes <= 0) {
      throw new Error("Invalid original checksum response");
    }
    return result.sha256;
  } catch {
    if (mode === "enforce") {
      throw new UnprocessableEntityException("Original unavailable for integrity verification");
    }
    // Shadow never claims the original has been verified. Do not log keys, paths,
    // file names or digests; shadow is an explicit compatibility transition.
    logger.warn("Evidence original checksum unavailable in shadow mode");
    return undefined;
  }
}
