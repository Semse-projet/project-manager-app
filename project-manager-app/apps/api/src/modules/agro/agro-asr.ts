/**
 * P0 SSRF containment for legacy Agro ASR URLs.
 *
 * `AgroEvidenceItem.fileUrl` is a user-supplied display locator and does not
 * prove ownership or custody. Retain the legacy class name for compatibility,
 * but make every read fail closed without touching the network. P1 must
 * replace this with a StorageService reader gated by tenant/farm/asset binding.
 */
import type { TranscriptionStorageReader } from "../contributor-program/transcription-provider.js";

export class HttpUrlStorageReader implements TranscriptionStorageReader {
  async readBuffer(_url: string): Promise<Buffer> {
    throw new Error("AUDIO_SOURCE_NOT_VERIFIED");
  }
}
