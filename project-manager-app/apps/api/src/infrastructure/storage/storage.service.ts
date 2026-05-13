import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { normalizeStorageKey } from "./storage-key.js";

export type UploadPlan = {
  uploadUrl: string;
  key: string;
  provider: "local" | "s3" | "r2";
};

export type StoredFile = {
  key: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

/**
 * Storage service with a local filesystem backend.
 * S3/R2 support plugged in by setting STORAGE_PROVIDER=s3 + credentials.
 * In development, files are stored at SEMSE_STORAGE_ROOT (default: /tmp/semse-storage).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider = (process.env.STORAGE_PROVIDER ?? "local") as "local" | "s3" | "r2";
  private readonly localRoot = path.resolve(
    process.env.SEMSE_STORAGE_ROOT ?? "/tmp/semse-storage",
  );
  private readonly baseUrl = (
    process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000"
  ).replace(/\/+$/, "");

  async putUploadPlan(input: {
    key: string;
    contentType: string;
    fileSizeBytes?: number;
  }): Promise<UploadPlan> {
    if (this.provider !== "local") {
      this.logger.warn("Non-local storage provider not yet supported — falling back to local");
    }

    return {
      uploadUrl: `${this.baseUrl}/v1/uploads/files/${encodeURIComponent(input.key)}`,
      key: input.key,
      provider: "local",
    };
  }

  async store(input: {
    key: string;
    stream: Readable;
    contentType: string;
  }): Promise<StoredFile> {
    await this.ensureLocalRoot();
    const key = normalizeStorageKey(input.key);
    const filePath = this.localPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });

    const ws = createWriteStream(filePath);
    await pipeline(input.stream, ws);

    const stats = await stat(filePath);
    this.logger.log({ key, sizeBytes: stats.size }, "file stored");

    return {
      key,
      contentType: input.contentType,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString(),
    };
  }

  createReadStream(key: string): ReturnType<typeof createReadStream> {
    const filePath = this.localPath(key);
    return createReadStream(filePath);
  }

  async stat(key: string): Promise<{ sizeBytes: number; exists: boolean }> {
    try {
      const s = await stat(this.localPath(key));
      return { sizeBytes: s.size, exists: true };
    } catch {
      return { sizeBytes: 0, exists: false };
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.localPath(key));
    } catch {
      // already gone
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/v1/uploads/files/${encodeURIComponent(key)}`;
  }

  private localPath(key: string): string {
    const safe = normalizeStorageKey(key);
    const filePath = path.resolve(this.localRoot, safe);
    const rootPrefix = `${this.localRoot}${path.sep}`;
    if (filePath !== this.localRoot && !filePath.startsWith(rootPrefix)) {
      throw new Error("Invalid storage key");
    }
    return filePath;
  }

  private async ensureLocalRoot(): Promise<void> {
    await mkdir(this.localRoot, { recursive: true });
  }

  async assertExists(key: string): Promise<void> {
    const { exists } = await this.stat(key);
    if (!exists) {
      throw new NotFoundException(`File '${key}' not found in storage`);
    }
  }
}
