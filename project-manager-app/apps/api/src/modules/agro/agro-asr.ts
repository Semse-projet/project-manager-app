/**
 * P0 SSRF containment for legacy Agro ASR URLs.
 *
 * `AgroEvidenceItem.fileUrl` is a user-supplied display locator and does not
 * prove ownership or custody. Retain the legacy class name for compatibility,
 * but make every ASR read fail closed without touching the network. P1 must
 * replace this with a StorageService reader gated by tenant/farm/asset binding.
 *
 * `readAllowlistedBuffer` is the only network path on this class: it never
 * runs from intake/ASR, and it refuses to fetch until the URL (and every
 * redirect) passes the evidence host allowlist plus public-IP DNS checks.
 */
import { fetchAllowlistedHttps } from "@semse/shared";
import type { TranscriptionStorageReader } from "../contributor-program/transcription-provider.js";
import { evidenceFileUrlAllowedHosts } from "./agro-file-url.js";

export class HttpUrlStorageReader implements TranscriptionStorageReader {
  async readBuffer(_url: string): Promise<Buffer> {
    throw new Error("AUDIO_SOURCE_NOT_VERIFIED");
  }

  async readAllowlistedBuffer(
    url: string,
    allowedHosts = evidenceFileUrlAllowedHosts(),
    fetchImpl?: typeof fetch,
  ): Promise<Buffer> {
    const result = await fetchAllowlistedHttps(url, { allowedHosts, fetchImpl });
    if (!result.ok) {
      throw new Error(result.reason);
    }
    return Buffer.from(await result.response.arrayBuffer());
  }
}
