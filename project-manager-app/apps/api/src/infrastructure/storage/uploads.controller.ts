import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  Req,
  Res,
  StreamableFile,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { StorageService } from "./storage.service.js";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/zip",
  "text/plain",
  "application/octet-stream",
]);

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

@Controller("v1/uploads")
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Presign a single-PUT upload key (returns a real local uploadUrl).
   * The client then PUTs the file body to that URL.
   */
  @Get("plan")
  presignUploadPlan(
    @Req() req: { query?: Record<string, unknown> },
  ) {
    const filename = typeof req.query?.filename === "string" ? req.query.filename : "upload";
    const contentType = typeof req.query?.contentType === "string"
      ? req.query.contentType
      : "application/octet-stream";
    const domain = typeof req.query?.domain === "string" ? req.query.domain : "evidence";

    const ext = path.extname(filename) || "";
    const key = `${domain}/${randomUUID()}${ext}`;

    return this.storageService.putUploadPlan({ key, contentType });
  }

  /**
   * Accept a raw PUT body and store the file.
   * This is called by the client using the URL from the upload plan.
   */
  @Put("files/*")
  async putFile(
    @Param("*") key: string,
    @Req() req: IncomingMessage & { headers: Record<string, string | string[] | undefined> },
  ) {
    const rawContentType = req.headers["content-type"] ?? "application/octet-stream";
    const contentType = Array.isArray(rawContentType) ? rawContentType[0] : rawContentType;

    const baseType = contentType.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(baseType)) {
      throw new UnprocessableEntityException(`Content-Type '${baseType}' is not allowed`);
    }

    const rawLength = req.headers["content-length"];
    const length = rawLength ? parseInt(String(rawLength), 10) : undefined;
    if (length && length > MAX_UPLOAD_BYTES) {
      throw new UnprocessableEntityException(`File size ${length} exceeds maximum ${MAX_UPLOAD_BYTES}`);
    }

    const decodedKey = decodeURIComponent(key);
    const stored = await this.storageService.store({
      key: decodedKey,
      stream: Readable.from(req),
      contentType: baseType,
    });

    return {
      ok: true,
      key: stored.key,
      sizeBytes: stored.sizeBytes,
      url: this.storageService.publicUrl(stored.key),
    };
  }

  /**
   * Serve a stored file by key.
   */
  @Get("files/*")
  async getFile(
    @Param("*") key: string,
    @Res({ passthrough: true }) res: { set(headers: Record<string, string>): void },
  ): Promise<StreamableFile> {
    const decodedKey = decodeURIComponent(key);
    const { exists } = await this.storageService.stat(decodedKey);
    if (!exists) {
      throw new NotFoundException(`File '${decodedKey}' not found`);
    }

    const stream = this.storageService.createReadStream(decodedKey);
    const ext = path.extname(decodedKey).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".pdf": "application/pdf",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";

    res.set({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    });

    return new StreamableFile(stream);
  }
}
